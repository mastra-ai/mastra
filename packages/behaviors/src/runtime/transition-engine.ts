import type { BehaviorNode, BehaviorPath, BehaviorResolver } from '../definition/resolver.js';
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
  resolver: BehaviorResolver;
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
    const root = await this.requireNode(this.options.resolver.root);
    const key = { threadId, behaviorId: this.options.resolver.id };
    const committed = await this.options.store.transactThread(key, async current => {
      if (current) return { next: await this.reconcile(current), result: undefined };
      const enteredAt = this.now().toISOString();
      return {
        next: {
          threadId,
          behaviorId: this.options.resolver.id,
          definitionVersion: root.version,
          revision: 1,
          status: 'active' as const,
          activeState: root.id,
          enteredAt,
          transitionHistory: [],
          conditionState: {},
          checkpoints: {},
          judgeResults: {},
          nextCheckAt: this.nextCheckAt(root),
          audit: {},
        },
        result: undefined,
      };
    });
    await this.mirror(committed.runtime);
    return committed.runtime;
  }

  async available(id: BehaviorPath): Promise<readonly BehaviorNode[]> {
    const children = await this.options.resolver.children(id);
    const parentId = this.options.resolver.parent(id);
    const parent = parentId ? await this.options.resolver.resolve(parentId) : undefined;
    return parent && !children.some(node => node.id === parent.id) ? [...children, parent] : children;
  }

  async transition(input: { threadId: string; name: string; idempotencyKey?: string; signal?: AbortSignal }): Promise<BehaviorRuntimeRecord> {
    const key = { threadId: input.threadId, behaviorId: this.options.resolver.id };
    const current = (await this.options.store.readThread(key)) ?? (await this.initialize(input.threadId));
    if (current.status !== 'active') throw new BehaviorTransitionError(`Behavior is ${current.status}`);
    const currentNode = await this.requireNode(current.activeState as BehaviorPath);
    const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();
    if (current.transitionHistory.some(item => item.id === idempotencyKey)) return current;

    const available = await this.available(currentNode.id);
    const destination = available.find(node => node.id === input.name || node.name === input.name || node.id.endsWith(`/${input.name}`));
    if (!destination) throw new BehaviorTransitionError(`Behavior "${input.name}" is not available from "${currentNode.id}"`);
    await this.evaluateGuards(current, currentNode, destination);
    const judgeResult = currentNode.judge ? await this.evaluateJudge(current, currentNode, destination, input.signal) : undefined;

    const committed = await this.options.store.transactThread(key, latest => {
      if (!latest || latest.revision !== current.revision || latest.activeState !== current.activeState) throw new BehaviorTransitionError('Stale transition result');
      if (judgeResult && !judgeResult.approved) throw new BehaviorTransitionError(judgeResult.reason ?? 'Transition rejected by judge');
      const now = this.now().toISOString();
      return {
        next: {
          ...latest,
          revision: latest.revision + 1,
          status: 'active' as const,
          activeState: destination.id,
          definitionVersion: destination.version,
          intent: undefined,
          enteredAt: now,
          nextCheckAt: this.nextCheckAt(destination),
          judgeResults: judgeResult ? { ...latest.judgeResults, [idempotencyKey]: judgeResult } : latest.judgeResults,
          transitionHistory: [...latest.transitionHistory, {
            id: idempotencyKey,
            transitionId: destination.id,
            from: latest.activeState,
            to: destination.id,
            at: now,
            revision: latest.revision + 1,
            reason: judgeResult?.reason,
          }],
        },
        result: undefined,
      };
    });
    await this.mirror(committed.runtime);
    return committed.runtime;
  }

  private async reconcile(record: BehaviorRuntimeRecord): Promise<BehaviorRuntimeRecord> {
    const node = await this.options.resolver.resolve(record.activeState as BehaviorPath);
    if (!node) return { ...record, status: 'paused', pausedReason: `Behavior "${record.activeState}" was removed`, revision: record.revision + 1 };
    if (record.definitionVersion === node.version) return record;
    return { ...record, definitionVersion: node.version, revision: record.revision + 1, nextCheckAt: this.nextCheckAt(node) };
  }

  private nextCheckAt(node: BehaviorNode): string | undefined {
    return node.periodic ? new Date(this.now().getTime() + node.periodic.intervalMs).toISOString() : undefined;
  }

  private async requireNode(id: BehaviorPath): Promise<BehaviorNode> {
    const node = await this.options.resolver.resolve(id);
    if (!node) throw new BehaviorTransitionError(`Behavior "${id}" is unavailable`);
    return node;
  }

  private async evaluateGuards(record: BehaviorRuntimeRecord, current: BehaviorNode, destination: BehaviorNode): Promise<void> {
    for (const guard of current.guards) {
      const evaluate = this.options.guards?.[guard.id];
      if (!evaluate) throw new BehaviorTransitionError(`Guard "${guard.id}" has no evaluator`);
      if (!(await evaluate({ record, destination, conditionState: record.conditionState }))) throw new BehaviorTransitionError(`Guard "${guard.id}" rejected the transition`);
    }
  }

  private async evaluateJudge(record: BehaviorRuntimeRecord, current: BehaviorNode, destination: BehaviorNode, signal?: AbortSignal) {
    if (!this.options.judge) throw new BehaviorTransitionError('Transition requires a judge');
    const timeout = AbortSignal.timeout(this.options.judgeTimeoutMs ?? 30_000);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    let rejectOnAbort: (() => void) | undefined;
    try {
      const result = this.options.judge({ record, current, destination, judgeInstructions: current.judgeInstructions, signal: combined });
      const aborted = new Promise<never>((_, reject) => {
        rejectOnAbort = () => reject(combined.reason ?? new Error('Judge timed out'));
        combined.addEventListener('abort', rejectOnAbort, { once: true });
      });
      return await Promise.race([result, aborted]);
    } finally {
      if (rejectOnAbort) combined.removeEventListener('abort', rejectOnAbort);
    }
  }

  private async mirror(record: BehaviorRuntimeRecord): Promise<void> {
    if (!this.options.mirror) return;
    await this.options.mirror.setState({ threadId: record.threadId, type: behaviorThreadStateType(record.behaviorId), value: record });
  }
}
