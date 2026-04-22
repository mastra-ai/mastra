import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { MastraModelOutput } from '../stream/base/output';

import type { ChannelAdapterConfig, PostableMessage } from './agent-channels';
import {
  formatArgsSummary,
  formatResult,
  formatToolApproval,
  formatToolResult,
  formatToolRunning,
  stripToolPrefix,
} from './formatting';

/**
 * Helpers passed to custom `consumeStream` implementations so they don't have
 * to re-import the formatting primitives used by the default renderer.
 */
export interface ConsumeStreamHelpers {
  channelToolNames: Set<string>;
  formatToolRunning: typeof formatToolRunning;
  formatToolResult: typeof formatToolResult;
  formatToolApproval: typeof formatToolApproval;
  formatArgsSummary: typeof formatArgsSummary;
  formatResult: typeof formatResult;
  stripToolPrefix: typeof stripToolPrefix;
  /**
   * Edit the given message id, falling back to a new post on failure (or
   * when `messageId` is undefined). Returns the effective platform message id
   * the content is now at — the passed-in id on successful edit, or the
   * newly posted id when it fell back to `thread.post`. Returns `undefined`
   * if the post failed to return an id.
   */
  editOrPost: (messageId: string | undefined, content: PostableMessage) => Promise<string | undefined>;
}

/** Arguments passed to a `consumeStream` override. */
export interface ConsumeStreamArgs {
  stream: MastraModelOutput;
  sdkThread: Thread;
  adapter: Adapter;
  platform: string;
  useCards: boolean;
  /** Pre-seeded tracked tool when rendering a stream resumed from approval. */
  approvalContext?: { toolCallId: string; messageId: string };
  adapterConfig: ChannelAdapterConfig;
  helpers: ConsumeStreamHelpers;
  logger?: IMastraLogger;
  /** Optional post-processor applied by the default consumer to each flushed text chunk. */
  formatOutboundText?: (text: string) => string;
}

/** Replacement for the chunk-rendering loop. */
export type ConsumeStreamFn = (args: ConsumeStreamArgs) => Promise<void>;

/**
 * Build the `editOrPost` helper used by the default consumer.
 * Tries to edit `messageId` first, falling back to a new `thread.post` on failure.
 */
export function createEditOrPost(
  adapter: Adapter,
  sdkThread: Thread,
): (messageId: string | undefined, content: PostableMessage) => Promise<string | undefined> {
  return async (messageId, content) => {
    if (messageId) {
      try {
        await adapter.editMessage(sdkThread.id, messageId, content);
        return messageId;
      } catch {
        // fall through to post
      }
    }
    const sent = await sdkThread.post(content);
    return sent?.id;
  };
}

/**
 * Default implementation of the chunk-rendering loop used by `AgentChannels`.
 *
 * Iterates the outer `fullStream` to handle all chunk types:
 * - `text-delta`: Accumulates text and posts when flushed.
 * - `tool-call`: Posts a "Running…" card eagerly.
 * - `tool-result`: Edits the "Running…" card with the result.
 * - `tool-call-approval`: Edits the card to show Approve/Deny buttons.
 * - `step-finish` / `finish`: Flushes accumulated text.
 */
