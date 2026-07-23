export interface ThreadPageReadinessKey {
  resourceId: string;
  projectPath?: string;
  threadId: string;
}

interface PendingKickoff {
  message: string;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface ClaimedThreadKickoff {
  message: string;
  complete: () => void;
  fail: (error: Error) => void;
}

export class ThreadPageKickoffTimeoutError extends Error {}

const pendingKickoffs = new Map<string, PendingKickoff[]>();

function keyOf({ resourceId, projectPath, threadId }: ThreadPageReadinessKey): string {
  return JSON.stringify([resourceId, projectPath ?? '', threadId]);
}

/**
 * Transfers a Factory kickoff across route navigation. The returned promise
 * settles only after the mounted thread finishes dispatching the message.
 */
export function queueThreadPageKickoff(
  key: ThreadPageReadinessKey,
  message: string,
  timeoutMs = 60_000,
): Promise<void> {
  const readinessKey = keyOf(key);
  return new Promise((resolve, reject) => {
    const kickoff: PendingKickoff = {
      message,
      resolve,
      reject,
      timeout: setTimeout(() => {
        const queued = pendingKickoffs.get(readinessKey);
        const remaining = queued?.filter(candidate => candidate !== kickoff) ?? [];
        if (remaining.length > 0) pendingKickoffs.set(readinessKey, remaining);
        else pendingKickoffs.delete(readinessKey);
        reject(
          new ThreadPageKickoffTimeoutError(`Timed out waiting for thread ${key.threadId} to complete its kickoff`),
        );
      }, timeoutMs),
    };
    const queued = pendingKickoffs.get(readinessKey) ?? [];
    queued.push(kickoff);
    pendingKickoffs.set(readinessKey, queued);
  });
}

/** Claims all kickoffs queued for this exact mounted session/thread. */
export function claimThreadPageKickoffs(key: ThreadPageReadinessKey): ClaimedThreadKickoff[] {
  const readinessKey = keyOf(key);
  const kickoffs = pendingKickoffs.get(readinessKey) ?? [];
  pendingKickoffs.delete(readinessKey);
  return kickoffs.map(kickoff => ({
    message: kickoff.message,
    complete: () => {
      clearTimeout(kickoff.timeout);
      kickoff.resolve();
    },
    fail: error => {
      clearTimeout(kickoff.timeout);
      kickoff.reject(error);
    },
  }));
}
