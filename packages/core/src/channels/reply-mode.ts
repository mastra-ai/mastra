import type { InputProcessor, OutputProcessor } from '../processors';
import type { RequestContext } from '../request-context';
import { ChannelReplyGuidanceProcessor } from './reply-guidance-processor';
import type { ChannelReplyGuidanceOptions } from './reply-guidance-processor';
import { ChannelReplyReminderProcessor } from './reply-reminder-processor';
import type { ChannelReplyReminderOptions } from './reply-reminder-processor';
import { ChannelReplyStreamProcessor, createChannelReplyTool, REPLY_TOOL_NAME } from './reply-tool';
import type { ChannelReplyOptions } from './reply-tool';
import { ChannelThreadLinkProcessor } from './thread-link-processor';
import type { TypingStatusFn } from './typing-status';

/**
 * Slack renders the status inline next to the app name, and rejects a status
 * (sent as its loading message) of 51 characters or more.
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
 */
export function channelReplyTypingStatus(textDisplay: 'show' | 'hidden' = 'hidden'): TypingStatusFn {
  return chunk => {
    switch (chunk.type) {
      case 'reasoning-delta':
        return 'is thinking...';
      case 'text-delta':
        return textDisplay === 'hidden' ? undefined : 'is typing...';
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

export interface ChannelReplyModeOptions extends ChannelReplyOptions {
  /** Show the model's reply text in the thread instead of posting through `reply_in_thread`. */
  textDisplay?: 'show' | 'hidden';
  reminder?: ChannelReplyReminderOptions;
  guidance?: ChannelReplyGuidanceOptions;
}

export interface ChannelReplyMode {
  /** Spread into the channel adapter's config. */
  adapterOptions: { textDisplay: 'show' | 'hidden'; toolDisplay: 'hidden'; typingStatus: TypingStatusFn };
  processors: { input: InputProcessor[]; output: OutputProcessor[] };
  /** Tools to add to channel runs: `reply_in_thread` with reply text hidden, else none. */
  tools: (requestContext: RequestContext) => ReturnType<typeof createChannelReplyTool> | {};
}

/**
 * One chat display for channel runs: tool calls stay out of the thread, progress shows in the
 * typing status, and (by default) the agent speaks only through `reply_in_thread`, so posting is
 * a choice and it can stay quiet. A run that goes quiet too long is nudged to post a status, and
 * the first reply of a new thread links to it in the host's web UI.
 */
export function channelReplyMode(options: ChannelReplyModeOptions = {}): ChannelReplyMode {
  const textDisplay = options.textDisplay ?? 'hidden';
  const hidden = textDisplay === 'hidden';
  return {
    adapterOptions: { textDisplay, toolDisplay: 'hidden', typingStatus: channelReplyTypingStatus(textDisplay) },
    processors: {
      input: [
        new ChannelReplyGuidanceProcessor(options.guidance),
        ...(hidden ? [new ChannelReplyReminderProcessor(options.reminder)] : []),
      ],
      output: [
        ...(options.link ? [new ChannelThreadLinkProcessor(options.link)] : []),
        ...(hidden ? [new ChannelReplyStreamProcessor(options)] : []),
      ],
    },
    tools: requestContext => (hidden ? createChannelReplyTool(requestContext, options) : {}),
  };
}
