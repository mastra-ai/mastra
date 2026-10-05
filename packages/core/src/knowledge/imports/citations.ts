import type {
  KnowledgeCitationEntity,
  KnowledgeCitationRef,
  KnowledgeCitationResolution,
  KnowledgeCitationUnresolvedReason,
  KnowledgeImporterCitationPolicy,
} from './types';

export type KnowledgeCitationTarget =
  | { readonly status: 'usable'; readonly nodeId: string }
  | { readonly status: 'unusable' }
  | { readonly status: 'unbound' };

/** Binding-scoped authority the resolver uses; implemented by the static importer operations. */
export interface KnowledgeCitationHost {
  readonly source: string;
  citationTarget(ref: KnowledgeCitationRef): Promise<KnowledgeCitationTarget>;
  storeCitedEntity(address: string, entity: KnowledgeCitationEntity): Promise<string>;
}

type Outcome = { readonly nodeId: string } | { readonly reason: KnowledgeCitationUnresolvedReason };

class DeadlineExceeded extends Error {}

/**
 * Run-local, bounded resolver for historical entities cited by an import.
 *
 * One ledger is shared by every call in a run: budgets, the deadline, and per-identity outcomes
 * never reset per branch or per call. Only the binding's own source is fetched; other sources
 * resolve solely through bindings their owners already committed, so a dependency never waits on
 * another serialized run.
 */
export class KnowledgeCitationResolver {
  readonly #policy: KnowledgeImporterCitationPolicy;
  readonly #host: () => Promise<KnowledgeCitationHost>;
  readonly #signal: AbortSignal;
  readonly #outcomes = new Map<string, Outcome>();
  readonly #inProgress = new Set<string>();
  readonly #unresolvedReasons = new Map<string, KnowledgeCitationUnresolvedReason>();
  #attempted = 0;
  #deadline: number | undefined;
  #incomplete = false;

  constructor(input: {
    policy: KnowledgeImporterCitationPolicy;
    host: () => Promise<KnowledgeCitationHost>;
    signal: AbortSignal;
  }) {
    this.#policy = input.policy;
    this.#host = input.host;
    this.#signal = input.signal;
  }

  /** True once any required citation in this run was left unresolved. */
  get incomplete(): boolean {
    return this.#incomplete;
  }

  /** Sanitized unresolved counts by reason; never includes source identifiers. */
  unresolvedSummary(): string {
    const counts = new Map<KnowledgeCitationUnresolvedReason, number>();
    for (const reason of this.#unresolvedReasons.values()) counts.set(reason, (counts.get(reason) ?? 0) + 1);
    return [...counts]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(', ');
  }

  async resolve(refs: readonly KnowledgeCitationRef[]): Promise<KnowledgeCitationResolution> {
    if (!Array.isArray(refs)) throw new Error('Knowledge citations must be an array');
    this.#deadline ??= Date.now() + this.#policy.budget.timeoutMs;
    const host = await this.#host();
    const resolved: Array<{ ref: KnowledgeCitationRef; nodeId: string }> = [];
    const unresolved: Array<{ ref: KnowledgeCitationRef; reason: KnowledgeCitationUnresolvedReason }> = [];
    let complete = true;
    for (const raw of refs) {
      const ref = normalizeRef(raw);
      const outcome = await this.#resolveOne(host, ref, 1, () => {
        complete = false;
      });
      if ('nodeId' in outcome) resolved.push({ ref, nodeId: outcome.nodeId });
      else {
        complete = false;
        unresolved.push({ ref, reason: outcome.reason });
      }
    }
    if (!complete) this.#incomplete = true;
    return { resolved, unresolved, complete };
  }

  async #resolveOne(
    host: KnowledgeCitationHost,
    ref: KnowledgeCitationRef,
    depth: number,
    markIncomplete: () => void,
  ): Promise<Outcome> {
    const key = JSON.stringify([ref.source, ref.address]);
    const known = this.#outcomes.get(key);
    if (known) {
      if ('reason' in known) markIncomplete();
      return known;
    }
    if (this.#inProgress.has(key)) {
      const target = await host.citationTarget(ref);
      if (target.status === 'usable') return { nodeId: target.nodeId };
      return this.#report(key, 'cycle', markIncomplete);
    }
    // Depth is per path, so a deeper miss must not hide a shallower reach of the same identity.
    if (depth > this.#policy.budget.maxDepth) return this.#report(key, 'depth', markIncomplete);
    if (this.#attempted >= this.#policy.budget.maxItems) return this.#unresolved(key, 'items', markIncomplete);
    if (Date.now() >= this.#deadline!) return this.#unresolved(key, 'deadline', markIncomplete);
    this.#attempted += 1;

    const target = await host.citationTarget(ref);
    if (target.status === 'usable') return this.#settle(key, { nodeId: target.nodeId });
    // Hidden, deleted, moved, or foreign-source content is indistinguishable from absence.
    if (target.status === 'unusable' || ref.source !== host.source) {
      return this.#unresolved(key, 'unavailable', markIncomplete);
    }

    this.#inProgress.add(key);
    try {
      let entity: KnowledgeCitationEntity | undefined;
      try {
        entity = await this.#fetch(ref.address);
      } catch (error) {
        if (this.#signal.aborted) throw this.#signal.reason;
        return this.#unresolved(key, error instanceof DeadlineExceeded ? 'deadline' : 'error', markIncomplete);
      }
      if (!entity) return this.#unresolved(key, 'unavailable', markIncomplete);
      const nodeId = await host.storeCitedEntity(ref.address, entity);
      const outcome = this.#settle(key, { nodeId });
      for (const citation of entity.citations ?? []) {
        const dependency = await this.#resolveOne(host, normalizeRef(citation), depth + 1, markIncomplete);
        if ('reason' in dependency) markIncomplete();
      }
      return outcome;
    } finally {
      this.#inProgress.delete(key);
    }
  }

  async #fetch(address: string): Promise<KnowledgeCitationEntity | undefined> {
    const remaining = this.#deadline! - Date.now();
    if (remaining <= 0) throw new DeadlineExceeded();
    const deadline = AbortSignal.timeout(remaining);
    const signal = AbortSignal.any([this.#signal, deadline]);
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(deadline.aborted ? new DeadlineExceeded() : this.#signal.reason);
      signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      return await Promise.race([this.#policy.fetch({ address, signal }), aborted]);
    } finally {
      signal.removeEventListener('abort', onAbort!);
    }
  }

  #settle(key: string, outcome: Outcome): Outcome {
    this.#outcomes.set(key, outcome);
    if ('nodeId' in outcome) this.#unresolvedReasons.delete(key);
    return outcome;
  }

  #report(key: string, reason: KnowledgeCitationUnresolvedReason, markIncomplete: () => void): Outcome {
    markIncomplete();
    this.#unresolvedReasons.set(key, reason);
    return { reason };
  }

  #unresolved(key: string, reason: KnowledgeCitationUnresolvedReason, markIncomplete: () => void): Outcome {
    this.#report(key, reason, markIncomplete);
    return this.#settle(key, { reason });
  }
}

function normalizeRef(ref: KnowledgeCitationRef): KnowledgeCitationRef {
  if (!ref || typeof ref !== 'object' || typeof ref.source !== 'string' || typeof ref.address !== 'string') {
    throw new Error('Knowledge citation must have a source and address');
  }
  const source = ref.source.trim();
  const address = ref.address.trim();
  if (!source || !address) throw new Error('Knowledge citation must have a source and address');
  return { source, address };
}
