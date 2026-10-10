import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { RequestContext } from '@mastra/core/request-context';

// `MASTRA_SCOPES_KEY` from `@mastra/core/request-context`, read by string so this package
// keeps its `@mastra/core` peer floor.
const SCOPES_KEY = 'mastra__scopes';

/**
 * A resumed run keeps the scopes it started with. Scopes re-supplied on resume (request
 * context or `scopes` option) may only repeat scopes the suspended run held, or name its own
 * resource and thread; anything else throws. The resumed run then acts with the saved set.
 * Runs that never had scopes are left unchanged.
 */
export function keepSuspendedRunScopes(
  snapshot: any,
  requestContext: Record<string, any>,
  resumeOptions: { requestContext?: RequestContext<any>; scopes?: string[] } | undefined,
): void {
  const saved: unknown = snapshot?.requestContext?.[SCOPES_KEY];
  const fromContext: unknown = resumeOptions?.requestContext?.get(SCOPES_KEY);
  const supplied = [
    ...(Array.isArray(fromContext) ? fromContext : []),
    ...(Array.isArray(resumeOptions?.scopes) ? resumeOptions.scopes : []),
  ];
  if (!Array.isArray(saved) && supplied.length === 0) return;

  const held = new Set(Array.isArray(saved) ? saved : []);
  const memoryInfo = snapshot?.context?.input?.messageListState?.memoryInfo;
  for (const scope of supplied) {
    if (held.has(scope)) continue;
    // Mirrors `parseAgentScope` in @mastra/core (split on the first colon); Core validates the grammar.
    const separator = typeof scope === 'string' ? scope.indexOf(':') : -1;
    const type = separator > 0 ? scope.slice(0, separator) : undefined;
    const value = separator > 0 ? scope.slice(separator + 1) : undefined;
    if (
      (type === 'resource' && value === memoryInfo?.resourceId) ||
      (type === 'thread' && value === memoryInfo?.threadId)
    ) {
      continue;
    }
    throw new MastraError({
      id: 'AGENT_SCOPES_CONFLICT',
      domain: ErrorDomain.AGENT,
      category: ErrorCategory.USER,
      text: `Agent scope "${String(scope)}" was not part of the suspended run's scopes. A resumed run keeps the scopes it started with.`,
      details: { status: 400 },
    });
  }

  if (Array.isArray(saved)) {
    requestContext[SCOPES_KEY] = saved;
  } else {
    delete requestContext[SCOPES_KEY];
  }
}
