import type { MessageList } from '@mastra/core/agent';
import type { ObservabilityContext } from '@mastra/core/observability';
import type { ProcessorStreamWriter } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ObservationalMemoryRecord } from '@mastra/core/storage';

import type { ObservationalMemory } from '../observational-memory';
import type { MemoryContextProvider } from '../processor';
import { omTime } from '../timing';
import type { ObservationModelContext } from '../types';

import { ObservationStep } from './step';
import type { ObservationTurnHooks, TurnContext, TurnResult } from './types';

/**
 * Represents a single turn in the agent conversation — one user message → agent response cycle.
 *
 * The turn manages record caching, context loading, and step lifecycle.
 * Create via `om.beginTurn(...)`, then call `start()` to load context,
 * `step(n)` to create steps, and `end()` to finalize.
 *
 * @example
 * ```ts
 * const turn = om.beginTurn({ threadId, resourceId, messageList });
 * await turn.start(memory);
 *
 * const step0 = turn.step(0);
 * const ctx = await step0.prepare();
 * // ... agent generates ...
 *
 * const step1 = turn.step(1);  // finalizes step 0
 * const ctx1 = await step1.prepare();
 * // ... agent generates ...
 *
 * await turn.end();  // finalizes last step, cleanup
 * ```
 */
export class ObservationTurn {
  private _record?: ObservationalMemoryRecord;
  private _context?: TurnContext;
  private _currentStep?: ObservationStep;
  private _started = false;
  private _ended = false;

  /** Generation count at turn start — used to detect if reflection happened during the turn. */
  private _generationCountAtStart = -1;

  /**
   * Per-loop cache of `getOtherThreadsContext` (resource scope only). Lifetime is the
   * agent loop because the turn lives on `state.__omTurn`.
   *
   * Cache key combines `record.generationCount` (bumps on every observation/reflection
   * mutation in this thread) and the engine's global observed-message-id count
   * (bumps on observations in any thread sharing the engine). When either changes
   * we re-fetch.
   */
  private _otherThreadsContextCacheKey?: string;
  private _otherThreadsContextCacheValue?: string | undefined;

  /** Memory context provider — set via start(). Used by steps for beforeBuffer persistence. */
  memory?: MemoryContextProvider;

  /** Optional stream writer for emitting markers. */
  writer?: ProcessorStreamWriter;

  /** Optional request context for observation calls. */
  requestContext?: RequestContext;

  /** Optional observability context for nested OM spans. */
  observabilityContext?: ObservabilityContext;

  /** Current actor model for this step. Updated by the processor before prepare(). */
  actorModelContext?: ObservationModelContext;

  /** Processor-provided hooks for turn/step lifecycle integration. */
  readonly hooks: ObservationTurnHooks;

  constructor(opts: {
    om: ObservationalMemory;
    threadId: string;
    resourceId?: string;
    messageList: MessageList;
    observabilityContext?: ObservabilityContext;
    hooks?: ObservationTurnHooks;
  }) {
    this.om = opts.om;
    this.threadId = opts.threadId;
    this.resourceId = opts.resourceId;
    this.messageList = opts.messageList;
    this.observabilityContext = opts.observabilityContext;
    this.hooks = opts.hooks ?? {};
  }

  readonly om: ObservationalMemory;
  readonly threadId: string;
  readonly resourceId: string | undefined;
  readonly messageList: MessageList;

  /** The current cached record. Refreshed after mutations (activate/observe/reflect). */
  get record(): ObservationalMemoryRecord {
    if (!this._record) throw new Error('Turn not started — call start() first');
    return this._record;
  }

  /** The context loaded during start(). */
  get context(): TurnContext {
    if (!this._context) throw new Error('Turn not started — call start() first');
    return this._context;
  }

  /** The current step, if one exists. */
  get currentStep(): ObservationStep | undefined {
    return this._currentStep;
  }

  addHooks(hooks?: ObservationTurnHooks): void {
    if (!hooks) return;
    Object.assign(this.hooks, hooks);
  }

  /**
   * Load context and cache the record. Call once at the start of the turn.
   *
   * If a MemoryContextProvider is passed, loads historical messages and adds
   * them to the MessageList. Without a provider, only fetches/caches the record.
   */
  async start(memory?: MemoryContextProvider): Promise<TurnContext> {
    if (this._started) throw new Error('Turn already started');
    this._started = true;

    this._record = await omTime('turn.start.getOrCreateRecord', () =>
      this.om.getOrCreateRecord(this.threadId, this.resourceId),
    );
    this._generationCountAtStart = this._record.generationCount;
    this.memory = memory;

    if (memory) {
      const ctx = await omTime('turn.start.memory.getContext', () =>
        memory.getContext({ threadId: this.threadId, resourceId: this.resourceId }),
      );

      // Add historical messages to the MessageList, filtering out system messages
      for (const msg of ctx.messages) {
        if (msg.role !== 'system') {
          this.messageList.add(msg, 'memory');
        }
      }

      this._context = {
        messages: ctx.messages,
        systemMessage: ctx.systemMessage,
        continuation: ctx.continuationMessage,
        otherThreadsContext: ctx.otherThreadsContext,
        record: this._record,
      };
    } else {
      this._context = {
        messages: [],
        systemMessage: undefined,
        continuation: undefined,
        otherThreadsContext: undefined,
        record: this._record,
      };
    }

    return this._context;
  }

