import { getAuthHeader } from "./Auth";

export interface IncomingInvite {
  fromPublicId: string;
  fromUsername: string;
  gameId: string;
  gameUrl: string;
  createdAt: number;
}

export class LobbyInviteEvent extends Event {
  constructor(public readonly invite: IncomingInvite) {
    super("lobby-invite", { bubbles: true });
  }
}

const POLL_INTERVAL_MS = 4000;

export class InvitePolling {
  private timer: number | null = null;

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const auth = await getAuthHeader();
      if (!auth) return;
      const res = await fetch("/api/invites", {
        headers: { Authorization: auth },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { invites: IncomingInvite[] };
      for (const invite of data.invites ?? []) {
        document.dispatchEvent(new LobbyInviteEvent(invite));
      }
    } catch {
      // network errors are silent — we'll retry next interval
    }
  }
}

export async function sendLobbyInvite(
  toPublicId: string,
  gameId: string,
  gameUrl: string,
): Promise<boolean> {
  try {
    const auth = await getAuthHeader();
    if (!auth) return false;
    const fromUsername =
      localStorage.getItem("username") ?? toPublicId.slice(0, 8);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({ toPublicId, gameId, gameUrl, fromUsername }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
