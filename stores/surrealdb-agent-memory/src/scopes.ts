/**
 * Agent Memory scopes are slash paths, and a trailing `*` makes a path a subtree
 * pattern. Percent-encode ids (including `*`) so a resource or thread id can never
 * add path segments or turn into a wildcard; ordinary ids pass through unchanged.
 */
function segment(id: string): string {
  return encodeURIComponent(id).replace(/\*/g, '%2A');
}

/** The prefix without leading or trailing slashes (a linear scan, not a regex). */
function base(prefix: string): string {
  let start = 0;
  let end = prefix.length;
  while (start < end && prefix[start] === '/') start++;
  while (end > start && prefix[end - 1] === '/') end--;
  return prefix.slice(start, end);
}

/** The scope path of a resource: `<prefix>/resource/<id>`. */
export function resourceScope(prefix: string, resourceId: string): string {
  return `${base(prefix)}/resource/${segment(resourceId)}`;
}

/** The scope path of a thread: `<prefix>/thread/<id>`. */
export function threadScope(prefix: string, threadId: string): string {
  return `${base(prefix)}/thread/${segment(threadId)}`;
}

/**
 * The Agent Memory scopes for a Mastra thread: its resource's path (when the
 * thread has a resource) OR the thread's own path. Writes are tagged with it,
 * and reads use it as the lens, so one user's facts never reach another's prompt.
 */
export function memoryScopes(prefix: string, resourceId: string | undefined, threadId: string): string[][] {
  const scopes: string[][] = [[threadScope(prefix, threadId)]];
  if (resourceId) {
    scopes.unshift([resourceScope(prefix, resourceId)]);
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
  return resourceId ? [[resourceScope(prefix, resourceId)]] : undefined;
}
