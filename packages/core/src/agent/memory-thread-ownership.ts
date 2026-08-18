import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { StorageThreadType } from '../memory/types';

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

  throw new MastraError({
    id: 'AGENT_MEMORY_THREAD_RESOURCE_MISMATCH',
    domain: ErrorDomain.AGENT,
    category: ErrorCategory.USER,
    details: {
      agentName: agentName ?? '',
      threadId: thread.id,
      expectedResourceId: thread.resourceId,
      actualResourceId: resourceId,
    },
    text: `Thread "${thread.id}" belongs to resource "${thread.resourceId}" but resource "${resourceId}" was provided. A thread can only be used by the resource that owns it.`,
  });
}
