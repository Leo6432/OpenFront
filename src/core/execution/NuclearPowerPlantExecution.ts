import { Execution, Game, Unit, UnitType } from "../game/Game";
import { TrainStationExecution } from "./TrainStationExecution";

export class NuclearPowerPlantExecution implements Execution {
  private active: boolean = true;
  private game: Game;
  private stationCreated = false;

  constructor(private plant: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.game = mg;
  }

  tick(_ticks: number): void {
    if (!this.stationCreated) {
      this.createStation();
      this.stationCreated = true;
    }
    if (!this.plant.isActive()) {
      this.active = false;
      return;
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  private createStation(): void {
    const structures = this.game.nearbyUnits(
      this.plant.tile()!,
      this.game.config().trainStationMaxRange(),
      [UnitType.City, UnitType.Port, UnitType.Factory, UnitType.NuclearPowerPlant],
    );

    this.game.addExecution(new TrainStationExecution(this.plant, true));
    for (const { unit } of structures) {
      if (!unit.hasTrainStation()) {
        this.game.addExecution(new TrainStationExecution(unit));
      }
    }
  }
}
