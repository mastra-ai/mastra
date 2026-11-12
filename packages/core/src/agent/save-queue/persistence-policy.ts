import type { MessageList } from '../message-list';

interface PersistencePolicy {
  readOnly: boolean;
  trackUndo: boolean;
  authorize: (threadId: string, resourceId?: string) => Promise<void>;
  undo: Array<() => Promise<void>>;
}

// Live run policy must not be serialized into durable message-list state.
const policies = new WeakMap<MessageList, PersistencePolicy>();

export function setPersistencePolicy(messageList: MessageList, policy: Omit<PersistencePolicy, 'undo'>): void {
  policies.set(messageList, { ...policy, undo: [] });
}

export function getPersistencePolicy(messageList: MessageList): PersistencePolicy | undefined {
  return policies.get(messageList);
}

export function inheritPersistencePolicy(source: MessageList, target: MessageList): void {
  const policy = policies.get(source);
  if (policy) policies.set(target, policy);
}

export async function undoProcessorPersistence(messageList: MessageList): Promise<void> {
  const policy = policies.get(messageList);
  if (!policy) return;
  const errors: unknown[] = [];
  for (const undo of policy.undo.splice(0).reverse()) {
    try {
      await undo();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, 'Failed to undo processor persistence');
}
