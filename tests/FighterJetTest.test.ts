import { FighterJetExecution } from "../src/core/execution/FighterJetExecution";
import { PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

// half_land_half_ocean: 16x16 grid, x=0-7 land, x=8-15 ocean.

describe("FighterJetExecution", () => {
  test("jet spawns, flies across the map, and fires missiles", async () => {
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

    // Sender owns the upper-left land block.
    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 3; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) sender.conquer(tile);
      }
    }
    // Missile silo unlocks the fighter jet.
    sender.buildUnit(UnitType.MissileSilo, game.ref(2, 1), {});

    // Enemy owns the lower-left land block, with a city as a target.
    for (let x = 0; x <= 7; x++) {
      for (let y = 5; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) enemy.conquer(tile);
      }
    }
    const enemyCity = game.ref(4, 6);
    enemy.buildUnit(UnitType.City, enemyCity, {});

    sender.addGold(20_000_000n);
    const goldBefore = sender.gold();

    const exec = new FighterJetExecution(sender, "enemyabcd");
    game.addExecution(exec);

    // First tick runs init: cost deducted, jet spawned.
    game.executeNextTick();
    expect(exec.isActive()).toBe(true);
    expect(sender.gold()).toBe(goldBefore - 10_000_000n);

    const jets = sender.units(UnitType.Shell);
    expect(jets.length).toBe(1);
    const jet = jets[0];
    const startX = game.map().x(jet.tile());

    // Run the flight. The jet should move and at least one missile should be
    // fired at the enemy.
    let sawShellExecutionFire = false;
    let maxX = startX;
    for (let i = 0; i < 60; i++) {
      game.executeNextTick();
      // Count enemy-owned shells in flight (missiles fired at the enemy).
      const firedAtEnemy = sender
        .units(UnitType.Shell)
        .filter((u) => u.id() !== jet.id());
      if (firedAtEnemy.length > 0) sawShellExecutionFire = true;
      if (jet.isActive()) {
        maxX = Math.max(maxX, game.map().x(jet.tile()));
      }
      if (!exec.isActive()) break;
    }

    // The jet travelled across the map.
    expect(maxX).toBeGreaterThan(startX);
    // It launched missiles along the way.
    expect(sawShellExecutionFire).toBe(true);
    // The enemy city took damage from the bombardment.
    const cityUnits = enemy.units(UnitType.City);
    if (cityUnits.length > 0) {
      expect(cityUnits[0].health()).toBeLessThan(
        game.config().unitInfo(UnitType.City).maxHealth ?? Infinity,
      );
    }
  });

  test("init fails gracefully when sender cannot afford the jet", async () => {
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

    const game = await setup("half_land_half_ocean", {}, [
      senderInfo,
      enemyInfo,
    ]);

    const sender = game.player("senderef1");
    const enemy = game.player("enemyef12");

    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 3; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) sender.conquer(tile);
      }
    }
    for (let x = 0; x <= 7; x++) {
      for (let y = 5; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) enemy.conquer(tile);
      }
    }

    // Not enough gold for the jet.
    const goldBefore = sender.gold();

    const exec = new FighterJetExecution(sender, "enemyef12");
    game.addExecution(exec);
    game.executeNextTick();

    expect(exec.isActive()).toBe(false);
    expect(sender.units(UnitType.Shell).length).toBe(0);
    expect(sender.gold()).toBe(goldBefore);
  });
});
