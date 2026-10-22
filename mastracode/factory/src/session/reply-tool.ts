import type { AgentControllerRequestContext } from '@mastra/core/agent-controller';
import { CHAT_CHANNEL_RENDER_CONTEXT_KEY } from '@mastra/core/channels';
import type { ChatChannelRenderContext } from '@mastra/core/channels';
import type { Processor, ProcessOutputStreamArgs } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { ChunkType } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { readFactorySessionScope } from '../rules/binding-context.js';
import { SESSION_LINK_LABEL, sessionLink } from './channel-reply-processor.js';
import { NEW_CHANNEL_SESSION_KEY } from './channel-session-link-processor.js';
import { resolveRenderContext } from './share-file-tool.js';
import type { ShareFileToolDeps } from './share-file-tool.js';

export const REPLY_TOOL_NAME = 'reply_in_thread';

/** Set once the first reply of a new session carried the session link. */
const LINKED_KEY = 'factory__replyLinked';

const replyInput = z
  .object({
    text: z.string().trim().min(1).max(12_000).describe('The message to post, in markdown.'),
  })
  .strict();

/**
 * The only way a channel run speaks when the adapter hides reply text
 * (`textDisplay: 'hidden'`). Posting becomes a choice the agent makes, so it
 * stops narrating each step into the thread and can say nothing on purpose.
 * Offered only on runs whose chat thread hides text; elsewhere the reply
 * stream still posts and this tool would double every message.
 */
export async function createReplyTool(
  requestContext: RequestContext,
  deps: ShareFileToolDeps = {},
): Promise<IntegrationTools> {
  const render = await resolveRenderContext(requestContext, deps);
  if (render?.textDisplay !== 'hidden') return {};
  return {
    [REPLY_TOOL_NAME]: createTool({
      id: REPLY_TOOL_NAME,
      description:
        'Post a message in this chat thread. Nothing you write outside this tool reaches the thread, so use it for anything the people there should see: a short note that you are starting a longer job, a question you need answered, and the outcome when you finish. Post when you have something new; do not repeat yourself or post that nothing changed. To stay quiet, do not call it.',
      inputSchema: replyInput,
      execute: async (input, context) => {
        const link = firstReplyLink(requestContext);
        const suffix = link ? `\n\n[${SESSION_LINK_LABEL}](${link})` : '';
        // FactoryReplyStreamProcessor may already be streaming this call's text
        // into the thread; finish that post rather than posting it again.
        const toolCallId = context?.agent?.toolCallId;
        const streamed = toolCallId ? replyStreams(requestContext).get(toolCallId) : undefined;
        if (toolCallId) replyStreams(requestContext).delete(toolCallId);
        if (!streamed || !(await streamed.finish(input.text, suffix))) {
          await render.chatThread.post({ markdown: `${input.text}${suffix}` });
        }
        // Marked only once posted, so a failed first post still gets the link on the retry.
        if (link) requestContext.set(LINKED_KEY, true);
        return { posted: true };
      },
    }),
  };
}

/**
 * The session link the first reply of a new session ends with. With reply
 * text hidden, `FactoryChannelSessionLinkProcessor`'s text delta never
 * reaches the thread, so the tool carries the link instead.
 */
function firstReplyLink(requestContext: RequestContext): string | undefined {
  if (!requestContext.get(NEW_CHANNEL_SESSION_KEY) || requestContext.get(LINKED_KEY)) return undefined;
  const controller = requestContext.get('controller') as AgentControllerRequestContext | undefined;
  if (!controller?.threadId) return undefined;
  return sessionLink({
    threadId: controller.threadId,
    sessionId: controller.sessionId,
    resourceId: controller.resourceId,
    factoryProjectId: readFactorySessionScope(requestContext)?.factoryProjectId,
  });
}

/** Live posts of `reply_in_thread` calls whose text is still streaming in, by tool call id. */
const STREAMS_KEY = 'factory__replyStreams';

