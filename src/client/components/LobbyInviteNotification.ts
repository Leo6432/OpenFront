import { html, LitElement } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { IncomingInvite } from "../InvitePolling";
import { LobbyInviteEvent } from "../InvitePolling";
import { translateText } from "../Utils";

interface ActiveInvite extends IncomingInvite {
  id: number;
}

@customElement("lobby-invite-notification")
export class LobbyInviteNotification extends LitElement {
  createRenderRoot() {
    return this;
  }

  @state() private invites: ActiveInvite[] = [];
  private nextId = 0;

  private readonly onInvite = (e: Event) => {
    const invite = (e as LobbyInviteEvent).invite;
    const active: ActiveInvite = { ...invite, id: this.nextId++ };
    this.invites = [...this.invites, active];
    // Auto-dismiss after 30 s
    setTimeout(() => this.dismiss(active.id), 30_000);
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("lobby-invite", this.onInvite);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("lobby-invite", this.onInvite);
  }

  private dismiss(id: number): void {
    this.invites = this.invites.filter((i) => i.id !== id);
  }

  private accept(invite: ActiveInvite): void {
    this.dismiss(invite.id);
    window.location.href = invite.gameUrl;
  }

  render() {
    if (this.invites.length === 0) return html``;

    return html`
      <div
        class="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-auto"
        style="max-width:320px"
      >
        ${this.invites.map(
          (inv) => html`
            <div
              class="bg-gray-900 border border-blue-500/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-fade-in"
            >
              <div class="flex items-start gap-3">
                <span class="text-2xl select-none">🎮</span>
                <div class="flex-1 min-w-0">
                  <p class="text-white font-semibold text-sm leading-snug">
                    ${translateText("invite.notification_title", {
                      username: inv.fromUsername,
                    })}
                  </p>
                  <p class="text-gray-400 text-xs mt-0.5 truncate">
                    ${inv.gameId}
                  </p>
                </div>
                <button
                  class="text-gray-500 hover:text-gray-200 text-lg leading-none cursor-pointer px-1 shrink-0"
                  @click=${() => this.dismiss(inv.id)}
                >
                  ✕
                </button>
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-2 rounded-lg transition-colors cursor-pointer"
                  @click=${() => this.accept(inv)}
                >
                  ${translateText("invite.join")}
                </button>
                <button
                  class="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-2 rounded-lg transition-colors cursor-pointer"
                  @click=${() => this.dismiss(inv.id)}
                >
                  ${translateText("invite.decline")}
                </button>
              </div>
            </div>
          `,
        )}
      </div>
    `;
  }
}
