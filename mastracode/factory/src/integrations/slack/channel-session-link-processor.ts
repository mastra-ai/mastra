import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { ChannelThreadLinkProcessor } from '@mastra/core/channels';
import type { RequestContext } from '@mastra/core/request-context';

import { readFactorySessionScope } from '../../rules/binding-context.js';
import { SESSION_LINK_LABEL, sessionLink } from './channel-reply-processor.js';

/**
 * Core's thread-link processor with Factory's session URL: `Open session ↗` after the first reply
 * of a new channel session. No-op without a public origin. With reply text hidden,
 * `reply_in_thread` appends the link to its own first post instead.
 */
export function factorySessionLinkProcessor(): ChannelThreadLinkProcessor {
  return new ChannelThreadLinkProcessor({
    label: SESSION_LINK_LABEL,
    link: ({ requestContext }) => sessionLinkFromRequest(requestContext),
  });
}

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
