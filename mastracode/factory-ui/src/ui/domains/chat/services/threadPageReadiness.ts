export interface ThreadPageReadinessKey {
  resourceId: string;
  projectPath?: string;
  threadId: string;
}

interface PendingKickoff {
  message: string;
  echoOwner: string | null;
  resolve: () => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export interface ClaimedThreadKickoff {
  message: string;
  complete: () => void;
  fail: (error: Error) => void;
}

export interface QueueThreadPageKickoffOptions {
  echoOwner?: string | null;
  timeoutMs?: number;
}

export class ThreadPageKickoffTimeoutError extends Error {}

const pendingKickoffs = new Map<string, PendingKickoff[]>();

function keyOf({ resourceId, projectPath, threadId }: ThreadPageReadinessKey): string {
  return JSON.stringify([resourceId, projectPath ?? '', threadId]);
}

/** Queues a message until its mounted thread is online, then resolves after dispatch. */
export function queueThreadPageKickoff(
  key: ThreadPageReadinessKey,
  message: string,
  { echoOwner = null, timeoutMs = 60_000 }: QueueThreadPageKickoffOptions = {},
): Promise<void> {
  const readinessKey = keyOf(key);
  return new Promise((resolve, reject) => {
    const kickoff: PendingKickoff = {
      message,
      echoOwner,
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

/** A remounted transcript lost its local echoes; a new owner id re-echoes them. */
export function adoptThreadPageKickoffEchoes(key: ThreadPageReadinessKey, ownerId: string): string[] {
  const queued = pendingKickoffs.get(keyOf(key)) ?? [];
  const adopted: string[] = [];
  for (const kickoff of queued) {
    if (kickoff.echoOwner === ownerId) continue;
    kickoff.echoOwner = ownerId;
    adopted.push(kickoff.message);
  }
  return adopted;
}

/** Claims all kickoffs queued for this exact mounted session/thread. Claiming disarms the preparation timeout. */
export function claimThreadPageKickoffs(key: ThreadPageReadinessKey): ClaimedThreadKickoff[] {
  const readinessKey = keyOf(key);
  const kickoffs = pendingKickoffs.get(readinessKey) ?? [];
  pendingKickoffs.delete(readinessKey);
  return kickoffs.map(kickoff => {
    clearTimeout(kickoff.timeout);
    return {
      message: kickoff.message,
      complete: kickoff.resolve,
      fail: kickoff.reject,
    };
  });
}