interface ReplyStream {
  /** Show the text decoded from the args so far. */
  update(text: string): void;
  /** End the post with the validated text. Resolves false if the post failed. */
  finish(text: string, suffix: string): Promise<boolean>;
}

function replyStreams(requestContext: RequestContext): Map<string, ReplyStream> {
  let streams = requestContext.get(STREAMS_KEY) as Map<string, ReplyStream> | undefined;
  if (!streams) {
    streams = new Map();
    requestContext.set(STREAMS_KEY, streams);
  }
  return streams;
}

/**
 * One streamed Slack post, opened on the first visible text so an abandoned
 * call never leaves an empty message behind.
 */
function openReplyStream(chatThread: ChatChannelRenderContext['chatThread']): ReplyStream {
  const queue: string[] = [];
  let sent = '';
  let closed = false;
  let wake: (() => void) | undefined;
  let done: Promise<boolean> | undefined;

  async function* chunks(): AsyncGenerator<string> {
    while (true) {
      while (queue.length > 0) yield queue.shift()!;
      if (closed) return;
      await new Promise<void>(resolve => (wake = resolve));
    }
  }
  const push = (text: string) => {
    if (!text) return;
    queue.push(text);
    done ??= chatThread.post(chunks()).then(
      () => true,
      error => {
        console.warn('[factory] streamed reply failed; posting it whole', { error });
        return false;
      },
    );
    wake?.();
  };

  return {
    update(text) {
      const visible = text.trimStart();
      if (!visible.startsWith(sent)) return;
      push(visible.slice(sent.length));
      sent = visible;
    },
    async finish(text, suffix) {
      if (text.startsWith(sent)) push(text.slice(sent.length));
      if (!done) return false;
      push(suffix);
      closed = true;
      wake?.();
      return done;
    },
  };
}

/**
 * Streams a `reply_in_thread` call's `text` into the thread while the model is
 * still writing it, so a long reply appears as it is written instead of all at
 * once when the call completes. The tool finishes the post with the validated
 * text. Runs whose adapter doesn't stream, or that show reply text, are left
 * alone.
 */
export class FactoryReplyStreamProcessor implements Processor {
  readonly id = 'factory-reply-stream';

  async processOutputStream({ part, state, requestContext }: ProcessOutputStreamArgs): Promise<ChunkType> {
    if (!requestContext) return part;
    const args = (state.args ??= {}) as Record<string, string>;
    if (part.type === 'tool-call-input-streaming-start' && part.payload.toolName === REPLY_TOOL_NAME) {
      const render = requestContext.get(CHAT_CHANNEL_RENDER_CONTEXT_KEY) as ChatChannelRenderContext | undefined;
      // A static adapter (`streaming: false`) posts each reply whole, so the tool does too.
      if (render?.textDisplay !== 'hidden' || !render.streaming?.enabled) return part;
      args[part.payload.toolCallId] = '';
      replyStreams(requestContext).set(part.payload.toolCallId, openReplyStream(render.chatThread));
    } else if (part.type === 'tool-call-delta' && part.payload.toolCallId in args) {
      const json = (args[part.payload.toolCallId] += part.payload.argsTextDelta);
      const text = partialStringField(json, 'text');
      if (text !== undefined) replyStreams(requestContext).get(part.payload.toolCallId)?.update(text);
    }
    return part;
  }
}

const ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };

/** The decoded value of a top-level string field in JSON that may still be cut off mid-string. */
export function partialStringField(json: string, field: string): string | undefined {
  const start = new RegExp(`"${field}"\\s*:\\s*"`).exec(json);
  if (!start) return undefined;
  let out = '';
  for (let i = start.index + start[0].length; i < json.length; i++) {
    const ch = json[i]!;
    if (ch === '"') return out;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    const next = json[i + 1];
    if (next === undefined) return out;
    if (next === 'u') {
      const hex = json.slice(i + 2, i + 6);
      if (hex.length < 4) return out;
      out += String.fromCharCode(parseInt(hex, 16));
      i += 5;
    } else {
      out += ESCAPES[next] ?? next;
      i += 1;
    }
  }
  return out;
}
