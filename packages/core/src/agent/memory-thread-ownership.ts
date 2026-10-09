import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { StorageThreadType } from '../memory/types';
import { MASTRA_RESOURCE_ID_KEY } from '../request-context';
import type { RequestContext } from '../request-context';

const OWNERSHIP_RULE = 'A thread can only be used by the resource that owns it.';

type ThreadResourceMismatchInput =
  | { agentName?: string; threadId: string; expectedResourceId: string; actualResourceId: string }
  | { agentName?: string; threadId?: undefined; expectedResourceId: string; actualResourceId: string }
  | { agentName?: string; runId: string; actualResourceId: string };

/**
 * Builds the error raised when a resource tries to use a thread (or run) it does not own.
 */
export function threadResourceMismatchError(input: ThreadResourceMismatchInput): MastraError {
  const agentName = input.agentName ?? '';
  const base = {
    id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH' as const,
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
  };

  if ('runId' in input) {
    return new MastraError({
      ...base,
      details: { agentName, runId: input.runId, actualResourceId: input.actualResourceId },
      text: `Resource "${input.actualResourceId}" was provided but the resource that owns run "${input.runId}" could not be resolved. ${OWNERSHIP_RULE}`,
    });
  }

  if (input.threadId === undefined) {
    return new MastraError({
      ...base,
      details: { agentName, expectedResourceId: input.expectedResourceId, actualResourceId: input.actualResourceId },
      text: `Resource "${input.actualResourceId}" was provided but this session belongs to resource "${input.expectedResourceId}". ${OWNERSHIP_RULE}`,
    });
  }

  return new MastraError({
    ...base,
    details: {
      agentName,
      threadId: input.threadId,
      expectedResourceId: input.expectedResourceId,
      actualResourceId: input.actualResourceId,
    },
    text: `Thread "${input.threadId}" belongs to resource "${input.expectedResourceId}" but resource "${input.actualResourceId}" was provided. ${OWNERSHIP_RULE}`,
  });
}

/**
 * Fails closed when an existing memory thread is used with a resource that does not own it.
 *
 * Threads are scoped to a single resource. Without this check the agent would happily run the
 * model (and tools) for a thread/resource pair that can never read or write that thread's history,
 * so callers could not rely on `Agent.stream()` to reject an invalid pair before execution.
 *
 * Threads stored without a `resourceId` are treated as unowned so pre-existing rows keep working.
 */
export function assertThreadOwnedByResource({
  thread,
  resourceId,
  agentName,
}: {
  thread: StorageThreadType;
  resourceId: string;
  agentName?: string;
}): void {
  if (!thread.resourceId || thread.resourceId === resourceId) return;

  throw threadResourceMismatchError({
    agentName,
    threadId: thread.id,
    expectedResourceId: thread.resourceId,
    actualResourceId: resourceId,
  });
}

/**
 * Rejects a send whose caller context names a different resource than the target.
 *
 * Only the caller's context is checked; a no-op when either the target resource or the
 * context's resource key is unknown.
 */
export function assertRequestContextResourceMatches({
  requestContext,
  resourceId,
  threadId,
  agentName,
}: {
  requestContext?: RequestContext;
  resourceId?: string;
  threadId?: string;
  agentName?: string;
}): void {
  const actualResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
  if (!actualResourceId || !resourceId || actualResourceId === resourceId) return;

  throw threadResourceMismatchError({ agentName, threadId, expectedResourceId: resourceId, actualResourceId });
}
