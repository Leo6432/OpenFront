import { Execution, Game, Player } from "../game/Game";

const GOLD_PER_ENERGY = 100n;

export class SellEnergyExecution implements Execution {
  private active = true;

  constructor(private player: Player) {}

  init(_mg: Game, _ticks: number): void {}

  tick(_ticks: number): void {
    if (!this.player.isAlive()) {
      this.active = false;
      return;
    }
    const energy = this.player.energy();
    if (energy > 0n) {
      this.player.removeEnergy(energy);
      this.player.addGold(energy * GOLD_PER_ENERGY);
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
