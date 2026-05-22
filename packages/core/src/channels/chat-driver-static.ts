import type { Adapter, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { AgentChunkType } from '../stream/types';
import type { PendingApprovalRecord } from './stream-helpers';
import {
  ToolTracker,
  chunkToFallbackMessage,
  editOrPostMessage,
  postFileAttachment,
  postStreamError,
  postTripwire,
  renderBuiltInToolEvent,
} from './stream-helpers';
import type { PostableMessage, ToolDisplayEvent, ToolDisplayFn } from './types';

export interface StaticDriverArgs {
  stream: AsyncIterable<AgentChunkType<any>>;
  chatThread: Thread;
  adapter: Adapter;
  /** After `resolveToolDisplay`, non-streaming tool display is one of these. */
  toolDisplay: 'cards' | 'text' | 'hidden';
  /**
   * Optional function-form `toolDisplay` callback. When set, the built-in
   * renderers are bypassed and this is called once per tool lifecycle event
   * (running, result, error, approval).
   */
  toolDisplayFn?: ToolDisplayFn;
  channelToolNames: Set<string>;
  logger?: IMastraLogger;
  onApprovalPosted: (toolCallId: string, record: PendingApprovalRecord) => void;
  getPendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  takePendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  /** Optional adapter-supplied formatter for `error` chunks; defaults to a plain prefix. */
  formatError?: (error: Error) => unknown;
}

/**
 * Static (non-streaming) driver: consumes `AgentChunkType<any>` chunks and
 * renders them through discrete `chatThread.post` / `adapter.editMessage`
 * calls. Handles `'cards'` (per-tool "Running…" → "Result" cards) and
 * `'hidden'` (silent tool execution, one final text post) tool-display modes.
 *
 * No streaming session is opened — text accumulates in a buffer and flushes
 * on any side-effect (tool call, file, finish, error). OM `data-om-*` chunks
 * are intentionally ignored: OM widgets only render inside a streaming Plan.
 */
export async function runStaticDriver({
  stream,
  chatThread,
  adapter,
  toolDisplay,
  toolDisplayFn,
  channelToolNames,
  logger,
  onApprovalPosted,
  getPendingApproval,
  takePendingApproval,
  formatError,
}: StaticDriverArgs): Promise<void> {
  const platform = adapter.name;

  /**
   * Dispatch a tool lifecycle event to either the user-supplied
   * `toolDisplayFn` or the built-in `'cards'`/`'text'` renderer. Returns
   * `null` when the fn returned `undefined` (skip) or `{ kind: 'post', message: null }`.
   * `{ kind: 'stream' }` is flattened to a plain-text fallback since the
   * static driver has no streaming session to push into.
   */
  const renderToolEvent = (event: ToolDisplayEvent): PostableMessage | null => {
    if (toolDisplayFn) {
      const result = toolDisplayFn(event, { mode: 'static', platform });
      if (result == null) return null;
      if (result.kind === 'post') {
        // Skip blank posts so a fn that intentionally returns "" doesn't
        // post an empty message into the chat.
        if (result.message == null) return null;
        if (typeof result.message === 'string' && result.message.length === 0) return null;
        return result.message;
      }
      if (result.kind === 'stream') return chunkToFallbackMessage(result.chunk);
      return null;
    }
    if (toolDisplay === 'hidden') return null;
    return renderBuiltInToolEvent(event, toolDisplay);
  };

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
        await chatThread.post(cleaned);
      } catch (e) {
        logger?.debug('[CHANNEL] Failed to post buffered text', { error: e });
      }
    }
    textBuffer = '';
  };

  const editOrPost = (messageId: string | undefined, content: PostableMessage) =>
    editOrPostMessage({ adapter, chatThread, messageId, message: content, logger });

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
      await postFileAttachment({ chunk, chatThread, logger });
      continue;
    }

    if (chunk.type === 'finish') {
      await flushText();
      resetRunState();
      continue;
    }

    if (chunk.type === 'error') {
      await flushText();
      await postStreamError({ chunk, chatThread, platform, logger, formatError });
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

      // Always flush in-flight text so the per-tool message lands after it.
      await flushText();

      // Skip the eager "Running…" post when a custom `toolDisplayFn` is set
      // — most fns prefer to render once on `result` with the full output
      // and we don't want a leading placeholder card to edit/replace.
      if (toolDisplayFn) {
        toolMessageIds.set(enr.toolCallId, undefined);
        continue;
      }

      if (toolDisplay === 'hidden') continue; // silent, just track

      const running = renderToolEvent({
        kind: 'running',
        toolCallId: enr.toolCallId,
        toolName: enr.toolName,
        displayName: enr.displayName,
        argsSummary: enr.argsSummary,
        args: enr.args,
      });
      if (running != null) {
        const sent = await chatThread.post(running);
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

      // `messageId` falls back to the approval card when the resumed run
      // arrives via the subscription stream without ever firing `tool-call`
      // for this consumer.
      const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
      toolMessageIds.delete(enr.toolCallId);

      const result = renderToolEvent({
        kind: 'result',
        toolCallId: enr.toolCallId,
        toolName: enr.toolName,
        displayName: enr.displayName,
        argsSummary: enr.argsSummary,
        args: enr.args,
        result: chunk.payload.result,
        resultText: enr.resultText ?? '',
        durationMs: enr.durationMs ?? 0,
        isError: !!chunk.payload.isError,
      });
      if (result != null) {
        await editOrPost(messageId, result);
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

      const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
      toolMessageIds.delete(enr.toolCallId);

      const errored = renderToolEvent({
        kind: 'error',
        toolCallId: enr.toolCallId,
        toolName: enr.toolName,
        displayName: enr.displayName,
        argsSummary: enr.argsSummary,
        args: enr.args,
        error: chunk.payload.error,
        errorText: enr.errorText ?? '',
        durationMs: enr.durationMs ?? 0,
      });
      if (errored != null) {
        await editOrPost(messageId, errored);
      }
      continue;
    }

    if (chunk.type === 'tool-call-approval') {
      const enr = tracker.enrichApproval({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      });
      const approvalMessage = renderToolEvent({
        kind: 'approval',
        toolName: enr.toolName,
        displayName: enr.displayName,
        argsSummary: enr.argsSummary,
        args: enr.args,
        toolCallId: enr.toolCallId,
      });
      const existingMessageId = toolMessageIds.get(enr.toolCallId) ?? getPendingApproval(enr.toolCallId)?.messageId;
      const finalMessageId =
        approvalMessage != null ? await editOrPost(existingMessageId, approvalMessage) : existingMessageId;
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
      await postTripwire({ chunk, chatThread, logger });
      continue;
    }

    // Other chunk types (reasoning-*, start, step-start, etc.) are
    // intentionally ignored — they don't map to a rendered output.
  }

  // Drain whatever's still buffered when the stream ends.
  await flushText();
}
