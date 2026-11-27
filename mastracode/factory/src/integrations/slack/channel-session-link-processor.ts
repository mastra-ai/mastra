import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import { readFactorySessionScope } from '../../rules/binding-context.js';
import { sessionLink } from './channel-reply-processor.js';

export function sessionLinkFromRequest(requestContext: RequestContext): string | undefined {
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.threadId) return undefined;
  return sessionLink({
    threadId: controller.threadId,
    sessionId: controller.sessionId,
    resourceId: controller.resourceId,
    factoryProjectId: readFactorySessionScope(requestContext)?.factoryProjectId,
  });
}
