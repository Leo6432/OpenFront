import { Execution, Game, Unit } from "../game/Game";

// Each nuclear power plant produces 1 energy/tick = 600/min.
// One plant balances 1 city (city consumes 1/tick) or 0.5 factory (2/tick).
const ENERGY_PER_TICK = 1n;

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
