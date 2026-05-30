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
const HISTORY_LEN = 120;

@customElement("energy-display")
export class EnergyDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private _energy = 0n;
  @state() private _plantCount = 0;
  @state() private _isVisible = false;
  @state() private _expanded = false;

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
    this._expanded = false;
  }

  private toggle() {
    this._expanded = !this._expanded;
  }

  private renderBigChart() {
    if (this._history.length < 2)
      return html`<div
        class="flex items-center justify-center h-24 text-gray-500 text-xs"
      >
        ${translateText("energy_display.no_data")}
      </div>`;

    const W = 320;
    const H = 120;
    const max = Math.max(...this._history, 1);
    const min = Math.min(...this._history, 0);
    const range = max - min || 1;

    const pts = this._history
      .map((v, i) => {
        const x = (i / (HISTORY_LEN - 1)) * W;
        const y = H - ((v - min) / range) * H * 0.9 - H * 0.05;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const lastVal = this._history[this._history.length - 1];
    const firstVal = this._history[0];
    const trending = lastVal >= firstVal;

    return svg`
      <svg width="${W}" height="${H}" class="block w-full">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${trending ? "#34d399" : "#f87171"}" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="${trending ? "#34d399" : "#f87171"}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polyline
          points="${pts} ${W},${H} 0,${H}"
          fill="url(#chartGrad)"
          stroke="none"
        />
        <polyline
          points="${pts}"
          fill="none"
          stroke="${trending ? "#34d399" : "#f87171"}"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  render() {
    if (!this._isVisible) return html``;

    if (this._expanded) {
      const goldOnSell = this._energy * GOLD_PER_ENERGY;
      const canSell = this._energy > 0n;

      return html`
        <div
          class="bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-xl p-3 pointer-events-auto flex flex-col gap-2 w-[340px]"
        >
          <!-- Header -->
          <div class="flex items-center gap-2">
            <img src=${nuclearIcon} class="size-5 opacity-80" />
            <span class="text-green-400 font-bold text-lg flex-1"
              >${renderNumber(Number(this._energy))}</span
            >
            <span class="text-gray-400 text-xs"
              >${translateText("energy_display.energy")}</span
            >
            <button
              class="text-gray-500 hover:text-gray-200 text-lg leading-none ml-2 cursor-pointer"
              @click=${() => this.toggle()}
            >
              ✕
            </button>
          </div>

          <!-- Big chart -->
          <div class="rounded-lg overflow-hidden bg-gray-800/80 px-1 py-1">
            ${this.renderBigChart()}
          </div>

          <!-- Rate info -->
          ${this._plantCount > 0
            ? html`<div class="text-gray-400 text-xs text-center">
                +${renderNumber(this._plantCount * 10)}/tick
                (${this._plantCount}
                ${translateText("energy_display.plants")})
              </div>`
            : html``}

          <!-- Sell row -->
          <div class="flex items-center gap-2">
            <span class="text-yellow-300 text-sm flex-1"
              >= ${renderNumber(Number(goldOnSell))} 💰</span
            >
            <button
              class="${canSell
                ? "bg-green-600 hover:bg-green-500 cursor-pointer"
                : "bg-gray-600 opacity-40 cursor-not-allowed"} text-white text-sm font-bold px-3 py-1 rounded transition-colors"
              @click=${() => this.sell()}
              ?disabled=${!canSell}
            >
              ${translateText("energy_display.sell")}
            </button>
          </div>
        </div>
      `;
    }

    // Compact view — just the energy number
    return html`
      <button
        class="bg-gray-800/90 backdrop-blur-sm rounded-tl-lg lg:rounded-lg shadow-md px-2 py-1 pointer-events-auto flex items-center gap-1.5 cursor-pointer hover:bg-gray-700/90 transition-colors"
        @click=${() => this.toggle()}
      >
        <img src=${nuclearIcon} class="size-4 opacity-80" />
        <span class="text-green-400 font-bold text-sm"
          >${renderNumber(Number(this._energy))}</span
        >
      </button>
    `;
  }
}
