import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { FactoryAuthUser } from '../auth.js';
import { getFactoryAuthOrgId } from '../auth.js';
import type { FactoryRunBindingAddress, FactoryRunBindingSessionAddress } from '../storage/domains/work-items/base.js';

interface FactorySessionState {
  factoryProjectId?: string;
}

export function getFactorySessionCoordinates(
  requestContext: RequestContext | undefined,
): FactoryRunBindingSessionAddress | null {
  if (!requestContext || typeof requestContext.get !== 'function') return null;
  const context = requestContext.get('controller') as AgentControllerRequestContext<FactorySessionState> | undefined;
  const factoryProjectId = context?.getState().factoryProjectId;
  if (!context?.threadId || !context.resourceId || !factoryProjectId) return null;
  return {
    factoryProjectId,
    threadId: context.threadId,
    resourceId: context.resourceId,
    sessionId: context.resourceId,
  };
}

export function getFactorySessionAddress(requestContext: RequestContext | undefined): FactoryRunBindingAddress | null {
  const coordinates = getFactorySessionCoordinates(requestContext);
  if (!coordinates || !requestContext || typeof requestContext.get !== 'function') return null;
  const user = requestContext.get('user') as FactoryAuthUser | undefined;
  const orgId = getFactoryAuthOrgId(user);
  if (!orgId) return null;
  return { orgId, ...coordinates };
}
