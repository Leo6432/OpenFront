import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import { assetUrl } from "../../core/AssetUrls";
import { getSelectedLocalAccount } from "../Auth";
import "../LocalAccountModal";
import type { LocalAccountModal } from "../LocalAccountModal";
import { NavNotificationsController } from "./NavNotificationsController";

@customElement("desktop-nav-bar")
export class DesktopNavBar extends LitElement {
  private _notifications = new NavNotificationsController(this);
  @state() private _localAccountName: string | null =
    getSelectedLocalAccount()?.name ?? null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("showPage", this._onShowPage);
    window.addEventListener(
      "localAccountChanged",
      this._onLocalAccountChanged as EventListener,
    );

    const current = window.currentPageId;
    if (current) {
      // Wait for render
      this.updateComplete.then(() => {
        this._updateActiveState(current);
      });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("showPage", this._onShowPage);
    window.removeEventListener(
      "localAccountChanged",
      this._onLocalAccountChanged as EventListener,
    );
  }

  private _onShowPage = (e: Event) => {
    const pageId = (e as CustomEvent).detail;
    this._updateActiveState(pageId);
  };

  private _onLocalAccountChanged = (e: CustomEvent) => {
    this._localAccountName = e.detail.name;
  };

  private _openAccountSelector() {
    const modal = this.querySelector(
      "local-account-modal",
    ) as LocalAccountModal | null;
    modal?.open();
  }

  private _updateActiveState(pageId: string) {
    this.querySelectorAll(".nav-menu-item").forEach((el) => {
      if ((el as HTMLElement).dataset.page === pageId) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  render() {
    window.currentPageId ??= "page-play";
    const currentPage = window.currentPageId;

    return html`
      <nav
        class="hidden lg:flex w-full bg-zinc-900/90 backdrop-blur-md items-center justify-center gap-8 py-4 shrink-0 z-50 relative"
      >
        <div class="flex flex-col items-center justify-center">
          <div class="h-8">
            <img
              class="block h-full aspect-[1364/259]"
              src=${assetUrl("images/OpenFrontLogo.svg")}
              alt="OpenFront"
            />
          </div>
          <div
            id="game-version"
            class="l-header__highlightText text-center"
          ></div>
        </div>
        <button
          class="nav-menu-item ${currentPage === "page-play"
            ? "active"
            : ""} text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
          data-page="page-play"
          data-i18n="main.play"
        ></button>
        <!-- Desktop Navigation Menu Items -->
        <div class="relative">
          <button
            class="nav-menu-item ${currentPage === "page-news"
              ? "active"
              : ""} text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
            data-page="page-news"
            data-i18n="main.news"
            @click=${this._notifications.onNewsClick}
          ></button>
          ${this._notifications.showNewsDot()
            ? html`
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"
                ></span>
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
                ></span>
              `
            : ""}
        </div>
        <div class="relative no-crazygames">
          <button
            class="nav-menu-item ${currentPage === "page-item-store"
              ? "active"
              : ""} text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
            data-page="page-item-store"
            data-i18n="main.store"
            @click=${this._notifications.onStoreClick}
          ></button>
          ${this._notifications.showStoreDot()
            ? html`
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"
                ></span>
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"
                ></span>
              `
            : ""}
        </div>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
          data-page="page-settings"
          data-i18n="main.settings"
        ></button>
        <button
          class="nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
          data-page="page-leaderboard"
          data-i18n="main.leaderboard"
        ></button>
        <button
          class="nav-menu-item text-white/70 hover:text-blue-500 font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-blue-500"
          data-page="page-clan"
          data-i18n="main.clans"
        ></button>
        <div class="relative">
          <button
            class="nav-menu-item text-white/70 hover:text-malibu-blue  font-medium tracking-wider uppercase cursor-pointer transition-colors [&.active]:text-malibu-blue "
            data-page="page-help"
            data-i18n="main.help"
            @click=${this._notifications.onHelpClick}
          ></button>
          ${this._notifications.showHelpDot()
            ? html`
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-ping"
                ></span>
                <span
                  class="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full"
                ></span>
              `
            : ""}
        </div>
        <button
          id="nav-account-button"
          @click=${() => this._openAccountSelector()}
          class="no-crazygames relative h-10 rounded-full flex items-center justify-center gap-2 px-4 cursor-pointer transition-all
            ${this._localAccountName
              ? "bg-blue-600/20 border border-blue-500/40 text-blue-300 hover:bg-blue-600/30"
              : "bg-transparent border border-white/20 text-white/80 hover:text-white"}"
        >
          <svg
            class="w-4 h-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M20 21a8 8 0 0 0-16 0" />
            <path d="M12 13a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
          </svg>
          <span class="text-sm font-semibold">
            ${this._localAccountName ?? "Joueur"}
          </span>
        </button>
        <local-account-modal></local-account-modal>
      </nav>
    `;
  }
}
