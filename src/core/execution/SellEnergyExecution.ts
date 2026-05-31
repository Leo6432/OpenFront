import { Execution, Game, Player } from "../game/Game";

export class SellEnergyExecution implements Execution {
  private active = true;
  private mg!: Game;

  constructor(private player: Player) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.player.isAlive()) {
      this.active = false;
      return;
    }
    const energy = this.player.energy();
    if (energy > 0n) {
      // Sell at the current global market price. The sale adds supply to the
      // market, which pushes the price down on the next market update.
      const price = this.mg.energyMarketPrice();
      this.player.removeEnergy(energy);
      this.player.addGold(energy * price);
      this.mg.registerEnergySold(energy);
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
