export interface ThreadPageReadinessKey {
  resourceId: string;
  projectPath?: string;
  threadId: string;
}

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const waiters = new Map<string, Set<Waiter>>();

function keyOf({ resourceId, projectPath, threadId }: ThreadPageReadinessKey): string {
  return JSON.stringify([resourceId, projectPath ?? '', threadId]);
}

export function waitForThreadPageReady(key: ThreadPageReadinessKey, timeoutMs = 60_000): Promise<void> {
  const readinessKey = keyOf(key);
  return new Promise((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      reject,
      timeout: setTimeout(() => {
        const threadWaiters = waiters.get(readinessKey);
        threadWaiters?.delete(waiter);
        if (threadWaiters?.size === 0) waiters.delete(readinessKey);
        reject(new Error(`Timed out waiting for thread ${key.threadId} to become ready`));
      }, timeoutMs),
    };
    const threadWaiters = waiters.get(readinessKey) ?? new Set();
    threadWaiters.add(waiter);
    waiters.set(readinessKey, threadWaiters);
  });
}

export function markThreadPageReady(key: ThreadPageReadinessKey): void {
  const readinessKey = keyOf(key);
  const threadWaiters = waiters.get(readinessKey);
  if (!threadWaiters) return;
  waiters.delete(readinessKey);
  for (const waiter of threadWaiters) {
    clearTimeout(waiter.timeout);
    waiter.resolve();
  }
}
