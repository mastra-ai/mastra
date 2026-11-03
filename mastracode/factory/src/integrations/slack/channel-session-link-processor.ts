import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import type { ChatChannelRenderContext } from '@mastra/core/channels';
import type { Processor, ProcessOutputStepArgs, ProcessOutputStreamArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';

import { readFactorySessionScope } from '../../rules/binding-context.js';
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
 * State key the core ProcessorRunner reads to re-drive one extra part through
 * the output chain after the part a processor returned. Internal to core
 * (`processors/stream-reprocess.ts`, used by `BatchPartsProcessor`); mirrored
 * here rather than exported so Factory's one use doesn't widen core's API.
 */
const REPROCESS_PART_KEY = '__mastraReprocessPart';

/** Text-part id of the link delta; never collides with a model block id. */
const LINK_PART_ID = 'factory-session-link';

/**
 * Emits an `Open session ↗` link right after the first reply of a new channel
 * session, so the link closes the reply rather than leading it. The channel
 * driver ends a post at `text-end`, so Slack shows the link as its own short
 * message after the reply.
 *
 * "End of the reply" is not `text-end`: a reply with citations is several
 * text blocks (`text … source … text`), each with its own `text-end`. The
 * reply ends at the first `tool-call` (the opener before tools run) or at
 * `step-finish` (a reply with no tools), whichever comes first after some
 * text. A processor can only return one part, so on that chunk this returns
 * a `text-delta` carrying the link and stashes the chunk itself under
 * `REPROCESS_PART_KEY`, which the runner re-drives through the chain right
 * after — the link lands before it and downstream processors see both.
 * Factory-emitted rather than left to the model so a skipped opener can't
 * drop it. No-op without the new-session marker or a public origin.
 *
 * The streamed text is also what gets persisted, and the link is a Slack
 * display detail: in memory it would show the model its own `[↗](…)` on
 * later turns (inviting it to fabricate links) and render a self-link in
 * the web transcript. The link delta opens its own text part, so
 * `processOutputStep` drops that part from the assistant message before
 * `MessageHistory` saves it.
 */
export class FactoryChannelSessionLinkProcessor implements Processor {
  readonly id = 'factory-channel-session-link';

  async processOutputStream({ part, state, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (state.linked || !linksThisRun(requestContext)) return part;
    if (part.type === 'text-delta') {
      state.textStarted = true;
      return part;
    }
    if ((part.type !== 'tool-call' && part.type !== 'step-finish') || !state.textStarted) return part;
    state.linked = true;
    const link = sessionLinkFromRequest(requestContext);
    if (!link) return part;
    state[REPROCESS_PART_KEY] = part;
    return {
      type: 'text-delta',
      runId: part.runId,
      from: part.from,
      payload: { id: LINK_PART_ID, text: linkSuffix(link) },
    };
  }

  processOutputStep({ messageList, requestContext }: ProcessOutputStepArgs) {
    if (!linksThisRun(requestContext)) return messageList;
    const link = sessionLinkFromRequest(requestContext);
    if (!link) return messageList;
    const suffix = linkSuffix(link);
    for (const message of messageList.get.response.db()) {
      if (message.role !== 'assistant') continue;
      const index = message.content.parts.findIndex(part => part.type === 'text' && part.text === suffix);
      if (index === -1) continue;
      message.content.parts.splice(index, 1);
      if (typeof message.content.content === 'string' && message.content.content.endsWith(suffix)) {
        message.content.content = message.content.content.slice(0, -suffix.length);
      }
      return messageList;
    }
    return messageList;
  }
}

/**
 * With reply text hidden the reply text never reaches the thread, and
 * `reply_in_thread` appends the link to its own first post instead.
 */
function linksThisRun(requestContext: RequestContext | undefined): requestContext is RequestContext {
  if (!requestContext?.get(NEW_CHANNEL_SESSION_KEY)) return false;
  const render = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  return render?.textDisplay !== 'hidden';
}

function linkSuffix(link: string): string {
  // Own paragraph: the link closes the message, it is not part of the last sentence.
  return `\n\n[${SESSION_LINK_LABEL}](${link})`;
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
