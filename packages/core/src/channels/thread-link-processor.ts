import { parseMemoryRequestContext } from '../memory/types';
import type { Processor, ProcessOutputStepArgs, ProcessOutputStreamArgs } from '../processors';
import { REPROCESS_PART_KEY } from '../processors/stream-reprocess';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream/types';

import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from './output-processor';
import type { ChatChannelRenderContext } from './output-processor';

/**
 * Request-context marker for a run that opened a new channel thread. `AgentChannels` sets it when
 * it creates the thread; a host that decides "new" itself can call {@link markNewChannelThread}.
 */
export const NEW_CHANNEL_THREAD_KEY = '__mastra_new_channel_thread';

export function markNewChannelThread(requestContext: RequestContext): void {
  requestContext.set(NEW_CHANNEL_THREAD_KEY, true);
}

export interface ChannelThreadLinkTarget {
  requestContext: RequestContext;
  /** The run's memory thread, when it has one. */
  threadId?: string;
  resourceId?: string;
}

export interface ChannelThreadLinkProcessorOptions {
  /** The web URL for the run's thread; undefined posts no link. */
  link: (target: ChannelThreadLinkTarget) => string | undefined;
  /** Link text. */
  label?: string;
}

/** Text-part id of the link delta; never collides with a model block id. */
const LINK_PART_ID = 'mastra-channel-thread-link';
const EMITTED_SUFFIX_KEY = 'mastra__channelThreadLinkSuffix';
export const DEFAULT_LINK_LABEL = 'Open thread ↗';

/**
 * Posts a link to the thread in the host's web UI right after the first reply of a new channel
 * thread, so the link closes the reply rather than leading it. The channel driver ends a post at
 * `text-end`, so the link shows as its own short message after the reply.
 *
 * "End of the reply" is not `text-end`: a reply with citations is several text blocks, each with
 * its own `text-end`. The reply ends at the first `tool-call` (an opener before tools run) or at
 * `step-finish` (a reply with no tools), whichever comes first after some text. A processor
 * returns one part, so on that chunk this returns a `text-delta` carrying the link and stashes the
 * chunk under `REPROCESS_PART_KEY`, which the runner re-drives through the chain right after.
 *
 * The link is a channel display detail. Saved to memory it would show the model its own link on
 * later turns (inviting it to fabricate links) and render a self-link in the web transcript, so
 * `processOutputStep` drops the link's text part before the message is saved.
 *
 * No-op unless the run opened a new thread, the reply text is shown, and `link` returns a URL.
 */
export class ChannelThreadLinkProcessor implements Processor {
  readonly id = 'channel-thread-link';
  readonly #options: (requestContext: RequestContext) => ChannelThreadLinkProcessorOptions | undefined;

  /** Pass options, or a function picking them per run (e.g. by the run's platform). */
  constructor(
    options:
      | ChannelThreadLinkProcessorOptions
      | ((requestContext: RequestContext) => ChannelThreadLinkProcessorOptions | undefined),
  ) {
    this.#options = typeof options === 'function' ? options : () => options;
  }

  async processOutputStream({ part, state, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (state.linked || !linksThisRun(requestContext)) return part;
    if (part.type === 'text-delta') {
      if (part.payload.text.trim()) state.textStarted = true;
      return part;
    }
    if ((part.type !== 'tool-call' && part.type !== 'step-finish') || !state.textStarted) return part;
    state.linked = true;
    const suffix = this.#suffix(requestContext);
    if (!suffix) return part;
    // Cleanup strips exactly what was posted: a link that changes per call (signed URL) can't be rebuilt.
    requestContext.set(EMITTED_SUFFIX_KEY, suffix);
    state[REPROCESS_PART_KEY] = part;
    return {
      type: 'text-delta',
      runId: part.runId,
      from: part.from,
      payload: { id: LINK_PART_ID, text: suffix },
    };
  }

  processOutputStep({ messageList, requestContext }: ProcessOutputStepArgs) {
    const suffix = requestContext?.get(EMITTED_SUFFIX_KEY) as string | undefined;
    if (!suffix) return messageList;
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

  #suffix(requestContext: RequestContext): string | undefined {
    const options = this.#options(requestContext);
    if (!options) return undefined;
    const memory = parseMemoryRequestContext(requestContext);
    const link = options.link({ requestContext, threadId: memory?.thread?.id, resourceId: memory?.resourceId });
    // Own paragraph: the link closes the message, it is not part of the last sentence.
    return link && `\n\n[${options.label ?? DEFAULT_LINK_LABEL}](${link})`;
  }
}

function linksThisRun(requestContext: RequestContext | undefined): requestContext is RequestContext {
  if (!requestContext?.get(NEW_CHANNEL_THREAD_KEY)) return false;
  const render = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
  return render?.textDisplay !== 'hidden';
}
