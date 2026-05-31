export interface PendingInvite {
  fromPublicId: string;
  fromUsername: string;
  gameId: string;
  gameUrl: string;
  createdAt: number;
}

const TTL_MS = 5 * 60 * 1000;

export class InviteService {
  private readonly store = new Map<string, PendingInvite[]>();

  constructor() {
    setInterval(() => this.cleanup(), 60_000).unref();
  }

  add(toPublicId: string, invite: PendingInvite): void {
    const list = this.store.get(toPublicId) ?? [];
    // One invite per (sender, game) — re-invite refreshes timestamp
    const idx = list.findIndex(
      (i) => i.fromPublicId === invite.fromPublicId && i.gameId === invite.gameId,
    );
    if (idx >= 0) {
      list[idx] = invite;
    } else {
      list.push(invite);
    }
    this.store.set(toPublicId, list);
  }

  drain(forPublicId: string): PendingInvite[] {
    const invites = this.store.get(forPublicId) ?? [];
    this.store.delete(forPublicId);
    return invites;
  }

  private cleanup(): void {
    const cutoff = Date.now() - TTL_MS;
    for (const [key, list] of this.store) {
      const fresh = list.filter((i) => i.createdAt > cutoff);
      if (fresh.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, fresh);
      }
    }
  }
}
