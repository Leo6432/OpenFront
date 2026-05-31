import {
  Execution,
  Game,
  Player,
  PlayerID,
  Unit,
  UnitType,
} from "../game/Game";
import { ShellExecution } from "./ShellExecution";

const JET_COST = 10_000_000n;
// Fire a volley of missiles every other tick.
const FIRE_INTERVAL = 2;
// Number of missiles launched per volley.
const MISSILES_PER_VOLLEY = 3;
// Enemy units within this Manhattan distance of the jet are bombarded.
const FIRE_RANGE = 60;
// The jet should cross the whole map in roughly this many ticks (~15s).
const CROSS_TICKS = 150;

/**
 * FighterJetExecution
 *
 * Launches a fighter jet from the sender's territory. The jet flies in a
 * straight horizontal line across the entire map (from the left edge to the
 * right edge) at the latitude of the target player, drawing a thin trail as
 * it goes. Along the way it launches volleys of missiles (shells) at any
 * nearby enemy units.
 *
 * The jet body reuses the lightweight `Shell` unit type, which the renderer
 * already draws with a two-pixel trail — giving the requested thin line that
 * sweeps across the map.
 */
export class FighterJetExecution implements Execution {
  private active = true;
  private jet: Unit | null = null;
  private mg!: Game;
  private targetPlayer!: Player;

  private flightY = 0;
  private currentX = 0;
  private step = 3;
  private lastVolley = -999;

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
    if (this.sender.gold() < JET_COST) {
      this.active = false;
      return;
    }

    // Fly across the latitude of the target's territory so the jet passes
    // over the enemy. Use the centroid of the target's owned tiles.
    const tiles = this.targetPlayer.tiles();
    if (tiles.size === 0) {
      this.active = false;
      return;
    }
    let sumY = 0;
    for (const t of tiles) {
      sumY += mg.y(t);
    }
    this.flightY = Math.min(
      mg.height() - 1,
      Math.max(0, Math.round(sumY / tiles.size)),
    );

    // Cross the whole map width in roughly CROSS_TICKS ticks.
    this.step = Math.max(2, Math.ceil(mg.width() / CROSS_TICKS));

    this.sender.removeGold(JET_COST);

    // Spawn the jet at the left edge of the map on its flight latitude.
    this.currentX = 0;
    const spawn = mg.ref(0, this.flightY);
    this.jet = this.sender.buildUnit(UnitType.Shell, spawn, {});
  }

  tick(ticks: number): void {
    if (!this.jet?.isActive()) {
      this.active = false;
      return;
    }

    // Bombard nearby enemy units.
    if (ticks - this.lastVolley >= FIRE_INTERVAL) {
      const targets = this.findEnemyTargets();
      if (targets.length > 0) {
        this.lastVolley = ticks;
        for (const target of targets) {
          this.mg.addExecution(
            new ShellExecution(
              this.jet.tile(),
              this.sender,
              this.jet,
              target,
            ),
          );
        }
      }
    }

    // Advance the jet across the map.
    this.currentX += this.step;
    const maxX = this.mg.width() - 1;
    if (this.currentX >= maxX) {
      // Reached the far edge of the map — the run is complete.
      this.jet.delete(false);
      this.active = false;
      return;
    }
    this.jet.move(this.mg.ref(this.currentX, this.flightY));
  }

  private findEnemyTargets(): Unit[] {
    const tile = this.jet!.tile();
    const inRange: { unit: Unit; dist: number }[] = [];
    for (const unit of this.targetPlayer.units()) {
      if (!unit.isActive()) continue;
      const d = this.mg.manhattanDist(tile, unit.tile());
      if (d <= FIRE_RANGE) {
        inRange.push({ unit, dist: d });
      }
    }
    inRange.sort((a, b) => a.dist - b.dist);
    return inRange.slice(0, MISSILES_PER_VOLLEY).map((e) => e.unit);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
