import { Execution, Game, Unit } from "../game/Game";

// Each nuclear power plant produces 1 000 energy/tick = 600 000/min.
// With city consumption at 10/tick (6 000/min), one plant balances ~100 cities.
const ENERGY_PER_TICK = 1_000n;

export class NuclearPowerPlantExecution implements Execution {
  private active = true;
  private game: Game;

  constructor(private plant: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.game = mg;
  }

  tick(_ticks: number): void {
    if (!this.plant.isActive()) {
      this.active = false;
      return;
    }
    this.plant.owner().addEnergy(ENERGY_PER_TICK);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
