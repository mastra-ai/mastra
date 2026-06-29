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
   * When the agent's text output is posted:
   * - `'progressive'` (default) — flush each text block as it completes
   *   (`text-end` / `step-finish` / before a tool card / on `file`), matching
   *   prior behavior.
   * - `'final'` — suppress those intermediate flushes; accumulate text across
   *   all blocks/steps and post it once, joined with a blank line, on the
   *   terminal chunk (`finish` / `error` / `abort`).
   */
  textDisplay?: 'progressive' | 'final';
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
  textDisplay = 'progressive',
}: StaticDriverArgs): Promise<void> {
  const platform = adapter.name;
  const postProgressively = textDisplay !== 'final';

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
  // In `'final'` mode, completed text blocks accumulate here instead of being
  // posted; the terminal flush joins them with a blank line and posts once.
  const finalTextBlocks: string[] = [];

  const cleanText = (raw: string) => raw.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  // Stash messageId of the eager "Running…" card per toolCallId so the
  // tool-result / tool-error handler can edit the same message instead of
  // posting a second one. (The tracker captures the display data; this map
  // captures the platform-specific message handle.)
  const toolMessageIds = new Map<string, string | undefined>();

  const postText = async (content: string) => {
    if (!content) return;
    try {
      await chatThread.post(content);
    } catch (e) {
      logger?.debug('[CHANNEL] Failed to post buffered text', { error: e });
    }
  };

  // Progressive: post the in-flight text block now. Final: stash the cleaned
  // block (so it survives `resetRunState`) and defer posting to the terminal
  // flush. Strips zero-width chars (U+200B-U+200D, U+FEFF) LLMs sometimes emit.
  const flushText = async () => {
    const cleaned = cleanText(textBuffer);
    textBuffer = '';
    if (!cleaned) return;
    if (postProgressively) {
      await postText(cleaned);
    } else {
      finalTextBlocks.push(cleaned);
    }
  };

  // Only flush in progressive mode; in `'final'` mode intermediate flush points
  // (`text-end` / `step-finish` / pre-tool-call / `file` / `data-user-message`)
  // keep accumulating instead of posting.
  const flushIfProgressive = async () => {
    if (postProgressively) await flushText();
  };

  // Terminal flush: in `'final'` mode, fold the in-flight buffer into the
  // accumulated blocks and post them all as one message joined with a blank
  // line. In progressive mode this is just a normal flush of the last block.
  const flushTerminal = async () => {
    if (postProgressively) {
      await flushText();
      return;
    }
    const tail = cleanText(textBuffer);
    textBuffer = '';
    if (tail) finalTextBlocks.push(tail);
    const combined = finalTextBlocks.join('\n\n');
    finalTextBlocks.length = 0;
    await postText(combined);
  };

  const editOrPost = (messageId: string | undefined, content: PostableMessage) =>
    editOrPostMessage({ adapter, chatThread, messageId, message: content, logger });

  const resetRunState = () => {
    textBuffer = '';
    finalTextBlocks.length = 0;
    tracker.reset();
    toolMessageIds.clear();
  };

  for await (const chunk of stream) {
    // --- data-* parts: signal echoes + OM (ignored in static mode) ---
    const chunkType = chunk.type as string;
    if (typeof chunkType === 'string' && chunkType.startsWith('data-')) {
      if (chunkType === 'data-user-message') {
        // Flush any in-flight text so the agent's reply to the signal
        // posts as its own message after the user's signal echo. In `'final'`
        // mode this is suppressed — a single post at the end is the point.
        await flushIfProgressive();
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
      // posts before any subsequent tool-call card. In `'final'` mode the
      // block is accumulated, not posted.
      await flushIfProgressive();
      continue;
    }

    if (chunk.type === 'step-finish') {
      // Flush text accumulated in this step. Tool cards have already been
      // posted as they happened (cards mode) or suppressed (hidden mode),
      // so there's nothing to do for tools here. Suppressed in `'final'` mode.
      await flushIfProgressive();
      continue;
    }

    if (chunk.type === 'file') {
      await flushIfProgressive();
      await postFileAttachment({ chunk, chatThread, logger });
      continue;
    }

    if (chunk.type === 'finish') {
      await flushTerminal();
      resetRunState();
      continue;
    }

    if (chunk.type === 'error') {
      await flushTerminal();
      await postStreamError({ chunk, chatThread, platform, logger, formatError });
      resetRunState();
      continue;
    }

    if (chunk.type === 'abort') {
      await flushTerminal();
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

      // Close the in-flight text block so the per-tool message lands after it.
      // Progressive mode posts it now; `'final'` mode accumulates it (no post)
      // so it still joins the final message in order.
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
