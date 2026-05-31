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

const HISTORY_LEN = 120;
const TICKS_PER_MINUTE = 600;

@customElement("energy-display")
export class EnergyDisplay extends LitElement implements Controller {
  public game: GameView;
  public eventBus: EventBus;

  @state() private _energy = 0n;
  @state() private _plantCount = 0;
  @state() private _isVisible = false;
  @state() private _expanded = false;

  // Live values from the deterministic global energy market.
  @state() private _price = 100;
  @state() private _stock = 0;
  @state() private _consumptionPerTick = 0;
  @state() private _soldLastTick = 0;

  private _tickCounter = 0;
  private _priceHistory: number[] = [];

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

    const market = this.game.energyMarket();
    if (market) {
      this._price = market.price;
      this._stock = market.stock;
      this._consumptionPerTick = market.consumptionPerTick;
      this._soldLastTick = market.soldLastTick;
    }

    // Sample the price into the chart every 3 ticks for a smoother line.
    this._tickCounter++;
    if (this._tickCounter % 3 === 0) {
      this._priceHistory.push(this._price);
      if (this._priceHistory.length > HISTORY_LEN) {
        this._priceHistory.shift();
      }
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

  private renderPriceChart(w: number, h: number) {
    if (this._priceHistory.length < 2) {
      return svg`
        <svg width="${w}" height="${h}" class="block w-full">
          <text x="${w / 2}" y="${h / 2}" text-anchor="middle"
            dominant-baseline="middle" fill="#6b7280" font-size="12">
            ${translateText("energy_display.no_data")}
          </text>
        </svg>`;
    }

    const max = Math.max(...this._priceHistory);
    const min = Math.min(...this._priceHistory);
    const range = max - min || 1;
    const pad = 4;

    const pts = this._priceHistory
      .map((v, i) => {
        const x = pad + (i / (HISTORY_LEN - 1)) * (w - pad * 2);
        const y = pad + (1 - (v - min) / range) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const last = this._priceHistory[this._priceHistory.length - 1];
    const x1 =
      pad +
      ((this._priceHistory.length - 1) / (HISTORY_LEN - 1)) * (w - pad * 2);
    const y1 = pad + (1 - (last - min) / range) * (h - pad * 2);
    const x0 = pad;
    const first = this._priceHistory[0];
    const prev = this._priceHistory[this._priceHistory.length - 2] ?? last;
    const up = last >= prev;
    const color = up ? "#34d399" : "#f87171";

    const fillPts = `${pts} ${x1.toFixed(1)},${(h - pad).toFixed(1)} ${x0.toFixed(1)},${(h - pad).toFixed(1)}`;

    return svg`
      <svg width="${w}" height="${h}" class="block w-full">
        <defs>
          <linearGradient id="eg${up ? "u" : "d"}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <polyline points="${fillPts}" fill="url(#eg${up ? "u" : "d"})" stroke="none"/>
        <polyline points="${pts}" fill="none" stroke="${color}"
          stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="3" fill="${color}"/>
        <!-- Min/max reference lines -->
        <line x1="${pad}" y1="${(h - pad).toFixed(1)}"
              x2="${(w - pad).toFixed(1)}" y2="${(h - pad).toFixed(1)}"
              stroke="#374151" stroke-width="1"/>
        <!-- current price label -->
        <text x="${(w - pad - 2).toFixed(1)}" y="${(y1 - 6).toFixed(1)}"
          text-anchor="end" fill="${color}" font-size="11" font-weight="bold">
          ${this._price.toFixed(0)}
        </text>
      </svg>
    `;
  }

  /** Bar showing global stock vs 1 minute of demand. */
  private renderStockBar() {
    const demandPerMin = this._consumptionPerTick * TICKS_PER_MINUTE;
    // Equilibrium = 30s of demand = half a minute.
    const equilibrium = this._consumptionPerTick * (TICKS_PER_MINUTE / 2);
    const max = Math.max(demandPerMin, equilibrium, this._stock, 1);
    const stockPct = Math.min(100, (this._stock / max) * 100);
    const eqPct = (equilibrium / max) * 100;

    const stockColor =
      this._stock >= equilibrium
        ? "#34d399"
        : this._stock > 0
          ? "#f59e0b"
          : "#f87171";

    return html`
      <div class="bg-gray-900 rounded-xl px-3 py-2 flex flex-col gap-2">
        <!-- Stock bar -->
        <div class="flex items-center justify-between text-xs text-gray-400 mb-0.5">
          <span>${translateText("energy_display.stock_label")}</span>
          <span class="font-bold" style="color:${stockColor}">
            ${renderNumber(this._stock)}
          </span>
        </div>
        <div class="relative h-4 bg-gray-800 rounded overflow-hidden">
          <div
            class="h-full rounded transition-all"
            style="width:${stockPct.toFixed(1)}%;background:${stockColor}"
          ></div>
          <!-- Equilibrium marker -->
          <div
            class="absolute top-0 bottom-0 w-0.5 bg-white/30"
            style="left:${eqPct.toFixed(1)}%"
          ></div>
        </div>
        <!-- Consumption and sold row -->
        <div class="flex gap-3 text-xs">
          <div class="flex-1 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-red-400 shrink-0"></span>
            <span class="text-gray-400">${translateText("energy_display.consumption_label")}</span>
            <span class="text-red-300 font-bold ml-auto">
              ${renderNumber(demandPerMin)}/min
            </span>
          </div>
          <div class="flex-1 flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-green-400 shrink-0"></span>
            <span class="text-gray-400">${translateText("energy_display.sold_label")}</span>
            <span class="text-green-300 font-bold ml-auto">
              ${renderNumber(this._soldLastTick)}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (!this._isVisible) return html``;

    if (this._expanded) {
      const goldOnSell = this._energy * BigInt(Math.round(this._price));
      const canSell = this._energy > 0n;
      const prev = this._priceHistory[this._priceHistory.length - 2] ?? this._price;
      const pct = prev !== 0 ? ((this._price - prev) / prev) * 100 : 0;
      const up = this._price >= prev;

      return html`
        <div
          class="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center"
          @click=${(e: Event) => {
            if (e.target === e.currentTarget) this.toggle();
          }}
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/65 backdrop-blur-sm"
            @click=${() => this.toggle()}
          ></div>

          <!-- Panel -->
          <div
            class="relative bg-gray-950 border border-gray-700 rounded-2xl shadow-2xl p-5 w-full max-w-xl mx-4 flex flex-col gap-3"
            @click=${(e: Event) => e.stopPropagation()}
          >
            <!-- Title row -->
            <div class="flex items-center gap-2">
              <img src=${nuclearIcon} class="size-6 opacity-80" />
              <span class="text-white font-bold text-base flex-1">
                ${translateText("energy_display.market_title")}
              </span>
              <button
                class="text-gray-500 hover:text-gray-200 text-xl leading-none cursor-pointer px-1"
                @click=${() => this.toggle()}
              >
                ✕
              </button>
            </div>

            <!-- Price + delta -->
            <div class="flex items-baseline gap-2">
              <span class="text-3xl font-bold text-white">
                ${this._price.toFixed(0)}
              </span>
              <span
                class="${up ? "text-green-400" : "text-red-400"} text-sm font-semibold"
              >
                ${up ? "▲" : "▼"} ${Math.abs(pct).toFixed(2)}%
              </span>
              <span class="text-gray-500 text-xs ml-auto">
                ${translateText("energy_display.price_index")}
              </span>
            </div>

            <!-- Full-width price chart -->
            <div class="rounded-xl overflow-hidden bg-gray-900 px-1 py-1">
              ${this.renderPriceChart(520, 140)}
            </div>

            <!-- Stock + demand bar -->
            ${this.renderStockBar()}

            <!-- Personal energy + sell row -->
            <div class="flex items-center gap-3 bg-gray-900 rounded-xl px-3 py-2">
              <div class="flex-1">
                <div class="text-gray-400 text-xs mb-0.5">
                  ${translateText("energy_display.sell_label")}
                  <span class="text-gray-600 ml-1">
                    (${renderNumber(Number(this._energy))} × ${this._price.toFixed(0)} 💰)
                  </span>
                </div>
                <div class="text-yellow-300 font-bold text-lg">
                  ${renderNumber(Number(goldOnSell))} 💰
                </div>
              </div>
              <button
                class="${canSell
                  ? "bg-green-600 hover:bg-green-500 cursor-pointer"
                  : "bg-gray-700 opacity-40 cursor-not-allowed"} text-white font-bold px-5 py-2 rounded-lg transition-colors text-sm"
                @click=${() => this.sell()}
                ?disabled=${!canSell}
              >
                ${translateText("energy_display.sell")}
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Compact pill — shows current price and personal energy stock.
    const priceColor =
      this._price <= 30
        ? "text-red-400"
        : this._price >= 200
          ? "text-green-400"
          : "text-yellow-300";
    return html`
      <button
        class="bg-gray-800/90 backdrop-blur-sm rounded-tl-lg lg:rounded-lg shadow-md px-2 py-1 pointer-events-auto flex items-center gap-1.5 cursor-pointer hover:bg-gray-700/90 transition-colors"
        @click=${() => this.toggle()}
      >
        <img src=${nuclearIcon} class="size-4 opacity-80" />
        <span class="text-green-400 font-bold text-sm">
          ${renderNumber(Number(this._energy))}
        </span>
        <span class="text-gray-500 text-xs">|</span>
        <span class="${priceColor} font-bold text-sm">
          ${this._price.toFixed(0)}💰
        </span>
      </button>
    `;
  }
}
