import { Execution, Game, Player, PlayerID, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { ShellExecution } from "./ShellExecution";

const CARRIER_COST = 10_000_000n;
// 20 seconds of bombardment at 10 ticks/s
const ATTACK_DURATION = 200;
// Fire a shell every 2 ticks (5/s)
const FIRE_RATE = 2;
const ATTACK_RANGE = 25;

export class AircraftCarrierExecution implements Execution {
  private active = true;
  private carrier: Unit | null = null;
  private phase: "navigate" | "attack" | "retreat" = "navigate";
  private attackTicks = 0;
  private lastShot = -999;
  // Water tile adjacent to sender's port — actual spawn location on water
  private spawnWaterTile!: TileRef;
  // Water tile adjacent to enemy coast — navigation destination
  private dstWaterTile!: TileRef;
  private mg!: Game;
  private pathfinder!: WaterPathFinder;
  private targetPlayer!: Player;

  constructor(
    private sender: Player,
    private targetPlayerID: PlayerID,
  ) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;

    if (!mg.hasPlayer(this.targetPlayerID)) {
      this.active = false;
      return;
    }
    this.targetPlayer = mg.player(this.targetPlayerID) as Player;

    if (!this.targetPlayer.isAlive() || !this.sender.isAlive()) {
      this.active = false;
      return;
    }
    if (this.sender.gold() < CARRIER_COST) {
      this.active = false;
      return;
    }

    // Find the sender's best active port and its adjacent water tile.
    // We spawn the carrier on water (not on the port land tile) so the
    // WaterPathFinder can navigate from the very first tick.
    let portWaterTile: TileRef | null = null;
    for (const port of this.sender.units(UnitType.Port)) {
      if (!port.isActive() || port.isUnderConstruction()) continue;
      mg.forEachNeighbor(port.tile(), (n) => {
        if (portWaterTile === null && mg.isWater(n)) {
          portWaterTile = n;
        }
      });
      if (portWaterTile !== null) break;
    }
    if (portWaterTile === null) {
      this.active = false;
      return;
    }
    this.spawnWaterTile = portWaterTile;

    // Find a water tile adjacent to the enemy's shore that is in the same
    // water component as the sender's port (so the path exists).
    const portComponent = mg.getWaterComponent(this.spawnWaterTile);
    let dstWaterTile: TileRef | null = null;

    for (const bt of this.targetPlayer.borderTiles()) {
      if (!mg.isShore(bt)) continue;
      mg.forEachNeighbor(bt, (n) => {
        if (dstWaterTile !== null || !mg.isWater(n)) return;
        // Verify this water tile is reachable from sender's port
        if (
          portComponent !== null &&
          mg.hasWaterComponent(n, portComponent)
        ) {
          dstWaterTile = n;
        }
      });
      if (dstWaterTile !== null) break;
    }
    if (dstWaterTile === null) {
      this.active = false;
      return;
    }
    this.dstWaterTile = dstWaterTile;

    // Deduct cost: buildUnit will deduct the warship's base cost internally,
    // so we only pre-deduct the remainder to total exactly CARRIER_COST.
    const warshipCost = mg.unitInfo(UnitType.Warship).cost(mg, this.sender);
    const remainder =
      CARRIER_COST > warshipCost ? CARRIER_COST - warshipCost : 0n;
    this.sender.removeGold(remainder);

    // Spawn the carrier on the water tile next to the port so it starts on
    // water and the pathfinder works immediately.
    this.carrier = this.sender.buildUnit(UnitType.Warship, this.spawnWaterTile, {
      patrolTile: this.dstWaterTile,
    });

    this.pathfinder = new WaterPathFinder(mg);
  }

  tick(ticks: number): void {
    if (!this.carrier?.isActive()) {
      this.active = false;
      return;
    }

    switch (this.phase) {
      case "navigate": {
        // Move 2 steps per tick so the carrier crosses the ocean visibly
        for (let step = 0; step < 2; step++) {
          if (!this.active) break;
          const dist = this.mg.manhattanDist(
            this.carrier.tile(),
            this.dstWaterTile,
          );
          if (dist <= 4) {
            this.phase = "attack";
            break;
          }
          const result = this.pathfinder.next(
            this.carrier.tile(),
            this.dstWaterTile,
          );
          if (result.status === PathStatus.COMPLETE) {
            this.phase = "attack";
            break;
          } else if (result.status === PathStatus.NEXT) {
            this.carrier.move(result.node);
          } else {
            // No water path found — delete carrier and refund gold
            this.sender.addGold(CARRIER_COST);
            this.carrier.delete();
            this.active = false;
            break;
          }
        }
        break;
      }

      case "attack": {
        this.attackTicks++;
        if (this.attackTicks >= ATTACK_DURATION) {
          this.phase = "retreat";
          break;
        }
        if (ticks - this.lastShot >= FIRE_RATE) {
          const target = this.findNearestEnemyUnit();
          if (target !== null) {
            this.lastShot = ticks;
            this.mg.addExecution(
              new ShellExecution(
                this.carrier.tile(),
                this.sender,
                this.carrier,
                target,
              ),
            );
          }
        }
        break;
      }

      case "retreat": {
        // Move 2 steps per tick back to spawn
        for (let step = 0; step < 2; step++) {
          if (!this.active) break;
          const dist = this.mg.manhattanDist(
            this.carrier.tile(),
            this.spawnWaterTile,
          );
          if (dist <= 2) {
            this.carrier.delete();
            this.active = false;
            return;
          }
          const result = this.pathfinder.next(
            this.carrier.tile(),
            this.spawnWaterTile,
          );
          if (result.status === PathStatus.COMPLETE) {
            this.carrier.delete();
            this.active = false;
            return;
          } else if (result.status === PathStatus.NEXT) {
            this.carrier.move(result.node);
          } else {
            this.carrier.delete();
            this.active = false;
            return;
          }
        }
        break;
      }
    }
  }

  private findNearestEnemyUnit(): Unit | null {
    const tile = this.carrier!.tile();
    let best: Unit | null = null;
    let bestDist = Infinity;
    for (const unit of this.targetPlayer.units()) {
      if (!unit.isActive()) continue;
      const d = this.mg.manhattanDist(tile, unit.tile());
      if (d <= ATTACK_RANGE && d < bestDist) {
        best = unit;
        bestDist = d;
      }
    }
    return best;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
