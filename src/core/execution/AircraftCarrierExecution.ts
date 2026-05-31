import { Execution, Game, Player, PlayerID, Unit, UnitType } from "../game/Game";
import { TileRef } from "../game/GameMap";
import { targetTransportTile } from "../game/TransportShipUtils";
import { WaterPathFinder } from "../pathfinding/PathFinder";
import { PathStatus } from "../pathfinding/types";
import { ShellExecution } from "./ShellExecution";

const CARRIER_COST = 10_000_000n;
// 20 seconds of bombardment (10 ticks/s × 20 s)
const ATTACK_DURATION = 200;
// Fire a shell every 4 ticks (~2.5/s per carrier)
const FIRE_RATE = 4;
// Carrier fires at units within this tile range
const ATTACK_RANGE = 18;

export class AircraftCarrierExecution implements Execution {
  private active = true;
  private carrier: Unit | null = null;
  private phase: "navigate" | "attack" | "retreat" = "navigate";
  private attackTicks = 0;
  private lastShot = -999;
  private homeTile!: TileRef;
  private dstTile!: TileRef;
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

    // Find an enemy coastal tile to navigate toward
    const borderTiles = Array.from(this.targetPlayer.borderTiles());
    if (borderTiles.length === 0) {
      this.active = false;
      return;
    }

    let dst: TileRef | null = null;
    for (const bt of borderTiles) {
      dst = targetTransportTile(mg, bt);
      if (dst !== null) break;
    }
    if (dst === null) {
      this.active = false;
      return;
    }
    this.dstTile = dst;

    // Find a spawn tile for the carrier (water adjacent to sender, connected to target)
    const spawnTile = this.sender.canBuild(UnitType.Warship, this.dstTile);
    if (spawnTile === false) {
      this.active = false;
      return;
    }
    this.homeTile = spawnTile;

    this.sender.removeGold(CARRIER_COST);

    this.carrier = this.sender.buildUnit(UnitType.Warship, spawnTile, {
      patrolTile: this.dstTile,
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
        const dist = this.mg.manhattanDist(this.carrier.tile(), this.dstTile);
        if (dist <= 4) {
          this.phase = "attack";
          return;
        }
        const result = this.pathfinder.next(this.carrier.tile(), this.dstTile);
        if (result.status === PathStatus.COMPLETE) {
          this.phase = "attack";
        } else if (result.status === PathStatus.NEXT) {
          this.carrier.move(result.node);
        } else {
          // No path — carrier lost at sea
          this.carrier.delete();
          this.active = false;
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
        const dist = this.mg.manhattanDist(this.carrier.tile(), this.homeTile);
        if (dist <= 2) {
          this.carrier.delete();
          this.active = false;
          return;
        }
        const result = this.pathfinder.next(
          this.carrier.tile(),
          this.homeTile,
        );
        if (result.status === PathStatus.COMPLETE) {
          this.carrier.delete();
          this.active = false;
        } else if (result.status === PathStatus.NEXT) {
          this.carrier.move(result.node);
        } else {
          this.carrier.delete();
          this.active = false;
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
      if (!unit.isActive() || !unit.hasHealth()) continue;
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
