import { deriveAgentRunRequestContext, resolveAgentScopes } from '../../agent/scopes';
import { RequestContext } from '../../request-context';

/**
 * The tool context a real Agent run hands Knowledge for `scopes`: resolved by `resolveAgentScopes`,
 * so `resource:`/`thread:` become the run's Memory ids and only the other scopes stay on the
 * request context.
 */
export function agentRunContext(agentId: string, scopes: string[]) {
  const requestContext = new RequestContext();
  const resolved = resolveAgentScopes({ requestContext, callScopes: scopes });
  return {
    requestContext: deriveAgentRunRequestContext(requestContext, resolved.scopes),
    agent: { agentId, resourceId: resolved.resourceId, threadId: resolved.threadId },
  };
}
