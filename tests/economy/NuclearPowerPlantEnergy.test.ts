import { ConstructionExecution } from "../../src/core/execution/ConstructionExecution";
import { SellEnergyExecution } from "../../src/core/execution/SellEnergyExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../src/core/game/Game";
import { setup } from "../util/Setup";

describe("Nuclear Power Plant energy", () => {
  let game: Game;
  let player: Player;
  const builderInfo = new PlayerInfo(
    "builder",
    PlayerType.Human,
    null,
    "builder_id",
  );

  beforeEach(async () => {
    game = await setup(
      "plains",
      {
        infiniteGold: true,
        instantBuild: false,
        infiniteTroops: true,
      },
      [builderInfo],
    );
    player = game.player(builderInfo.id);
    // Conquer a sizeable region so multiple plants have valid land tiles
    // far enough apart to satisfy structureMinDist (15).
    for (let x = 0; x < 40; x++) {
      for (let y = 5; y < 15; y++) {
        player.conquer(game.ref(x, y));
      }
    }
  });

  function buildPlant(tile: number) {
    game.addExecution(
      new ConstructionExecution(player, UnitType.NuclearPowerPlant, tile),
    );
    const duration =
      game.unitInfo(UnitType.NuclearPowerPlant).constructionDuration ?? 0;
    for (let i = 0; i <= duration + 3; i++) game.executeNextTick();
  }

  test("a completed plant generates energy each tick", () => {
    expect(player.energy()).toBe(0n);
    buildPlant(game.ref(0, 10));
    expect(player.units(UnitType.NuclearPowerPlant)).toHaveLength(1);

    const before = player.energy();
    game.executeNextTick();
    const after = player.energy();
    expect(after).toBeGreaterThan(before);
  });

  test("more plants produce more energy per tick", () => {
    buildPlant(game.ref(0, 10));
    const oneRateStart = player.energy();
    game.executeNextTick();
    const oneRate = player.energy() - oneRateStart;

    buildPlant(game.ref(30, 10));
    expect(player.units(UnitType.NuclearPowerPlant)).toHaveLength(2);
    const twoRateStart = player.energy();
    game.executeNextTick();
    const twoRate = player.energy() - twoRateStart;

    expect(twoRate).toBe(oneRate * 2n);
  });

  test("selling energy converts it to gold", () => {
    buildPlant(game.ref(0, 10));
    for (let i = 0; i < 5; i++) game.executeNextTick();
    const energy = player.energy();
    expect(energy).toBeGreaterThan(0n);

    const goldBefore = player.gold();
    game.addExecution(new SellEnergyExecution(player));
    // One tick to init the execution, one tick to run it.
    game.executeNextTick();
    game.executeNextTick();

    // Gold increased by the sale proceeds.
    expect(player.gold()).toBeGreaterThan(goldBefore);
  });
});
