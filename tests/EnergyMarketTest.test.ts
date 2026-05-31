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
    // No one sells energy. Demand drains the stock; price rises at most
    // MAX_PRICE_RISE_PER_TICK (1) per tick, so after N ticks price = 1 + N.
    for (let i = 0; i < 20; i++) {
      game.executeNextTick();
    }
    expect(game.energyStructureCount()).toBe(2n);
    // Price should have risen, but not instantly (smooth cap of 1/tick).
    expect(game.energyMarketPrice()).toBeGreaterThan(priceBefore);
    expect(game.energyMarketPrice()).toBeLessThanOrEqual(priceBefore + 20n);
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

    // A city creates continuous demand so the price responds to stock changes.
    player.buildUnit(UnitType.City, game.ref(3, 3), {});

    player.addEnergy(1000n);
    const goldBefore = player.gold();

    game.addExecution(new SellEnergyExecution(player));
    // Tick 1: init. Tick 2: SellEnergyExecution.tick() sells at current price,
    // then updateEnergyMarket() fills the stock and recomputes price downward.
    game.executeNextTick();
    const priceBeforeSale = game.energyMarketPrice();
    game.executeNextTick();

    // Player was paid gold; energy is gone.
    expect(player.energy()).toBe(0n);
    expect(player.gold()).toBeGreaterThan(goldBefore);
    // Selling 1000 units fills the stock above equilibrium → price falls.
    expect(game.energyMarketPrice()).toBeLessThan(priceBeforeSale);
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

    // Price is clamped at the floor (1), never zero or negative.
    expect(game.energyMarketPrice()).toBeGreaterThanOrEqual(1n);
    expect(game.energyMarketPrice()).toBeLessThanOrEqual(500n);
  });
});
