import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { AgentChunkType } from '../stream/types';
import type { PostableMessage } from './agent-channels';
import { formatToolApproval, formatToolResult, formatToolRunning } from './formatting';
import type { PendingApprovalRecord } from './stream-helpers';
import { ToolTracker, postFileAttachment, postStreamError, postTripwire } from './stream-helpers';

export interface StaticDriverArgs {
  stream: AsyncIterable<AgentChunkType<any>>;
  sdkThread: Thread;
  adapter: Adapter;
  /** After `resolveToolDisplay`, non-streaming tool display is one of these two. */
  toolDisplay: 'cards' | 'hidden';
  /**
   * Whether to render tool cards as rich Block Kit (`true`) or plain text.
   * @deprecated Use `toolDisplay: 'cards'` instead
   * */
  useCards: boolean;
  channelToolNames: Set<string>;
  logger?: IMastraLogger;
  /**
   * Optional override for tool-call rendering. When set, the eager
   * "Running…" card is skipped and this is called once per tool with the
   * full result (or error). Return `null` to suppress the message entirely.
   * Only available in `'cards'` mode.
   */
  formatToolCall?: (info: {
    toolName: string;
    args: Record<string, unknown>;
    result: unknown;
    isError?: boolean;
  }) => PostableMessage | null;
  onApprovalPosted: (toolCallId: string, record: PendingApprovalRecord) => void;
  getPendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  takePendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  /** Optional adapter-supplied formatter for `error` chunks; defaults to a plain prefix. */
  formatError?: (error: Error) => unknown;
}

/**
 * Static (non-streaming) driver: consumes `AgentChunkType<any>` chunks and
 * renders them through discrete `sdkThread.post` / `adapter.editMessage`
 * calls. Handles `'cards'` (per-tool "Running…" → "Result" cards) and
 * `'hidden'` (silent tool execution, one final text post) tool-display modes.
 *
 * No streaming session is opened — text accumulates in a buffer and flushes
 * on any side-effect (tool call, file, finish, error). OM `data-om-*` chunks
 * are intentionally ignored: OM widgets only render inside a streaming Plan.
 */
