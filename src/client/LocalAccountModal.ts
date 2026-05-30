import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
  LOCAL_ACCOUNTS,
  getSelectedLocalAccount,
  selectLocalAccount,
} from "./Auth";

@customElement("local-account-modal")
export class LocalAccountModal extends LitElement {
  @state() private isOpen = false;
  @state() private selectedId: string | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.selectedId = getSelectedLocalAccount()?.id ?? null;
    window.addEventListener(
      "localAccountChanged",
      this.onAccountChanged as EventListener,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(
      "localAccountChanged",
      this.onAccountChanged as EventListener,
    );
  }

  private onAccountChanged = (e: CustomEvent) => {
    this.selectedId = e.detail.id;
  };

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  private selectAccount(id: string) {
    selectLocalAccount(id);
    this.selectedId = id;
    this.close();
    window.location.reload();
  }

  render() {
    if (!this.isOpen) return html``;

    return html`
      <div
        class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center"
        @click=${(e: Event) => {
          if (e.target === e.currentTarget) this.close();
        }}
      >
        <div
          class="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-80 shadow-2xl"
        >
          <h2 class="text-white text-xl font-bold text-center mb-1">
            Choisir un joueur
          </h2>
          <p class="text-white/40 text-sm text-center mb-5">
            Serveur privé — Léo, Paul, Guillaume
          </p>

          <div class="flex flex-col gap-3">
            ${LOCAL_ACCOUNTS.map(
              (account) => html`
                <button
                  @click=${() => this.selectAccount(account.id)}
                  class="w-full py-3 px-4 rounded-xl font-semibold text-base transition-all
                    ${this.selectedId === account.id
                      ? "bg-blue-600 text-white border-2 border-blue-400"
                      : "bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 hover:text-white"}"
                >
                  ${account.name}
                  ${this.selectedId === account.id
                    ? html`<span class="ml-2 text-blue-200 text-sm">✓ actif</span>`
                    : ""}
                </button>
              `,
            )}
          </div>

          <button
            @click=${() => this.close()}
            class="mt-4 w-full py-2 text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    `;
  }
}
