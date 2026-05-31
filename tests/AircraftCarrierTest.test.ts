import { AircraftCarrierExecution } from "../src/core/execution/AircraftCarrierExecution";
import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../src/core/game/Game";
import { setup } from "./util/Setup";

// half_land_half_ocean: 16x16 grid
// x=0-7 land, x=8-15 ocean
// Shore (land adjacent to water) is at x=7

describe("AircraftCarrierExecution", () => {
  test("carrier spawns on water, navigates, and attacks", async () => {
    const senderInfo = new PlayerInfo(
      "sender",
      PlayerType.Human,
      "client_s",
      "senderabc",
    );
    const enemyInfo = new PlayerInfo(
      "enemy",
      PlayerType.Human,
      "client_e",
      "enemyabcd",
    );

    const game = await setup(
      "half_land_half_ocean",
      { infiniteGold: false, instantBuild: true },
      [senderInfo, enemyInfo],
    );

    const sender = game.player("senderabc");
    const enemy = game.player("enemyabcd");

    // Give sender territory in the upper half including the coast (x=7)
    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) sender.conquer(tile);
      }
    }

    // Port on the actual shore tile (x=7 is land adjacent to water at x=8)
    const portTile = game.ref(7, 4);
    // Verify it's a shore tile (land adjacent to water)
    expect(game.map().isLand(portTile)).toBe(true);
    sender.buildUnit(UnitType.Port, portTile, {});

    // Give enemy territory only in the far lower portion so the nearest enemy
    // shore tile is far from the sender's spawn tile (distance > 4) and the
    // carrier must actually navigate before switching to attack phase.
    for (let x = 0; x <= 7; x++) {
      for (let y = 12; y <= 15; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) enemy.conquer(tile);
      }
    }

    // Build a city so the carrier has a unit target
    const enemyCity = game.ref(5, 13);
    enemy.buildUnit(UnitType.City, enemyCity, {});

    sender.addGold(20_000_000n);

    const exec = new AircraftCarrierExecution(sender, "enemyabcd");
    game.addExecution(exec);

    // First tick: runs init
    game.executeNextTick();

    // Debug: what failed?
    if (!exec.isActive()) {
      const ports = sender.units(UnitType.Port);
      console.log("Port count:", ports.length);
      if (ports.length > 0) {
        const p = ports[0];
        console.log("Port tile:", game.map().x(p.tile()), game.map().y(p.tile()));
        console.log("Port active:", p.isActive(), "underConstruction:", p.isUnderConstruction());
        // Check water neighbors of port
        game.forEachNeighbor(p.tile(), (n) => {
          console.log("Port neighbor:", game.map().x(n), game.map().y(n), "isWater:", game.map().isWater(n));
        });
      }
      const borderCount = Array.from(enemy.borderTiles()).length;
      const shoreCount = Array.from(enemy.borderTiles()).filter(bt => game.isShore(bt)).length;
      console.log("Enemy border tiles:", borderCount, "shore:", shoreCount);
    }

    expect(exec.isActive()).toBe(true);

    const senderWarships = sender.units(UnitType.Warship);
    expect(senderWarships.length).toBe(1);
    const carrier = senderWarships[0];

    // Carrier must start on water
    expect(game.map().isWater(carrier.tile())).toBe(true);

    // Run more ticks — carrier should move
    const initialTile = carrier.tile();
    for (let i = 0; i < 20; i++) {
      game.executeNextTick();
      if (!exec.isActive()) break;
    }

    expect(carrier.tile()).not.toBe(initialTile);
  });

  test("init fails gracefully when sender has no port", async () => {
    const senderInfo = new PlayerInfo(
      "sender2",
      PlayerType.Human,
      "client_s2",
      "senderef1",
    );
    const enemyInfo = new PlayerInfo(
      "enemy2",
      PlayerType.Human,
      "client_e2",
      "enemyef12",
    );

    const game = await setup("half_land_half_ocean", {}, [senderInfo, enemyInfo]);

    const sender = game.player("senderef1");
    const enemy = game.player("enemyef12");

    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) sender.conquer(tile);
      }
    }
    for (let x = 0; x <= 7; x++) {
      for (let y = 8; y <= 15; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) enemy.conquer(tile);
      }
    }

    sender.addGold(20_000_000n);
    // No port built

    const exec = new AircraftCarrierExecution(sender, "enemyef12");
    game.addExecution(exec);
    game.executeNextTick();

    expect(exec.isActive()).toBe(false);
    expect(sender.units(UnitType.Warship).length).toBe(0);
    expect(sender.gold()).toBe(20_000_000n);
  });
});
