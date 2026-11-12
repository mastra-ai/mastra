import type { EventCallback, PubSub } from '@mastra/core/events';
import { withAck } from '@mastra/core/events';

import type {
  ResolvedSandboxEnvs,
  SandboxEnvAppliesTo,
  SandboxEnvMetadata,
  SandboxEnvRevisions,
  SandboxEnvStore,
  SetSandboxEnvInput,
} from '../storage/domains/sandbox-envs/base.js';

/** One topic for every Factory: a replica drops its cached entry for the Factory named in the event. */
export const SANDBOX_ENV_CHANGED_TOPIC = 'factory.sandbox-env';

/**
 * How long a revision read is trusted without hearing of a change. With a
 * cross-process event bus, other replicas announce their writes, so this is
 * only a safety net for a missed event. Without one, a write on another
 * replica is only seen when the read expires.
 */
const TRUST_WITH_EVENTS_MS = 60_000;
const TRUST_WITHOUT_EVENTS_MS = 1_000;

type Scope = { orgId: string; projectId: string };

interface Entry {
  at: number;
  revisions: Promise<SandboxEnvRevisions | null>;
  /** Decrypted values, reused while the revision they were read at is current. */
  resolved?: Promise<ResolvedSandboxEnvs>;
}

/**
 * The sandbox-envs store with reads served from memory. The revision is
 * re-read only when a write is announced (by this replica or another one
 * through the event bus) or the read gets old, and values are decrypted again
 * only when the revision changed. Commands and workspace resolves then cost
 * no storage reads while nobody edits a variable.
 *
 * Writes go through to the store, drop this replica's entry and announce the
 * change, so the next command anywhere sees it.
 */
export class CachedSandboxEnvs implements SandboxEnvStore {
  readonly #entries = new Map<string, Entry>();
  readonly #origin = globalThis.crypto.randomUUID();
  readonly #trustMs: number;
  readonly #onEvent: EventCallback = withAck(async event => {
    if (event.runId === this.#origin) return;
    const { orgId, projectId } = (event.data ?? {}) as Partial<Scope>;
    if (typeof orgId === 'string' && typeof projectId === 'string') this.#forget({ orgId, projectId });
  });

  constructor(
    private readonly store: SandboxEnvStore,
    private readonly options: { pubsub?: PubSub; crossProcess?: boolean; now?: () => number } = {},
  ) {
    this.#trustMs = options.crossProcess ? TRUST_WITH_EVENTS_MS : TRUST_WITHOUT_EVENTS_MS;
  }

  /** Listen for other replicas' writes; resolves to the unsubscribe. */
  async subscribe(): Promise<() => Promise<void>> {
    const pubsub = this.options.pubsub;
    if (!pubsub) return async () => {};
    // Without `latest`, a retaining broker replays old changes on boot.
    await pubsub.subscribe(SANDBOX_ENV_CHANGED_TOPIC, this.#onEvent, { startFrom: 'latest' });
    return () => pubsub.unsubscribe(SANDBOX_ENV_CHANGED_TOPIC, this.#onEvent);
  }

  list(orgId: string, projectId: string): Promise<SandboxEnvMetadata[]> {
    return this.store.list(orgId, projectId);
  }

  async set(orgId: string, projectId: string, input: SetSandboxEnvInput, actorId: string) {
    const env = await this.store.set(orgId, projectId, input, actorId);
    this.#changed({ orgId, projectId });
    return env;
  }

  async updateAppliesTo(
    orgId: string,
    projectId: string,
    name: string,
    appliesTo: SandboxEnvAppliesTo,
    actorId: string,
  ) {
    const env = await this.store.updateAppliesTo(orgId, projectId, name, appliesTo, actorId);
    if (env) this.#changed({ orgId, projectId });
    return env;
  }

  async delete(orgId: string, projectId: string, name: string) {
    const deleted = await this.store.delete(orgId, projectId, name);
    if (deleted) this.#changed({ orgId, projectId });
    return deleted;
  }

  revisions(orgId: string, projectId: string): Promise<SandboxEnvRevisions | null> {
    return this.#entry({ orgId, projectId }).revisions;
  }

  async resolve(orgId: string, projectId: string): Promise<ResolvedSandboxEnvs> {
    const entry = this.#entry({ orgId, projectId });
    const current = (await entry.revisions)?.revision ?? '';
    if (entry.resolved) {
      const cached = await entry.resolved.catch(() => undefined);
      if (cached?.revision === current) return cached;
    }
    const resolved = this.store.resolve(orgId, projectId);
    entry.resolved = resolved;
    resolved.then(
      // The values carry their own revision; adopt it so the next call matches instead of decrypting again.
      ({ revision, buildRevision }) => {
        if (revision !== current) entry.revisions = Promise.resolve({ revision, buildRevision });
      },
      // Keep only a read that succeeded.
      () => {
        if (entry.resolved === resolved) entry.resolved = undefined;
      },
    );
    return resolved;
  }

  #entry(scope: Scope): Entry {
    const key = keyOf(scope);
    const now = (this.options.now ?? Date.now)();
    const existing = this.#entries.get(key);
    if (existing && now - existing.at < this.#trustMs) return existing;
    const revisions = this.store.revisions(scope.orgId, scope.projectId);
    // The decrypted values survive a re-read: `resolve` reuses them if the revision didn't move.
    const entry: Entry = { at: now, revisions, ...(existing?.resolved ? { resolved: existing.resolved } : {}) };
    this.#entries.set(key, entry);
    // A failed read is never served from memory.
    revisions.catch(() => {
      if (this.#entries.get(key) === entry) this.#entries.delete(key);
    });
    return entry;
  }

  #forget(scope: Scope): void {
    this.#entries.delete(keyOf(scope));
  }

  #changed(scope: Scope): void {
    this.#forget(scope);
    this.options.pubsub
      ?.publish(SANDBOX_ENV_CHANGED_TOPIC, { type: 'factory.sandbox-env.changed', runId: this.#origin, data: scope })
      .catch((error: unknown) => {
        console.warn('[Factory] Failed to announce a sandbox environment variable change', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }
}

function keyOf(scope: Scope): string {
  return `${scope.orgId}\u0000${scope.projectId}`;
}