export async function runStaticDriver({
  stream,
  sdkThread,
  adapter,
  toolDisplay,
  useCards,
  channelToolNames,
  logger,
  formatToolCall,
  onApprovalPosted,
  getPendingApproval,
  takePendingApproval,
  formatError,
}: StaticDriverArgs): Promise<void> {
  const platform = adapter.name;

  const tracker = new ToolTracker();
  let textBuffer = '';

  // Stash messageId of the eager "Running…" card per toolCallId so the
  // tool-result / tool-error handler can edit the same message instead of
  // posting a second one. (The tracker captures the display data; this map
  // captures the platform-specific message handle.)
  const toolMessageIds = new Map<string, string | undefined>();

  const flushText = async () => {
    // Strip zero-width chars (U+200B, U+200C, U+200D, U+FEFF) that LLMs
    // sometimes emit, then post the accumulated text as a single message.
    const cleaned = textBuffer.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (cleaned) {
      try {
        await sdkThread.post(cleaned);
      } catch (e) {
        logger?.debug('[CHANNEL] Failed to post buffered text', { error: e });
      }
    }
    textBuffer = '';
  };

  const editOrPost = async (messageId: string | undefined, content: PostableMessage) => {
    if (messageId) {
      try {
        await adapter.editMessage(sdkThread.id, messageId, content);
        return messageId;
      } catch {
        const sent = await sdkThread.post(content);
        return sent?.id;
      }
    }
    const sent = await sdkThread.post(content);
    return sent?.id;
  };

  const resetRunState = () => {
    textBuffer = '';
    tracker.reset();
    toolMessageIds.clear();
  };

  for await (const chunk of stream) {
    // --- data-* parts: signal echoes + OM (ignored in static mode) ---
    const chunkType = chunk.type as string;
    if (typeof chunkType === 'string' && chunkType.startsWith('data-')) {
      if (chunkType === 'data-user-message') {
        // Flush any in-flight text so the agent's reply to the signal
        // posts as its own message after the user's signal echo.
        await flushText();
      }
      // OM and other data-* parts are dropped silently — no Plan widget to
      // render OM lifecycle into in static mode.
      continue;
    }

    if (chunk.type === 'text-delta') {
      const piece = chunk.payload.text;
      if (piece) textBuffer += piece;
      continue;
    }

    if (chunk.type === 'text-end') {
      // Flush as soon as the model finishes a text block so the message
      // posts before any subsequent tool-call card.
      await flushText();
      continue;
    }

    if (chunk.type === 'step-finish') {
      // Flush text accumulated in this step. Tool cards have already been
      // posted as they happened (cards mode) or suppressed (hidden mode),
      // so there's nothing to do for tools here.
      await flushText();
      continue;
    }

    if (chunk.type === 'file') {
      await flushText();
      await postFileAttachment({ chunk, sdkThread, logger });
      continue;
    }

    if (chunk.type === 'finish') {
      await flushText();
      resetRunState();
      continue;
    }

    if (chunk.type === 'error') {
      await flushText();
      await postStreamError({ chunk, sdkThread, platform, logger, formatError });
      resetRunState();
      continue;
    }

    if (chunk.type === 'abort') {
      await flushText();
      resetRunState();
      continue;
    }

    if (chunk.type === 'tool-call') {
      if (channelToolNames.has(chunk.payload.toolName)) continue;
      const enr = tracker.trackStart({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      });

      if (toolDisplay === 'hidden') continue; // silent, just track

      // Cards mode: flush any in-flight text first so the card lands after
      // it, then post an eager "Running…" card the result handler will edit
      // in place. Skip the eager post when a custom `formatToolCall` is
      // configured — that runs once on tool-result with the full result and
      // we don't want a leading placeholder card.
      await flushText();
      if (!formatToolCall) {
        const sent = await sdkThread.post(formatToolRunning(enr.displayName, enr.argsSummary, useCards));
        toolMessageIds.set(enr.toolCallId, sent?.id);
      } else {
        toolMessageIds.set(enr.toolCallId, undefined);
      }
      continue;
    }

    if (chunk.type === 'tool-result') {
      if (channelToolNames.has(chunk.payload.toolName)) continue;
      const enr = tracker.enrichResult({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
        result: chunk.payload.result,
        isError: chunk.payload.isError,
      });
      // Pop any approval-card stash so it doesn't leak across runs.
      const approvalStash = takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;

      // `messageId` falls back to the approval card when the resumed run
      // arrives via the subscription stream without ever firing `tool-call`
      // for this consumer.
      const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
      toolMessageIds.delete(enr.toolCallId);

      if (formatToolCall) {
        const custom = formatToolCall({
          toolName: enr.displayName,
          args: (enr.args ?? {}) as Record<string, unknown>,
          result: chunk.payload.result,
          isError: chunk.payload.isError,
        });
        if (custom != null) {
          await editOrPost(messageId, custom);
        }
      } else {
        const resultMessage = formatToolResult(
          enr.displayName,
          enr.argsSummary,
          enr.resultText ?? '',
          !!chunk.payload.isError,
          enr.durationMs,
          useCards,
        );
        await editOrPost(messageId, resultMessage);
      }
      continue;
    }

    if (chunk.type === 'tool-error') {
      if (channelToolNames.has(chunk.payload.toolName)) continue;
      const enr = tracker.enrichError({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
        error: chunk.payload.error,
      });
      const approvalStash = takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;

      const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
      toolMessageIds.delete(enr.toolCallId);

      if (formatToolCall) {
        const custom = formatToolCall({
          toolName: enr.displayName,
          args: (enr.args ?? {}) as Record<string, unknown>,
          result: chunk.payload.error,
          isError: true,
        });
        if (custom != null) {
          await editOrPost(messageId, custom);
        }
      } else {
        const resultMessage = formatToolResult(
          enr.displayName,
          enr.argsSummary,
          enr.errorText ?? '',
          true,
          enr.durationMs,
          useCards,
        );
        await editOrPost(messageId, resultMessage);
      }
      continue;
    }

    if (chunk.type === 'tool-call-approval') {
      const enr = tracker.enrichApproval({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      });
      // Approval cards always render as rich Block Kit so the Approve/Deny
      // buttons render. Non-cards modes never opt out via `useCards: false`.
      const approvalMessage = formatToolApproval(enr.displayName, enr.argsSummary, enr.toolCallId, true);
      const existingMessageId = toolMessageIds.get(enr.toolCallId) ?? getPendingApproval(enr.toolCallId)?.messageId;
      const finalMessageId = await editOrPost(existingMessageId, approvalMessage);
      // Stash by toolCallId so the click handler can resume the correct
      // run directly. The persisted-metadata path keys by toolName and
      // collides on parallel same-tool approvals.
      onApprovalPosted(enr.toolCallId, {
        messageId: finalMessageId,
        displayName: enr.displayName,
        argsSummary: enr.argsSummary,
        startedAt: Date.now(),
        runId: (chunk as { runId?: string }).runId,
        toolName: enr.toolName,
        args: (enr.args ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    if (chunk.type === 'tripwire') {
      // retry=true means the agent will retry internally and produce a new
      // response on this same stream, so nothing to post yet.
      if (chunk.payload.retry) continue;
      await flushText();
      await postTripwire({ chunk, sdkThread, logger });
      continue;
    }

    // Other chunk types (reasoning-*, start, step-start, etc.) are
    // intentionally ignored — they don't map to a rendered output.
  }

  // Drain whatever's still buffered when the stream ends.
  await flushText();
}
