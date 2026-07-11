import type { NormalizedBehaviorDefinition, NormalizedBehaviorTransition } from '../definition/types.js';
import type {
  BehaviorGuardEvaluator,
  BehaviorRuntimeRecord,
  BehaviorRuntimeStore,
  BehaviorThreadStateMirror,
  BehaviorTransitionJudge,
} from './types.js';

export const behaviorThreadStateType = (behaviorId: string) => `@mastra/behaviors:${behaviorId}`;

export class BehaviorTransitionError extends Error {}

export type BehaviorTransitionEngineOptions = {
  definition: NormalizedBehaviorDefinition;
  store: BehaviorRuntimeStore;
  guards?: Record<string, BehaviorGuardEvaluator>;
  judge?: BehaviorTransitionJudge;
  judgeTimeoutMs?: number;
  mirror?: BehaviorThreadStateMirror;
  now?: () => Date;
};

export class BehaviorTransitionEngine {
  private readonly now: () => Date;
  constructor(private readonly options: BehaviorTransitionEngineOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async initialize(threadId: string): Promise<BehaviorRuntimeRecord> {
    const key = { threadId, behaviorId: this.options.definition.id };
    const committed = await this.options.store.transactThread(key, current => {
      if (current) return { next: this.reconcile(current), result: undefined };
      const enteredAt = this.now().toISOString();
      const initial = this.options.definition.states[this.options.definition.initialState]!;
      return {
        next: {
          threadId,
          behaviorId: this.options.definition.id,
          definitionVersion: this.options.definition.version,
          revision: 1,
          status: 'active' as const,
          activeState: initial.id,
          enteredAt,
          transitionHistory: [],
          conditionState: {},
          checkpoints: {},
          judgeResults: {},
          nextCheckAt: initial.periodic ? new Date(this.now().getTime() + initial.periodic.intervalMs).toISOString() : undefined,
          audit: {},
        },
        result: undefined,
      };
    });
    await this.mirror(committed.runtime);
    return committed.runtime;
  }

  async transition(input: {
    threadId: string;
    name: string;
    idempotencyKey?: string;
    signal?: AbortSignal;
  }): Promise<BehaviorRuntimeRecord> {
    const key = { threadId: input.threadId, behaviorId: this.options.definition.id };
    const current = (await this.options.store.readThread(key)) ?? (await this.initialize(input.threadId));
    if (current.status !== 'active') throw new BehaviorTransitionError(`Behavior is ${current.status}`);
    if (current.definitionVersion !== this.options.definition.version) {
      throw new BehaviorTransitionError('Behavior definition changed; initialize to reconcile state first');
    }
    const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
    if (current.transitionHistory.some(item => item.id === idempotencyKey)) return current;

    const state = this.options.definition.states[current.activeState];
    const transition = state?.transitions.find(item => item.target === input.name);
    if (!state || !transition) {
      throw new BehaviorTransitionError(`Behavior "${input.name}" is not available from "${current.activeState}"`);
    }
    await this.evaluateGuards(current, transition);
    const judgeResult = transition.judge ? await this.evaluateJudge(current, transition, input.signal) : undefined;

    const committed = await this.options.store.transactThread(key, latest => {
      if (!latest || latest.revision !== current.revision || latest.definitionVersion !== current.definitionVersion) {
        throw new BehaviorTransitionError('Stale transition result');
      }
      if (judgeResult && !judgeResult.approved) throw new BehaviorTransitionError(judgeResult.reason ?? 'Transition rejected by judge');
      const now = this.now().toISOString();
      const target = this.options.definition.states[transition.target]!;
      const next: BehaviorRuntimeRecord = {
        ...latest,
        revision: latest.revision + 1,
        status: 'active',
        activeState: target.id,
        intent: undefined,
        enteredAt: now,
        nextCheckAt: target.periodic
          ? new Date(this.now().getTime() + target.periodic.intervalMs).toISOString()
          : undefined,
        judgeResults: judgeResult ? { ...latest.judgeResults, [idempotencyKey]: judgeResult } : latest.judgeResults,
        transitionHistory: [
          ...latest.transitionHistory,
          {
            id: idempotencyKey,
            transitionId: transition.id,
            from: latest.activeState,
            to: target.id,
            at: now,
            revision: latest.revision + 1,
            reason: judgeResult?.reason,
          },
        ],
      };
      return { next, result: undefined };
    });
    await this.mirror(committed.runtime);
    return committed.runtime;
  }

  private reconcile(record: BehaviorRuntimeRecord): BehaviorRuntimeRecord {
    if (record.definitionVersion === this.options.definition.version) return record;
    if (this.options.definition.states[record.activeState]) {
      return {
        ...record,
        definitionVersion: this.options.definition.version,
        revision: record.revision + 1,
        nextCheckAt: this.nextCheckAt(record.activeState),
      };
    }
    const mapped = this.options.definition.migrations[record.activeState];
    if (mapped) {
      return {
        ...record,
        activeState: mapped,
        definitionVersion: this.options.definition.version,
        revision: record.revision + 1,
        enteredAt: this.now().toISOString(),
        nextCheckAt: this.nextCheckAt(mapped),
      };
    }
    return {
      ...record,
      status: 'paused',
      pausedReason: `State "${record.activeState}" was removed without a migration`,
      definitionVersion: this.options.definition.version,
      revision: record.revision + 1,
    };
  }

  private nextCheckAt(stateId: string): string | undefined {
    const periodic = this.options.definition.states[stateId]?.periodic;
    return periodic ? new Date(this.now().getTime() + periodic.intervalMs).toISOString() : undefined;
  }

  private async evaluateGuards(record: BehaviorRuntimeRecord, transition: NormalizedBehaviorTransition): Promise<void> {
    for (const guard of transition.guards) {
      const evaluate = this.options.guards?.[guard.id];
      if (!evaluate) throw new BehaviorTransitionError(`Guard "${guard.id}" has no evaluator`);
      if (!(await evaluate({ record, transition, conditionState: record.conditionState }))) {
        throw new BehaviorTransitionError(`Guard "${guard.id}" rejected the transition`);
      }
    }
  }

  private async evaluateJudge(
    record: BehaviorRuntimeRecord,
    transition: NormalizedBehaviorTransition,
    signal?: AbortSignal,
  ): Promise<{ approved: boolean; reason?: string; metadata?: unknown }> {
    if (!this.options.judge) throw new BehaviorTransitionError('Transition requires a judge');
    const timeout = AbortSignal.timeout(this.options.judgeTimeoutMs ?? 30_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let rejectOnAbort: ((event: Event) => void) | undefined;
    try {
      const judgeResult = this.options.judge({
        definition: this.options.definition,
        record,
        transition,
        judgeInstructions: this.options.definition.states[record.activeState]?.judgeInstructions,
        signal: combined,
      });
      const aborted = new Promise<never>((_, reject) => {
        rejectOnAbort = () => reject(combined.reason ?? new Error('Judge timed out'));
        combined.addEventListener('abort', rejectOnAbort, { once: true });
      });
      return await Promise.race([judgeResult, aborted]);
    } catch (error) {
      throw new BehaviorTransitionError(`Judge failed closed: ${String(error)}`);
    } finally {
      if (rejectOnAbort) combined.removeEventListener('abort', rejectOnAbort);
    }
  }

  private async mirror(record: BehaviorRuntimeRecord): Promise<void> {
    await this.options.mirror?.setState({
      threadId: record.threadId,
      type: behaviorThreadStateType(record.behaviorId),
      value: record,
    });
  }
}