export async function defaultConsumeStream(args: ConsumeStreamArgs): Promise<void> {
  const { stream, sdkThread, platform, useCards, approvalContext, adapterConfig, helpers, logger, formatOutboundText } =
    args;
  const { channelToolNames, editOrPost } = helpers;

  // Per-stream rendering state
  let textBuffer = '';
  let typingStarted = false;
  interface TrackedTool {
    displayName: string;
    argsSummary: string;
    startedAt: number;
    messageId?: string; // platform message ID for editing
  }
  const toolCalls = new Map<string, TrackedTool>();

  // Pre-seed the approved tool so its result can edit the approval card
  if (approvalContext) {
    toolCalls.set(approvalContext.toolCallId, {
      displayName: '',
      argsSummary: '',
      startedAt: Date.now(),
      messageId: approvalContext.messageId,
    });
  }

  let typingInterval: ReturnType<typeof setInterval> | undefined;

  const ensureTyping = async () => {
    if (!typingStarted) {
      typingStarted = true;
      try {
        await sdkThread.startTyping();
      } catch (e) {
        logger?.debug('[CHANNEL] Typing indicator failed (best-effort)', { error: e });
      }
    }
  };

  // Keep the typing indicator alive for slow generation (e.g. image models).
  // Discord's indicator expires after ~10s, so we re-fire every 8s.
  const startTypingKeepalive = () => {
    if (typingInterval) return;
    typingInterval = setInterval(async () => {
      try {
        await sdkThread.startTyping();
      } catch {
        // best-effort
      }
    }, 8_000);
  };

  const stopTypingKeepalive = () => {
    if (typingInterval) {
      clearInterval(typingInterval);
      typingInterval = undefined;
    }
  };

  const flushText = async () => {
    // Strip zero-width characters (U+200B, U+200C, U+200D, U+FEFF) that LLMs sometimes emit
    const cleanedText = textBuffer.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    textBuffer = '';
    if (!cleanedText) return;
    const finalText = formatOutboundText ? formatOutboundText(cleanedText) : cleanedText;
    if (!finalText) return;
    await sdkThread.post(finalText);
  };

  // If nothing triggers typing within 3s, start it anyway and keep it
  // alive — covers slow generation (e.g. image models) where no text/tool
  // chunks arrive for a long time.
  const typingFallbackTimer = setTimeout(async () => {
    if (!typingStarted) {
      await ensureTyping();
      startTypingKeepalive();
    }
  }, 3_000);

  try {
    for await (const chunk of stream.fullStream) {
      // --- Text accumulation ---
      if (chunk.type === 'text-delta') {
        if (chunk.payload.text) {
          await ensureTyping();
          startTypingKeepalive();
        }
        textBuffer += chunk.payload.text;
        continue;
      }

      if (chunk.type === 'reasoning-delta') {
        await ensureTyping();
        startTypingKeepalive();
        continue;
      }

      // --- File (e.g. model-generated image): post as attachment ---
      if (chunk.type === 'file') {
        await flushText();
        const { data, mimeType } = chunk.payload;
        logger?.debug('[CHANNEL] Received file chunk', {
          mimeType,
          dataType: typeof data,
          size: typeof data === 'string' ? data.length : (data as Uint8Array)?.byteLength,
        });
        const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
        const filename = `generated.${ext}`;
        const binary =
          typeof data === 'string'
            ? Buffer.from(data, 'base64')
            : data instanceof Uint8Array
              ? Buffer.from(data)
              : data;
        try {
          await sdkThread.post({ markdown: ' ', files: [{ data: binary, filename, mimeType }] });
        } catch (e) {
          logger?.debug('[CHANNEL] Failed to post file attachment', { error: e, mimeType, filename });
        }
        continue;
      }

      // --- Text flush triggers ---
      if (chunk.type === 'step-finish' || chunk.type === 'finish') {
        await flushText();
        continue;
      }

      // --- Tool call: post eager "Running…" card ---
      if (chunk.type === 'tool-call') {
        if (channelToolNames.has(chunk.payload.toolName)) continue;
        await ensureTyping();
        startTypingKeepalive();
        await flushText();

        const displayName = stripToolPrefix(chunk.payload.toolName);
        const rawArgs = (
          typeof chunk.payload.args === 'object' && chunk.payload.args != null ? chunk.payload.args : {}
        ) as Record<string, unknown>;
        const argsSummary = formatArgsSummary(rawArgs);

        let messageId: string | undefined;
        if (!adapterConfig?.formatToolCall) {
          const sentMessage = await sdkThread.post(formatToolRunning(displayName, argsSummary, useCards));
          messageId = sentMessage?.id;
        }

        toolCalls.set(chunk.payload.toolCallId, {
          displayName,
          argsSummary,
          startedAt: Date.now(),
          messageId,
        });
        continue;
      }

      // --- Tool result: edit the "Running…" card with the outcome ---
      if (chunk.type === 'tool-result') {
        if (channelToolNames.has(chunk.payload.toolName)) continue;

        const tracked = toolCalls.get(chunk.payload.toolCallId);
        const displayName = tracked?.displayName || stripToolPrefix(chunk.payload.toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(chunk.payload.args ?? {});
        const resultText = formatResult(chunk.payload.result, chunk.payload.isError);
        const channelMsgId = tracked?.messageId;
        const durationMs = tracked?.startedAt != null ? Date.now() - tracked.startedAt : undefined;

        if (adapterConfig?.formatToolCall) {
          const custom = adapterConfig.formatToolCall({
            toolName: displayName,
            args: (chunk.payload.args ?? {}) as Record<string, unknown>,
            result: chunk.payload.result,
            isError: chunk.payload.isError,
          });
          if (custom != null) {
            await editOrPost(channelMsgId, custom);
          }
        } else {
          const resultMessage = formatToolResult(
            displayName,
            argsSummary,
            resultText,
            !!chunk.payload.isError,
            durationMs,
            useCards,
          );
          await editOrPost(channelMsgId, resultMessage);
        }
        continue;
      }

      // --- Tool approval: edit the "Running…" card to show Approve/Deny ---
      if (chunk.type === 'tool-call-approval') {
        const { toolCallId, toolName, args: toolArgs } = chunk.payload;
        const tracked = toolCalls.get(toolCallId);
        const displayName = tracked?.displayName || stripToolPrefix(toolName);
        const argsSummary = tracked?.argsSummary || formatArgsSummary(toolArgs);
        const channelMsgId = tracked?.messageId;

        const approvalMessage = formatToolApproval(displayName, argsSummary, toolCallId, useCards);

        await editOrPost(channelMsgId, approvalMessage);
        continue;
      }
    }
  } finally {
    clearTimeout(typingFallbackTimer);
    stopTypingKeepalive();
  }

  // Check for errors that occurred during streaming
  if (stream.error) {
    const msg = stream.error.message;
    const display = msg.length > 500 ? msg.slice(0, 500) + '…' : msg;
    logger?.error(`[${platform}] Stream completed with error`, { error: display });
    await sdkThread.post(`❌ Error: ${display}`);
  }
}
