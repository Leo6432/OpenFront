import { html, LitElement, svg } from "lit";
import { customElement, state } from "lit/decorators.js";
import { assetUrl } from "../../../core/AssetUrls";
import { EventBus } from "../../../core/EventBus";
import { UnitType } from "../../../core/game/Game";
import { GameView } from "../../../core/game/GameView";
import { Controller } from "../../Controller";
import { SellEnergyIntentEvent } from "../../Transport";
import { renderNumber, translateText } from "../../Utils";

const nuclearIcon = assetUrl("images/NuclearPowerPlantIconWhite.svg");

const GOLD_PER_ENERGY = 10_000n;
const HISTORY_LEN = 60;

@customElement("energy-display")
export class EnergyDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private _energy = 0n;
  @state() private _plantCount = 0;
  @state() private _isVisible = false;

  private _history: number[] = [];

  createRenderRoot() {
    return this;
  }

  init() {}

  tick() {
    const player = this.game?.myPlayer();
    if (!player || !player.isAlive() || this.game.inSpawnPhase()) {
      this._isVisible = false;
      return;
    }
    this._plantCount = player
      .units(UnitType.NuclearPowerPlant)
      .filter((u) => !u.isUnderConstruction()).length;
    if (this._plantCount === 0 && this._energy === 0n) {
      this._isVisible = false;
      return;
    }
    this._isVisible = true;
    this._energy = player.energy();

    this._history.push(Number(this._energy));
    if (this._history.length > HISTORY_LEN) {
      this._history.shift();
    }
    this.requestUpdate();
  }

  private sell() {
    if (this._energy <= 0n) return;
    this.eventBus.emit(new SellEnergyIntentEvent());
  }

  private renderSparkline() {
    if (this._history.length < 2) return svg``;
    const W = 160;
    const H = 36;
    const max = Math.max(...this._history, 1);
    const pts = this._history
      .map((v, i) => {
        const x = (i / (HISTORY_LEN - 1)) * W;
        const y = H - (v / max) * H;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    return svg`
      <svg width="${W}" height="${H}" class="block">
        <polyline
          points="${pts}"
          fill="none"
          stroke="#34d399"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  render() {
    if (!this._isVisible) return html``;

    const goldOnSell = this._energy * GOLD_PER_ENERGY;
    const canSell = this._energy > 0n;

    return html`
      <div
        class="bg-gray-800/92 backdrop-blur-sm rounded-tl-lg lg:rounded-lg shadow-lg p-2 pointer-events-auto flex flex-col gap-1 min-w-[180px]"
      >
        <!-- Header: icon + energy count -->
        <div class="flex items-center gap-1.5">
          <img src=${nuclearIcon} class="size-4 opacity-80" />
          <span class="text-green-400 font-bold text-sm"
            >${renderNumber(Number(this._energy))}</span
          >
          <span class="text-gray-400 text-xs"
            >${translateText("energy_display.energy")}</span
          >
          ${this._plantCount > 0
            ? html`<span class="text-gray-500 text-xs ml-auto"
                >+${renderNumber(this._plantCount * 10)}/tick</span
              >`
            : html``}
        </div>

        <!-- Sparkline -->
        <div class="rounded overflow-hidden bg-gray-900/60 px-1 py-0.5">
          ${this.renderSparkline()}
        </div>

        <!-- Sell row -->
        <div class="flex items-center gap-1.5">
          <span class="text-yellow-300 text-xs flex-1"
            >= ${renderNumber(Number(goldOnSell))} 💰</span
          >
          <button
            class="${canSell
              ? "bg-green-600 hover:bg-green-500 cursor-pointer"
              : "bg-gray-600 opacity-40 cursor-not-allowed"} text-white text-xs font-bold px-2 py-0.5 rounded transition-colors"
            @click=${() => this.sell()}
            ?disabled=${!canSell}
          >
            ${translateText("energy_display.sell")}
          </button>
        </div>
      </div>
    `;
  }
}
