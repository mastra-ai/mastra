import type {
  BehaviorDueWork,
  BehaviorRuntimeRecord,
  BehaviorRuntimeStore,
  BehaviorThreadKey,
  BehaviorTransactionResult,
} from './types.js';

const clone = <T>(value: T): T => structuredClone(value);
const keyOf = ({ threadId, behaviorId }: BehaviorThreadKey) => `${threadId}\0${behaviorId}`;

export class InMemoryBehaviorRuntimeStore implements BehaviorRuntimeStore {
  private readonly records = new Map<string, BehaviorRuntimeRecord>();
  private readonly tails = new Map<string, Promise<void>>();

  async init(): Promise<void> {}

  async readThread(key: BehaviorThreadKey): Promise<BehaviorRuntimeRecord | undefined> {
    const value = this.records.get(keyOf(key));
    return value ? clone(value) : undefined;
  }

  async transactThread<T>(
    key: BehaviorThreadKey,
    operation: (current: BehaviorRuntimeRecord | undefined) => Promise<BehaviorTransactionResult<T>> | BehaviorTransactionResult<T>,
  ): Promise<{ runtime: BehaviorRuntimeRecord; result: T }> {
    const storageKey = keyOf(key);
    const prior = this.tails.get(storageKey) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const queued = prior.then(() => gate);
    this.tails.set(storageKey, queued);
    await prior;
    try {
      const current = this.records.get(storageKey);
      const { next, result } = await operation(current ? clone(current) : undefined);
      this.records.set(storageKey, clone(next));
      return { runtime: clone(next), result };
    } finally {
      release();
      if (this.tails.get(storageKey) === queued) this.tails.delete(storageKey);
    }
  }

  async listDue(before: Date, limit = 100): Promise<BehaviorDueWork[]> {
    return [...this.records.values()]
      .filter(record => record.status === 'active' && record.nextCheckAt && record.nextCheckAt <= before.toISOString())
      .sort((a, b) => a.nextCheckAt!.localeCompare(b.nextCheckAt!))
      .slice(0, limit)
      .map(record => ({ threadId: record.threadId, behaviorId: record.behaviorId, dueAt: record.nextCheckAt! }));
  }
}
