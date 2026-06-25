import type { Adapter, StreamChunk, Thread } from 'chat';
import type { IMastraLogger } from '../logger/logger';
import type { AgentChunkType } from '../stream/types';
import {
  formatArgsSummary,
  formatResult,
  formatToolApproval,
  formatToolResult,
  formatToolRunning,
  stripToolPrefix,
} from './formatting';
import type { PostableMessage, ToolDisplayEvent } from './types';

/**
 * Approval card metadata stashed when a driver posts an approval card. The
 * outer `AgentChannels` instance uses it to resume the correct run by
 * `toolCallId` without crawling persisted message metadata (the metadata
 * path keys by `toolName` and collides on parallel same-tool approvals).
 */
export interface PendingApprovalRecord {
  messageId?: string;
  displayName: string;
  argsSummary: string;
  startedAt: number;
  runId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  /**
   * Set only for the Harness channel path: the `resourceId` of the durable
   * Harness Session that owns this parked tool call. The approval-button
   * handler uses it to resolve the exact Session to resume (via
   * `session.approveToolCall` / `session.declineToolCall`) instead of going
   * through the agent. Absent for the Agent path, which resumes by `runId`.
   */
  sessionResourceId?: string;
}

/**
 * Per-tool enrichment data both drivers compute identically:
 * display name (without `mastra_*_` prefix), human-readable args summary,
 * wall-clock start time, and (for terminal chunks) duration / result text.
 */
export interface ToolEnrichment {
  toolCallId: string;
  toolName: string;
  displayName: string;
  argsSummary: string;
  args: unknown;
  startedAt: number;
  /** Set on enrichResult / enrichError when the tool was previously tracked. */
  durationMs?: number;
  /** Set on enrichResult. */
  resultText?: string;
  /** Set on enrichError. */
  errorText?: string;
  /** Set on enrichResult / enrichError. */
  isError?: boolean;
}

interface TrackedTool {
  toolName: string;
  displayName: string;
  argsSummary: string;
  args: unknown;
  startedAt: number;
}

/**
 * Cross-chunk correlation for tool calls. A single instance lives for the
 * lifetime of a `consumeAgentStream` run (or driver run). `trackStart` is
 * called for `tool-call`, then `enrichResult` / `enrichError` /
 * `enrichApproval` look up the matching start to enrich the terminal chunk
 * with the original `displayName` / `argsSummary` / `startedAt` (since later
 * chunks may not carry the original args verbatim).
 *
 * Keyed by `toolCallId` (not `toolName`) so parallel same-tool calls don't
 * clobber each other — a regression that previously broke parallel
 * `requireApproval` flows.
 */
export class ToolTracker {
  private tools = new Map<string, TrackedTool>();

  /** Returns the number of tool calls currently in flight. */
  get inFlightCount(): number {
    return this.tools.size;
  }

  /** Returns true if `toolCallId` has a tracked start. */
  has(toolCallId: string): boolean {
    return this.tools.has(toolCallId);
  }

  trackStart(call: { toolCallId: string; toolName: string; args: unknown }): ToolEnrichment {
    const displayName = stripToolPrefix(call.toolName);
    const argsObj = typeof call.args === 'object' && call.args != null ? call.args : {};
    const argsSummary = formatArgsSummary(argsObj);
    const startedAt = Date.now();
    this.tools.set(call.toolCallId, {
      toolName: call.toolName,
      displayName,
      argsSummary,
      args: call.args,
      startedAt,
    });
    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      displayName,
      argsSummary,
      args: call.args,
      startedAt,
    };
  }

  enrichResult(call: {
    toolCallId: string;
    toolName: string;
    args: unknown;
    result: unknown;
    isError?: boolean;
  }): ToolEnrichment {
    const tracked = this.tools.get(call.toolCallId);
    const displayName = tracked?.displayName ?? stripToolPrefix(call.toolName);
    const argsSummary =
      tracked?.argsSummary ?? formatArgsSummary(typeof call.args === 'object' && call.args != null ? call.args : {});
    const args = tracked?.args ?? call.args;
    const startedAt = tracked?.startedAt ?? Date.now();
    const durationMs = tracked ? Date.now() - tracked.startedAt : undefined;
    const isError = !!call.isError;
    const resultText = formatResult(call.result, isError);
    this.tools.delete(call.toolCallId);
    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      displayName,
      argsSummary,
      args,
      startedAt,
      durationMs,
      resultText,
      isError,
    };
  }

  enrichError(call: { toolCallId: string; toolName: string; args: unknown; error: unknown }): ToolEnrichment {
    const tracked = this.tools.get(call.toolCallId);
    const displayName = tracked?.displayName ?? stripToolPrefix(call.toolName);
    const argsSummary =
      tracked?.argsSummary ?? formatArgsSummary(typeof call.args === 'object' && call.args != null ? call.args : {});
    const args = tracked?.args ?? call.args;
    const startedAt = tracked?.startedAt ?? Date.now();
    const durationMs = tracked ? Date.now() - tracked.startedAt : undefined;
    const errorText = formatResult(extractErrorMessage(call.error), true);
    this.tools.delete(call.toolCallId);
    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      displayName,
      argsSummary,
      args,
      startedAt,
      durationMs,
      errorText,
      isError: true,
    };
  }

  enrichApproval(call: { toolCallId: string; toolName: string; args: unknown }): ToolEnrichment {
    const tracked = this.tools.get(call.toolCallId);
    const displayName = tracked?.displayName ?? stripToolPrefix(call.toolName);
    const argsSummary =
      tracked?.argsSummary ?? formatArgsSummary(typeof call.args === 'object' && call.args != null ? call.args : {});
    const args = tracked?.args ?? call.args;
    const startedAt = tracked?.startedAt ?? Date.now();
    return {
      toolCallId: call.toolCallId,
      toolName: call.toolName,
      displayName,
      argsSummary,
      args,
      startedAt,
    };
  }

  forget(toolCallId: string): void {
    this.tools.delete(toolCallId);
  }

  reset(): void {
    this.tools.clear();
  }
}

