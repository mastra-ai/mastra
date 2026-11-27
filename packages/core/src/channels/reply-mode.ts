import type { ProcessInputStepArgs, Processor } from '../processors';
import type { RequestContext } from '../request-context';
import type { ChatChannelRenderContext } from './output-processor';
import { ChannelReplyGuidanceProcessor } from './reply-guidance-processor';
import type { ChannelReplyGuidanceOptions } from './reply-guidance-processor';
import { ChannelReplyReminderProcessor } from './reply-reminder-processor';
import { createChannelReplyTool, REPLY_TOOL_NAME } from './reply-tool';
import type { ChannelThreadLinkProcessorOptions } from './thread-link-processor';
import type { TypingStatusFn } from './typing-status';

/**
 * Slack renders the status inline next to the app name, and rejects a status
 * (sent as its loading message) of 51 characters or more. Other platforms get
 * the same cap; reply mode has only been tested on Slack.
 */
const MAX_STATUS_LENGTH = 50;

/**
 * Turns a tool's `description` arg ("Listing the repo root") into a status
 * line that reads after the app name ("<App> is listing the repo root…").
 * Only the first line counts: issue/PR creators carry whole bodies there.
 */
function describeToolCall(args: unknown): string | undefined {
  if (!args || typeof args !== 'object') return undefined;
  const { description } = args as { description?: unknown };
  if (typeof description !== 'string') return undefined;
  const line = description
    .split('\n')
    .map(part => part.replace(/\s+/g, ' ').trim())
    .find(Boolean);
  if (!line) return undefined;
  // Drop the sentence-case capital ("Listing" → "listing") but leave acronyms
  // and identifiers ("PR lookup", "CI status") alone.
  const status = `is ${/^[A-Z][a-z]/.test(line) ? line.charAt(0).toLowerCase() + line.slice(1) : line}`;
  return status.length > MAX_STATUS_LENGTH ? `${status.slice(0, MAX_STATUS_LENGTH - 1)}…` : status;
}

/**
 * Progress as a status line rather than posts: "is thinking...", the current
 * tool's `description`, "is typing..." while a reply is written. With reply
 * text hidden, streamed text never reaches the thread, so it gets no status:
 * an "is typing..." set after the reply tool's post would sit on the thread
 * with nothing coming, and race the clear at the end of the run.
 *
 * @internal
 */
export function channelReplyTypingStatus(textDisplay: 'show' | 'hidden' = 'hidden'): TypingStatusFn {
  return chunk => {
    switch (chunk.type) {
      case 'reasoning-delta':
        return 'is thinking...';
      // Reply text reaches the thread only when it is shown.
      case 'text-delta':
        return textDisplay === 'show' ? 'is typing...' : undefined;
      // The reply tool's text streams into the thread as the model writes it.
      case 'tool-call-input-streaming-start':
        return chunk.payload.toolName === REPLY_TOOL_NAME ? 'is typing...' : undefined;
      case 'tool-call':
        // Still finishing the streamed reply; don't flip to "is working...".
        if (chunk.payload.toolName === REPLY_TOOL_NAME) return 'is typing...';
        return describeToolCall(chunk.payload.args) ?? 'is working...';
      default:
        return undefined;
    }
  };
}

/** How `replyMode` is configured on a channel adapter. */
export interface ChannelReplyModeConfig {
  /** Host-specific lines added to the reply guidance prompt, optionally depending on whether the run can reply. */
  instructions?: ChannelReplyGuidanceOptions['instructions'];
  /** How long a run may go without posting before it is nudged to post a status. Defaults to five minutes. */
  reminderAfterMs?: number;
}

/** `replyMode` adapter option: `'tool'` for the defaults, or a config to tune the prompt and reminder. */
export type ChannelReplyMode = 'tool' | ChannelReplyModeConfig;

/** `threadLink` adapter option: a link builder, or one with a label. */
export type ChannelThreadLink = ChannelThreadLinkProcessorOptions['link'] | ChannelThreadLinkProcessorOptions;

export function threadLinkOptions(link: ChannelThreadLink | undefined): ChannelThreadLinkProcessorOptions | undefined {
  if (!link) return undefined;
  return typeof link === 'function' ? { link } : link;
}

/** The adapter settings reply mode reads for a run's platform. */
export interface ChannelReplyModeAdapter {
  replyMode?: ChannelReplyMode;
  threadLink?: ChannelThreadLink;
}

interface ChannelReplyModeDeps {
  /** The run's chat thread: the one it came in on, else the one its thread is linked to. Cached on `state`. */
  resolveRender: (
    requestContext: RequestContext | undefined,
    state?: Record<string, unknown>,
  ) => Promise<ChatChannelRenderContext | undefined>;
  /** Adapter settings for a platform. */
  adapter: (platform: string) => ChannelReplyModeAdapter | undefined;
  now?: () => number;
}

/**
 * Installed by `AgentChannels` when an adapter sets `replyMode`. On runs whose chat
 * thread is on that adapter (including runs started elsewhere whose thread is linked
 * to it) it adds the `reply_in_thread` tool, the reply guidance prompt, and the
 * nudge after a quiet stretch. Other runs are untouched.
 *
 * @internal
 */
export class ChannelReplyModeProcessor implements Processor {
  readonly id = 'channel-reply-mode';
  readonly #deps: ChannelReplyModeDeps;

  constructor(deps: ChannelReplyModeDeps) {
    this.#deps = deps;
  }

  async processInputStep(args: ProcessInputStepArgs) {
    const { requestContext, state } = args;
    const render = await this.#deps.resolveRender(requestContext, state);
    const adapter = render && this.#deps.adapter(render.platform);
    if (!requestContext || !render || !adapter?.replyMode) return undefined;
    const config = adapter.replyMode === 'tool' ? {} : adapter.replyMode;
    // With reply text shown the reply already posts, so the tool would double every message.
    // The agent still gets the guidance on how to write for the thread.
    if (render.textDisplay !== 'hidden') {
      new ChannelReplyGuidanceProcessor({ instructions: config.instructions }).processInputStep(args);
      return { messageList: args.messageList };
    }
    const tools = {
      ...args.tools,
      ...createChannelReplyTool(requestContext, {
        resolveRender: async () => render,
        link: threadLinkOptions(adapter.threadLink),
      }),
    };
    const withTools = { ...args, tools };
    new ChannelReplyGuidanceProcessor({ instructions: config.instructions }).processInputStep(withTools);
    await new ChannelReplyReminderProcessor({ afterMs: config.reminderAfterMs, now: this.#deps.now }).processInputStep(
      withTools,
    );
    // A run that narrows its tools must still be able to post its reply.
    const activeTools =
      args.activeTools && !args.activeTools.includes(REPLY_TOOL_NAME)
        ? [...args.activeTools, REPLY_TOOL_NAME]
        : undefined;
    return { tools, messageList: args.messageList, ...(activeTools ? { activeTools } : {}) };
  }
}