  /**
   * Create a step handle. If a previous step exists, it is finalized
   * (its output messages will be saved at the start of the new step's prepare()).
   */
  step(stepNumber: number): ObservationStep {
    if (!this._started) throw new Error('Turn not started — call start() first');
    if (this._ended) throw new Error('Turn already ended');

    this._currentStep = new ObservationStep(this, stepNumber);
    return this._currentStep;
  }

  /**
   * Finalize the turn: save any remaining messages and return the latest record state.
   */
  async end(): Promise<TurnResult> {
    if (this._ended) throw new Error('Turn already ended');
    this._ended = true;

    // Save any unsaved messages from the last step
    const unsavedInput = this.messageList.get.input.db();
    const unsavedOutput = this.messageList.get.response.db();
    const unsavedMessages = [...unsavedInput, ...unsavedOutput];
    if (unsavedMessages.length > 0) {
      await this.om.persistMessages(unsavedMessages, this.threadId, this.resourceId);
    }

    return { record: this._record! };
  }

  /**
   * Replace the cached record with a known-fresh state.
   *
   * Use this after engine writes that already return the post-write record
   * (`om.activate`, `om.observe`, `om.buffer`) instead of refetching from storage.
   * Only accepts records strictly newer than the current cache (compared via
   * `updatedAt`, falling back to `generationCount`) so that a late fire-and-forget
   * `.then` cannot clobber a fresher post-observation record.
   *
   * @internal
   */
  setRecord(record: ObservationalMemoryRecord): void {
    if (this._record && !this.isNewerRecord(record, this._record)) {
      return;
    }
    this._record = record;
  }

  /**
   * Force refresh the cached record from storage.
   *
   * Prefer `setRecord(...)` with the record returned by an engine write — this
   * exists only as an escape hatch for paths where we don't have the fresh
   * record on hand.
   *
   * @internal
   */
  async refreshRecord(): Promise<void> {
    this._record = await omTime('turn.refreshRecord.getOrCreateRecord', () =>
      this.om.getOrCreateRecord(this.threadId, this.resourceId),
    );
  }

  private isNewerRecord(next: ObservationalMemoryRecord, prev: ObservationalMemoryRecord): boolean {
    const nextUpdatedAt = next.updatedAt ? new Date(next.updatedAt).getTime() : 0;
    const prevUpdatedAt = prev.updatedAt ? new Date(prev.updatedAt).getTime() : 0;
    if (nextUpdatedAt !== prevUpdatedAt) return nextUpdatedAt >= prevUpdatedAt;
    return (next.generationCount ?? 0) >= (prev.generationCount ?? 0);
  }

  /**
   * Get cross-thread context for resource scope, using the per-loop cache.
   *
   * Returns a `{ value }` wrapper so callers can pass it directly to `getStatus`'s
   * `otherThreadsContextCache` option (the wrapper distinguishes "no other threads"
   * — `value: undefined` — from "fetch fresh" — no key at all).
   *
   * For non-resource scope, returns `{ value: undefined }` without any DB work.
   * @internal
   */
  async getOrLoadOtherThreadsContext(): Promise<{ value: string | undefined }> {
    if (this.om.scope !== 'resource' || !this.resourceId) {
      return { value: undefined };
    }
    const key = this.otherThreadsContextCacheKey();
    if (this._otherThreadsContextCacheKey === key) {
      return { value: this._otherThreadsContextCacheValue };
    }
    const value = await omTime('turn.refreshOtherThreadsContext.getOtherThreadsContext', () =>
      this.om.getOtherThreadsContext(this.resourceId!, this.threadId),
    );
    this._otherThreadsContextCacheKey = key;
    this._otherThreadsContextCacheValue = value;
    if (this._context) {
      this._context.otherThreadsContext = value;
    }
    return { value };
  }

  /**
   * Refresh cross-thread context for resource scope. Called per-step.
   * Backed by the per-loop cache; only refetches when the cache key changes.
   * @internal
   */
  async refreshOtherThreadsContext(): Promise<string | undefined> {
    const { value } = await this.getOrLoadOtherThreadsContext();
    return value;
  }

  /**
   * Force the next `getOrLoadOtherThreadsContext()` to re-fetch.
   * Called whenever something we know affects unobserved-set membership but doesn't
   * trigger a record generationCount bump (e.g. tests, manual mutation).
   * @internal
   */
  invalidateOtherThreadsContextCache(): void {
    this._otherThreadsContextCacheKey = undefined;
    this._otherThreadsContextCacheValue = undefined;
  }

  private otherThreadsContextCacheKey(): string {
    const generationCount = this._record?.generationCount ?? 0;
    const lastObservedAt = this._record?.lastObservedAt ? new Date(this._record.lastObservedAt).getTime() : 0;
    const observedIdsSize = this.om.observedMessageIds.size;
    return `${generationCount}|${lastObservedAt}|${observedIdsSize}`;
  }
}