/**
 * Pull a human-readable message out of a `tool-error` chunk's `error` payload.
 * The error can be a string, an `Error`-shaped object, a `MastraError`-shaped
 * object with `message`/`details.errorMessage`, or anything else — fall back
 * to the raw value so the failure stays debuggable.
 */
export function extractErrorMessage(error: unknown): unknown {
  if (error == null) return error;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string' && err.message.length > 0) return err.message;
    const details = err.details as Record<string, unknown> | undefined;
    if (details && typeof details.errorMessage === 'string') return details.errorMessage;
  }
  return error;
}

/**
 * Post an `error` chunk's payload as a user-visible message. Both drivers
 * call this after closing/flushing their active session so the error lands
 * after the streamed text. Honors a caller-supplied `formatError` to allow
 * adapters to customize the rendering; falls back to a plain `❌ Error: ...`
 * prefix otherwise.
 */
export async function postStreamError(args: {
  chunk: Extract<AgentChunkType<any>, { type: 'error' }>;
  chatThread: Pick<Thread, 'post'>;
  platform: string;
  logger?: IMastraLogger;
  formatError?: (error: Error) => unknown;
}): Promise<void> {
  const { chunk, chatThread, platform, logger, formatError } = args;
  const errPayload = chunk.payload as { error?: unknown };
  const rawError = errPayload.error;
  // Reuse extractErrorMessage so structured errors (MastraError, plain
  // objects with `message`/`details.errorMessage`) don't render as
  // "[object Object]".
  const extracted = extractErrorMessage(rawError);
  let message: string;
  if (typeof extracted === 'string' && extracted.length > 0) {
    message = extracted;
  } else if (extracted == null) {
    message = 'Unknown error';
  } else {
    message = String(extracted);
  }
  const display = message.length > 500 ? message.slice(0, 500) + '…' : message;
  logger?.error?.(`[${platform}] Stream completed with error`, { error: display });
  const postable = formatError
    ? formatError(rawError instanceof Error ? rawError : new Error(display))
    : `❌ Error: ${display}`;
  try {
    await chatThread.post(postable as Parameters<Thread['post']>[0]);
  } catch (postErr) {
    logger?.debug?.('[CHANNEL] Failed to post error message', { error: postErr });
  }
}

/**
 * Post a `tripwire` chunk's payload as a user-visible safety-block message.
 * Skipped when the tripwire is marked `retry: true` — the agent will retry
 * internally and produce a new response on the same stream.
 */
export async function postTripwire(args: {
  chunk: Extract<AgentChunkType<any>, { type: 'tripwire' }>;
  chatThread: Pick<Thread, 'post'>;
  logger?: IMastraLogger;
}): Promise<void> {
  const { chunk, chatThread, logger } = args;
  const payload = chunk.payload as { retry?: boolean; reason?: string; processorId?: string };
  if (payload.retry) return;
  const reason = payload.reason || 'Your message was blocked by a safety check.';
  const display = payload.processorId ? `🛡️ Blocked by ${payload.processorId}: ${reason}` : `🛡️ ${reason}`;
  try {
    await chatThread.post(display);
  } catch (e) {
    logger?.debug?.('[CHANNEL] Failed to post tripwire message', { error: e });
  }
}

/**
 * Post a `file` chunk's payload as a thread attachment. The chunk's `data`
 * may be base64-encoded (string) or raw bytes (`Uint8Array`).
 */
