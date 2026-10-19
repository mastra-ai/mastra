import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import type { Processor, ProcessOutputStreamArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';

import { readFactorySessionScope } from '../rules/binding-context.js';
import { SESSION_LINK_LABEL, sessionLink } from './channel-reply-processor.js';

/**
 * Request-context marker a channel handler sets on the run that opens a new
 * thread. Only that run gets the link; follow-ups in the same thread don't.
 */
export const NEW_CHANNEL_SESSION_KEY = 'factory__newChannelSession';

export function markNewChannelSession(requestContext: RequestContext): void {
  requestContext.set(NEW_CHANNEL_SESSION_KEY, true);
}

/**
 * Prefixes the first text of a new channel session with a bare `↗` link to
 * the session, so the link and the reply are one message instead of two.
 * The link leads rather than trails: a stream can't tell when a text run
 * ends until the next chunk arrives, and the first `text-delta` is the only
 * spot a processor can claim deterministically. Factory-emitted rather than
 * left to the model so a skipped opener can't drop it. No-op without the
 * new-session marker or a public origin.
 */
export class FactoryChannelSessionLinkProcessor implements Processor {
  readonly id = 'factory-channel-session-link';

  async processOutputStream({ part, state, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (part.type !== 'text-delta' || state.linked) return part;
    if (!requestContext?.get(NEW_CHANNEL_SESSION_KEY)) return part;
    state.linked = true;
    const link = sessionLinkFromRequest(requestContext);
    if (!link) return part;
    return { ...part, payload: { ...part.payload, text: `[${SESSION_LINK_LABEL}](${link}) ${part.payload.text}` } };
  }
}

function sessionLinkFromRequest(requestContext: RequestContext): string | undefined {
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.threadId) return undefined;
  return sessionLink({
    threadId: controller.threadId,
    resourceId: controller.resourceId,
    factoryProjectId: readFactorySessionScope(requestContext)?.factoryProjectId,
  });
}
