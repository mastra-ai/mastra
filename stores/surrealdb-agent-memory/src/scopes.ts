/**
 * The Agent Memory scopes for a Mastra thread: its resource's region (when the
 * thread has a resource) OR the thread's own region. Writes are tagged with it,
 * and reads use it as the lens, so one user's facts never reach another's prompt.
 */
export function memoryScopes(prefix: string, resourceId: string | undefined, threadId: string): string[][] {
  const scopes: string[][] = [[prefix, 'thread', threadId]];
  if (resourceId) {
    scopes.unshift([prefix, 'resource', resourceId]);
  }
  return scopes;
}

/** Like {@link memoryScopes}, but undefined when there is neither a resource nor a thread. */
export function memoryLens(
  prefix: string,
  resourceId: string | undefined,
  threadId: string | undefined,
): string[][] | undefined {
  if (threadId) return memoryScopes(prefix, resourceId, threadId);
  return resourceId ? [[prefix, 'resource', resourceId]] : undefined;
}
