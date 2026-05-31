import cluster from "cluster";
import crypto from "crypto";
import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { GameEnv } from "../core/configuration/Config";
import { logger } from "./Logger";
import { MapPlaylist } from "./MapPlaylist";
import { MasterLobbyService } from "./MasterLobbyService";
import { setNoStoreHeaders } from "./NoStoreHeaders";
import { renderAppShell } from "./RenderHtml";
import { getRuntimeAssetManifest } from "./RuntimeAssetManifest";
import { ServerEnv } from "./ServerEnv";
import { applyStaticAssetCacheControl } from "./StaticAssetCache";
import { InviteService } from "./InviteService";
import { getUserMe, verifyClientToken } from "./jwt";

const playlist = new MapPlaylist();
let lobbyService: MasterLobbyService;
const inviteService = new InviteService();

const app = express();
const server = http.createServer(app);

const log = logger.child({ comp: "m" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

// Serve the shared app shell for the root document.
app.use(async (req, res, next) => {
  if (req.path === "/") {
    try {
      await renderAppShell(
        res,
        path.join(__dirname, "../../static/index.html"),
      );
    } catch (error) {
      log.error("Error rendering index.html:", error);
      res.status(500).send("Internal Server Error");
    }
  } else {
    next();
  }
});

app.use(
  express.static(path.join(__dirname, "../../static"), {
    maxAge: "1y", // Set max-age to 1 year for all static assets
    setHeaders: (res) => {
      applyStaticAssetCacheControl(
        res.setHeader.bind(res),
        res.req.originalUrl,
      );
    },
  }),
);

app.set("trust proxy", 3);
app.use(
  rateLimit({
    windowMs: 1000, // 1 second
    max: 20, // 20 requests per IP per second
  }),
);

app.use("/api", (_req, res, next) => {
  setNoStoreHeaders(res);
  next();
});

async function resolvePublicId(
  req: Request,
): Promise<{ publicId: string; username: string } | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const verification = await verifyClientToken(token);
  if (verification.type === "error") return null;

  if (verification.claims !== null) {
    const result = await getUserMe(token);
    if (result.type === "error") return null;
    return {
      publicId: result.response.player.publicId,
      username: (req.body as Record<string, unknown>)?.fromUsername as string || result.response.player.publicId,
    };
  }
  // Dev mode: persistentId doubles as publicId
  return {
    publicId: verification.persistentId,
    username: (req.body as Record<string, unknown>)?.fromUsername as string || verification.persistentId,
  };
}

app.post("/api/invite", async (req: Request, res: Response) => {
  const sender = await resolvePublicId(req);
  if (!sender) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { toPublicId, gameId, gameUrl, fromUsername } = req.body as Record<string, string>;
  if (!toPublicId || !gameId || !gameUrl) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  inviteService.add(toPublicId, {
    fromPublicId: sender.publicId,
    fromUsername: fromUsername || sender.username,
    gameId,
    gameUrl,
    createdAt: Date.now(),
  });
  res.json({ ok: true });
});

app.get("/api/invites", async (req: Request, res: Response) => {
  const caller = await resolvePublicId(req);
  if (!caller) {
    res.json({ invites: [] });
    return;
  }
  res.json({ invites: inviteService.drain(caller.publicId) });
});

// Start the master process
export async function startMaster() {
  if (!cluster.isPrimary) {
    throw new Error(
      "startMaster() should only be called in the primary process",
    );
  }

  log.info(`Primary ${process.pid} is running`);
  log.info(`Setting up ${ServerEnv.numWorkers()} workers...`);

  lobbyService = new MasterLobbyService(playlist, log);

  // Generate admin token for worker authentication
  const ADMIN_TOKEN = crypto.randomBytes(16).toString("hex");
  process.env.ADMIN_TOKEN = ADMIN_TOKEN;

  const INSTANCE_ID =
    ServerEnv.env() === GameEnv.Dev
      ? "DEV_ID"
      : crypto.randomBytes(4).toString("hex");
  process.env.INSTANCE_ID = INSTANCE_ID;

  log.info(`Instance ID: ${INSTANCE_ID}`);

  // Fork workers
  for (let i = 0; i < ServerEnv.numWorkers(); i++) {
    const worker = cluster.fork({
      WORKER_ID: i,
      ADMIN_TOKEN,
      INSTANCE_ID,
    });

    lobbyService.registerWorker(i, worker);
    log.info(`Started worker ${i} (PID: ${worker.process.pid})`);
  }

  // Handle worker crashes
  cluster.on("exit", (worker, code, signal) => {
    const workerId = (worker as any).process?.env?.WORKER_ID;
    if (workerId === undefined) {
      log.error(`worker crashed could not find id`);
      return;
    }

    const workerIdNum = parseInt(workerId);
    lobbyService.removeWorker(workerIdNum);

    log.warn(
      `Worker ${workerId} (PID: ${worker.process.pid}) died with code: ${code} and signal: ${signal}`,
    );
    log.info(`Restarting worker ${workerId}...`);

    // Restart the worker with the same ID
    const newWorker = cluster.fork({
      WORKER_ID: workerId,
      ADMIN_TOKEN,
      INSTANCE_ID,
    });

    lobbyService.registerWorker(workerIdNum, newWorker);
    log.info(
      `Restarted worker ${workerId} (New PID: ${newWorker.process.pid})`,
    );
  });

  const PORT = 3000;
  server.listen(PORT, () => {
    log.info(`Master HTTP server listening on port ${PORT}`);
    // Warm nginx cache for all map files after a short delay so nginx is ready
    setTimeout(() => warmMapCache(), 3000);
  });
}

async function warmMapCache(): Promise<void> {
  try {
    const manifest = await getRuntimeAssetManifest();
    const mapUrls = Object.entries(manifest)
      .filter(([key]) => key.startsWith("maps/") && key.endsWith(".bin"))
      .map(([, url]) => url);

    if (mapUrls.length === 0) {
      log.info("No map files in asset manifest to warm");
      return;
    }

    log.info(`Warming nginx cache for ${mapUrls.length} map files...`);

    let done = 0;
    await Promise.allSettled(
      mapUrls.map(async (url) => {
        try {
          await fetch(`http://localhost${url}`, {
            signal: AbortSignal.timeout(60_000),
          });
          done++;
        } catch {
          // non-fatal
        }
      }),
    );

    log.info(`Map cache warmup complete: ${done}/${mapUrls.length} files cached`);
  } catch (err) {
    log.warn(`Map cache warmup error: ${err}`);
  }
}

app.get("/api/health", (_req, res) => {
  const ready = lobbyService?.isHealthy() ?? false;
  if (ready) {
    res.json({ status: "ok" });
  } else {
    res.status(503).json({ status: "unavailable" });
  }
});

// SPA fallback route
app.get("/{*splat}", async function (_req, res) {
  try {
    const htmlPath = path.join(__dirname, "../../static/index.html");
    await renderAppShell(res, htmlPath);
  } catch (error) {
    log.error("Error rendering SPA fallback:", error);
    res.status(500).send("Internal Server Error");
  }
});
