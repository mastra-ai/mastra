import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { REPROCESS_PART_KEY } from '@mastra/core/processors';
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
 * Appends a bare `↗` link to the first text block of a new channel session,
 * so the link and the reply are one message instead of two and the link
 * trails the text rather than leading it.
 *
 * The model's `text-end` marks the end of that block. A processor can only
 * return one part, so on that `text-end` this returns a final `text-delta`
 * carrying the link and stashes the `text-end` under `REPROCESS_PART_KEY`,
 * which the runner re-drives through the chain right after — the delta lands
 * before the end marker and downstream processors see both. Factory-emitted
 * rather than left to the model so a skipped opener can't drop it. No-op
 * without the new-session marker or a public origin.
 */
export class FactoryChannelSessionLinkProcessor implements Processor {
  readonly id = 'factory-channel-session-link';

  async processOutputStream({ part, state, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (state.linked || !requestContext?.get(NEW_CHANNEL_SESSION_KEY)) return part;
    if (part.type === 'text-delta') {
      state.textStarted = true;
      return part;
    }
    if (part.type !== 'text-end' || !state.textStarted) return part;
    state.linked = true;
    const link = sessionLinkFromRequest(requestContext);
    if (!link) return part;
    state[REPROCESS_PART_KEY] = part;
    return {
      type: 'text-delta',
      runId: part.runId,
      from: part.from,
      payload: { id: part.payload.id, text: ` [${SESSION_LINK_LABEL}](${link})` },
    };
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
