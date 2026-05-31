import { SellEnergyExecution } from "../src/core/execution/SellEnergyExecution";
import { PlayerInfo, PlayerType, UnitType } from "../src/core/game/Game";
import { setup } from "./util/Setup";

describe("Energy market", () => {
  test("consumption from cities and factories pushes the price up", async () => {
    const info = new PlayerInfo(
      "p1",
      PlayerType.Human,
      "client_1",
      "player001",
    );
    const game = await setup(
      "half_land_half_ocean",
      { infiniteGold: true, instantBuild: true },
      [info],
    );
    const player = game.player("player001");

    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) player.conquer(tile);
      }
    }
    player.buildUnit(UnitType.City, game.ref(2, 2), {});
    player.buildUnit(UnitType.Factory, game.ref(4, 4), {});

    const priceBefore = game.energyMarketPrice();
    // No one sells, but cities/factories create demand → price rises.
    for (let i = 0; i < 5; i++) {
      game.executeNextTick();
    }
    expect(game.energyConsumption()).toBeGreaterThan(0n);
    expect(game.energyMarketPrice()).toBeGreaterThan(priceBefore);
  });

  test("selling energy pays gold at the market price and lowers the price", async () => {
    const info = new PlayerInfo(
      "p2",
      PlayerType.Human,
      "client_2",
      "player002",
    );
    const game = await setup(
      "half_land_half_ocean",
      { infiniteGold: false, instantBuild: true },
      [info],
    );
    const player = game.player("player002");

    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) player.conquer(tile);
      }
    }

    const goldBefore = player.gold();
    const priceAtSale = game.energyMarketPrice();
    player.addEnergy(1000n);

    game.addExecution(new SellEnergyExecution(player));
    // First tick initialises the execution, second runs the sale.
    game.executeNextTick();
    game.executeNextTick();

    // Player was paid energy * price and the energy is gone.
    expect(player.energy()).toBe(0n);
    expect(player.gold()).toBe(goldBefore + 1000n * priceAtSale);
    // Large supply this tick drives the price below the base.
    expect(game.energyMarketPrice()).toBeLessThan(priceAtSale);
    expect(game.energySoldLastTick()).toBe(1000n);
  });

  test("price stays within bounds after a huge sell-off", async () => {
    const info = new PlayerInfo(
      "p3",
      PlayerType.Human,
      "client_3",
      "player003",
    );
    const game = await setup(
      "half_land_half_ocean",
      { infiniteGold: false, instantBuild: true },
      [info],
    );
    const player = game.player("player003");
    for (let x = 0; x <= 7; x++) {
      for (let y = 0; y <= 7; y++) {
        const tile = game.ref(x, y);
        if (game.map().isLand(tile)) player.conquer(tile);
      }
    }

    player.addEnergy(10_000_000n);
    game.addExecution(new SellEnergyExecution(player));
    game.executeNextTick();
    game.executeNextTick();

    // Price is clamped at the floor, never negative.
    expect(game.energyMarketPrice()).toBeGreaterThanOrEqual(20n);
    expect(game.energyMarketPrice()).toBeLessThanOrEqual(1000n);
  });
});