export async function postFileAttachment(args: {
  chunk: Extract<AgentChunkType<any>, { type: 'file' }>;
  chatThread: Pick<Thread, 'post'>;
  logger?: IMastraLogger;
}): Promise<void> {
  const { chunk, chatThread, logger } = args;
  const { data, mimeType } = chunk.payload as { data: string | Uint8Array; mimeType: string };
  logger?.debug?.('[CHANNEL] Received file chunk', {
    mimeType,
    dataType: typeof data,
    size: typeof data === 'string' ? data.length : (data as Uint8Array)?.byteLength,
  });
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const filename = `generated.${ext}`;
  const binary =
    typeof data === 'string' ? Buffer.from(data, 'base64') : data instanceof Uint8Array ? Buffer.from(data) : data;
  try {
    await chatThread.post({ markdown: ' ', files: [{ data: binary, filename, mimeType }] } as Parameters<
      Thread['post']
    >[0]);
  } catch (e) {
    logger?.debug?.('[CHANNEL] Failed to post file attachment', { error: e, mimeType, filename });
  }
}

/**
 * Edit an existing message by id when one was previously posted, otherwise
 * post a fresh one. Both drivers use this for the per-tool card lifecycle
 * (post "Running…" → edit with result/error/approval). If the edit fails
 * (e.g. the original message was deleted), falls back to posting a new one.
 *
 * Returns the resulting message id — the static driver tracks this so a
 * later `tool-result` can edit the same card; the streaming driver doesn't
 * persist follow-up edits past the result, so it ignores the return value.
 */
export async function editOrPostMessage(args: {
  adapter: Pick<Adapter<any, any>, 'editMessage'>;
  chatThread: Pick<Thread, 'id' | 'post'>;
  messageId: string | undefined;
  message: PostableMessage;
  logger?: IMastraLogger;
}): Promise<string | undefined> {
  const { adapter, chatThread, messageId, message, logger } = args;
  if (messageId) {
    try {
      await adapter.editMessage(chatThread.id, messageId, message);
      return messageId;
    } catch (e) {
      logger?.debug?.('[CHANNEL] edit failed, falling back to post', { error: e });
    }
  }
  try {
    const sent = await chatThread.post(message);
    return sent?.id;
  } catch (e) {
    logger?.debug?.('[CHANNEL] edit-fallback post failed', { error: e });
    return undefined;
  }
}

/**
 * Render a built-in `'cards'` or `'text'` tool event as a `PostableMessage`.
 * Both drivers go through this so the lifecycle (post → edit on result) is
 * identical — only the platform-specific post/edit calls differ.
 *
 * `'cards'` → rich Block Kit; `'text'` → plain text. Approval messages are
 * always rendered as cards regardless of mode so the Approve/Deny buttons
 * render — plain-text approval falls back to a "reply approve/deny" hint.
 */
export function renderBuiltInToolEvent(event: ToolDisplayEvent, mode: 'cards' | 'text'): PostableMessage {
  const useCards = mode === 'cards';
  if (event.kind === 'running') {
    return formatToolRunning(event.displayName, event.argsSummary, useCards);
  }
  if (event.kind === 'result') {
    return formatToolResult(
      event.displayName,
      event.argsSummary,
      event.resultText,
      event.isError,
      event.durationMs,
      useCards,
    );
  }
  if (event.kind === 'error') {
    return formatToolResult(event.displayName, event.argsSummary, event.errorText, true, event.durationMs, useCards);
  }
  // Approval: always cards (need Approve/Deny buttons). `useCards: false`
  // falls back to a plain "reply approve/deny" hint.
  return formatToolApproval(event.displayName, event.argsSummary, event.toolCallId, true);
}

/**
 * Render a chat-SDK `StreamChunk` as a plain-text fallback message. Used by
 * the static driver when a `ToolDisplayFn` returns `{ kind: 'stream' }` —
 * the static driver has no `StreamingPlan` to push the chunk into, so we
 * flatten it to text so the user still sees the rendered output.
 *
 * Returns `null` for chunks that have nothing useful to render in static
 * mode (e.g. a `text-delta` mid-stream signal, or a `task_update` with no
 * title/details). Callers should treat `null` as "skip this event" rather
 * than posting an empty message.
 */
export function chunkToFallbackMessage(chunk: StreamChunk): string | null {
  if (chunk.type === 'markdown_text') {
    return typeof chunk.text === 'string' && chunk.text.length > 0 ? chunk.text : null;
  }
  if (chunk.type === 'task_update') {
    const status = chunk.status ? ` · ${chunk.status}` : '';
    const head = `${chunk.title ?? ''}${status}`.trim();
    const body = chunk.details ?? chunk.output ?? '';
    const text = body ? `${head}\n${body}` : head;
    return text.length > 0 ? text : null;
  }
  if (chunk.type === 'plan_update') {
    return chunk.title && chunk.title.length > 0 ? chunk.title : null;
  }
  return null;
}
