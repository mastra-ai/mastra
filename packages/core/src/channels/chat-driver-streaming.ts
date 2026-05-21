import type { Adapter, StreamChunk, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { AgentChunkType } from '../stream/types';
import { chatModule } from './chat-lazy';
import { formatToolApproval } from './formatting';
import { asOmChunk, renderOmTaskUpdate } from './om';
import type { PendingApprovalRecord } from './stream-helpers';
import { ToolTracker, postFileAttachment, postStreamError, postTripwire } from './stream-helpers';

export interface StreamingDriverArgs {
  stream: AsyncIterable<AgentChunkType<any>>;
  sdkThread: Thread;
  adapter: Adapter;
  /** After `resolveToolDisplay`, streaming-mode tool display is one of these three. */
  toolDisplay: 'timeline' | 'grouped' | 'hidden';
  streamingOptions?: { updateIntervalMs?: number };
  channelToolNames: Set<string>;
  logger?: IMastraLogger;
  /**
   * Called when an approval card is posted so the outer channels instance
   * can resume the correct run on click. The driver doesn't know how the
   * click handler looks up the runId — it just stashes the record.
   */
  onApprovalPosted: (toolCallId: string, record: PendingApprovalRecord) => void;
  /**
   * Read access to the approval-card stash so a `tool-result` that arrives
   * via the resumed run's subscription (skipping the original `tool-call`)
   * can still find the original card's `messageId` to edit.
   */
  getPendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  /**
   * Pop the stash entry for `toolCallId` — used by terminal chunks
   * (`tool-result`, `tool-error`) so the stash doesn't leak across runs.
   */
  takePendingApproval: (toolCallId: string) => PendingApprovalRecord | undefined;
  /**
   * Shared mutable flag the typing-status wrapper reads. The driver flips
   * `active = true` while a `StreamingPlan` post is in flight so the wrapper
   * skips `startTyping` (Slack's `assistant.threads.setStatus` doesn't
   * auto-clear on `chat.stopStream`, only on `chat.postMessage`, so a status
   * set during streaming would stick after the run ends).
   */
  typingGate: { active: boolean };
  /** Optional adapter-supplied formatter for `error` chunks; defaults to a plain prefix. */
  formatError?: (error: Error) => unknown;
}

interface StreamingSession {
  push: (piece: string | StreamChunk) => void;
  close: () => void;
  done: Promise<void>;
}

/**
 * Streaming driver: consumes `AgentChunkType<any>` chunks and renders them
 * through one or more chat-SDK `StreamingPlan` posts. Handles `timeline`,
 * `grouped`, and `hidden` tool-display modes (all of which require
 * `streaming: true`). Out-of-band chunks (approval, file, tripwire, error)
 * close the current session, post separately, then optionally reopen on the
 * next text/tool chunk.
 */
export async function runStreamingDriver({
  stream,
  sdkThread,
  adapter,
  toolDisplay,
  streamingOptions,
  channelToolNames,
  logger,
  onApprovalPosted,
  getPendingApproval,
  takePendingApproval,
  typingGate,
  formatError,
}: StreamingDriverArgs): Promise<void> {
  const platform = adapter.name;

  const groupTasks: 'plan' | 'timeline' | undefined =
    toolDisplay === 'timeline' ? 'timeline' : toolDisplay === 'grouped' ? 'plan' : undefined;

  const tracker = new ToolTracker();
  // Box the session in a ref object so TypeScript's CFA can't narrow it to
  // `null` across closure-mutation boundaries (we open/close via
  // `pushToSession` / `closeSession` helpers that mutate `sessionRef.current`,
  // and a plain `let` would get narrowed to its initial `null` between
  // iterations of the for-await loop).
  const sessionRef: { current: StreamingSession | null } = { current: null };

  const openSession = (): StreamingSession => {
    let buffer: (string | StreamChunk)[] = [];
    let closed = false;
    let resolveNext: (() => void) | undefined;
    const waitForNext = () =>
      new Promise<void>(resolve => {
        resolveNext = resolve;
      });

    async function* iterate(): AsyncGenerator<string | StreamChunk> {
      while (true) {
        while (buffer.length > 0) {
          yield buffer.shift()!;
        }
        if (closed) return;
        await waitForNext();
      }
    }

    const iterable = iterate();
    const postable = streamingOptions
      ? new (chatModule().StreamingPlan)(iterable, {
          updateIntervalMs: streamingOptions.updateIntervalMs,
          ...(groupTasks ? { groupTasks } : {}),
        })
      : iterable;

    typingGate.active = true;
    const done = (async () => {
      try {
        await sdkThread.post(postable as Parameters<Thread['post']>[0]);
      } catch (e) {
        logger?.warn('[CHANNEL] streaming post failed, falling back to buffered text', { error: e });
        // Drain whatever was queued plus anything pushed after the failure
        // and post it as a single buffered message. Drop non-string chunks
        // (task_update etc.) since the buffered fallback is text-only. Keep
        // draining until the stream actually closes so late text-deltas
        // don't get dropped from the fallback message.
        let fallback = '';
        while (true) {
          fallback += buffer.filter((p): p is string => typeof p === 'string').join('');
          buffer = [];
          if (closed) break;
          await waitForNext();
        }
        const cleaned = fallback.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        if (cleaned) {
          try {
            await sdkThread.post(cleaned);
          } catch (postErr) {
            logger?.debug('[CHANNEL] buffered fallback also failed', { error: postErr });
          }
        }
      } finally {
        typingGate.active = false;
      }
    })();

    return {
      push: piece => {
        if (closed) return;
        buffer.push(piece);
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = undefined;
          r();
        }
      },
      close: () => {
        if (closed) return;
        closed = true;
        if (resolveNext) {
          const r = resolveNext;
          resolveNext = undefined;
          r();
        }
      },
      done,
    };
  };

  const closeSession = async () => {
    const s = sessionRef.current;
    if (!s) return;
    sessionRef.current = null;
    s.close();
    await s.done;
  };

  /**
   * Lazy-open the streaming session on first push. Every chunk handler that
   * renders into the plan widget goes through here — opening on demand means
   * the session only starts (and `typingGate.active` only flips) when we
   * actually have something to render. Centralising this keeps the
   * `if (!session) session = openSession(); session.push(...)` pattern out
   * of the handlers.
   */
  const pushToSession = (piece: string | StreamChunk) => {
    if (!sessionRef.current) sessionRef.current = openSession();
    sessionRef.current.push(piece);
  };

  // Cached task titles for resumed-approval runs: a `tool-result` may arrive
  // for a `toolCallId` we never saw a `tool-call` for (the approval click
  // resumed a run that suspended before this consumer attached). Falls back
  // to the approval card's stashed displayName + argsSummary.
  const lookupTaskTitle = (toolCallId: string, fallback: string): string => {
    const stash = getPendingApproval(toolCallId);
    return stash ? `${stash.displayName} ${stash.argsSummary}` : fallback;
  };

  for await (const chunk of stream) {
    // --- data-* parts: signal echo + OM lifecycle ---
    const chunkType = chunk.type as string;
    if (typeof chunkType === 'string' && chunkType.startsWith('data-')) {
      if (chunkType === 'data-user-message') {
        // The agent's reply to a signal should land as its own message after
        // the user's signal echo, so close any in-flight session.
        await closeSession();
        continue;
      }
      const om = asOmChunk(chunk);
      if (om) {
        // `cycleId` is the stable task ID across start/end/failed events.
        if (om.data.cycleId) {
          pushToSession(renderOmTaskUpdate(om));
        }
        continue;
      }
      // Other `data-*` parts (custom user data) — drop silently.
      continue;
    }

    if (chunk.type === 'text-delta') {
      const piece = chunk.payload.text;
      if (!piece) continue;
      pushToSession(piece);
      continue;
    }

    if (chunk.type === 'text-end') {
      // In `hidden` mode the text body is the only thing rendered, so close
      // the session here. That way any subsequent typing-status / approval
      // card lands cleanly after the text instead of getting swallowed into
      // the streaming post.
      if (toolDisplay === 'hidden') {
        await closeSession();
      }
      continue;
    }

    if (chunk.type === 'step-finish') {
      // Each step posts as its own StreamingPlan in timeline/hidden so the
      // user sees discrete messages per step. `grouped` keeps the session
      // open so every step's tasks merge into one plan widget.
      if (toolDisplay !== 'grouped') {
        await closeSession();
      }
      continue;
    }

    if (chunk.type === 'file') {
      await closeSession();
      await postFileAttachment({ chunk, sdkThread, logger });
      continue;
    }

    if (chunk.type === 'finish') {
      await closeSession();
      tracker.reset();
      continue;
    }

    if (chunk.type === 'error') {
      await closeSession();
      await postStreamError({ chunk, sdkThread, platform, logger, formatError });
      tracker.reset();
      continue;
    }

    if (chunk.type === 'abort') {
      await closeSession();
      tracker.reset();
      continue;
    }

    if (chunk.type === 'tool-call') {
      if (channelToolNames.has(chunk.payload.toolName)) continue;
      const enr = tracker.trackStart({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      });
      if (toolDisplay === 'hidden') {
        // In hidden mode the tool is silent, but we still want any pending
        // text to flush as its own post so the user sees a leading message
        // before the typing-status indicator kicks in for the tool run.
        await closeSession();
        continue;
      }

      // Close any active text-only session before the first tool of a step
      // in timeline mode so the preceding text posts as its own platform
      // message (Slack's AI Assistant always renders tasks above markdown
      // body within a single post). In grouped mode keep the session open
      // so every task accumulates under one plan widget.
      if (toolDisplay === 'timeline' && sessionRef.current && tracker.inFlightCount === 1) {
        await closeSession();
      }
      const taskTitle = `${enr.displayName} ${enr.argsSummary}`;
      if (toolDisplay === 'grouped') {
        // Mirror the task title (with inline args) into the plan title so
        // Slack's AI Assistant Thinking Steps widget shows the current
        // tool instead of the default "Thinking…"/"completed" label.
        pushToSession({ type: 'plan_update', title: taskTitle });
      }
      pushToSession({
        type: 'task_update',
        id: enr.toolCallId,
        title: taskTitle,
        status: 'in_progress',
      });
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
      takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;
      const fallbackTitle = `${enr.displayName} ${enr.argsSummary}`;
      const taskTitle = lookupTaskTitle(enr.toolCallId, fallbackTitle);
      pushToSession({
        type: 'task_update',
        id: enr.toolCallId,
        title: taskTitle,
        status: 'complete',
        // Grouped is at-a-glance: suppress the full result body to keep
        // tasks single-line. Timeline shows the full result.
        output: toolDisplay === 'timeline' ? enr.resultText || undefined : undefined,
      });
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
      takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;
      const fallbackTitle = `${enr.displayName} ${enr.argsSummary}`;
      const taskTitle = lookupTaskTitle(enr.toolCallId, fallbackTitle);
      // Mark as `complete` rather than `error` so a single failing tool
      // doesn't flip the overall plan header to ⚠. The error text in
      // `details` is enough to convey the failure inline.
      pushToSession({
        type: 'task_update',
        id: enr.toolCallId,
        title: taskTitle,
        status: 'complete',
        details: '⚠ ' + (enr.errorText ?? ''),
      });
      continue;
    }

    if (chunk.type === 'tool-call-approval') {
      const enr = tracker.enrichApproval({
        toolCallId: chunk.payload.toolCallId,
        toolName: chunk.payload.toolName,
        args: chunk.payload.args,
      });
      const taskTitle = `${enr.displayName} ${enr.argsSummary}`;
      const activeSession = sessionRef.current;
      if (activeSession) {
        activeSession.push({
          type: 'task_update',
          id: enr.toolCallId,
          title: taskTitle,
          status: 'pending',
          details: 'Requesting user approval…',
        });
      }
      await closeSession();
      // Approval cards are always rendered as Block Kit (`useCards: true`)
      // so the Approve/Deny buttons render — non-cards modes never opt out
      // of rich approval rendering.
      const approvalMessage = formatToolApproval(enr.displayName, enr.argsSummary, enr.toolCallId, true);
      const existing = getPendingApproval(enr.toolCallId);
      let messageId: string | undefined = existing?.messageId;
      if (messageId) {
        try {
          await adapter.editMessage(sdkThread.id, messageId, approvalMessage);
        } catch {
          const sent = await sdkThread.post(approvalMessage);
          messageId = sent?.id;
        }
      } else {
        const sent = await sdkThread.post(approvalMessage);
        messageId = sent?.id;
      }
      onApprovalPosted(enr.toolCallId, {
        messageId,
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
      if (chunk.payload.retry) continue;
      await closeSession();
      await postTripwire({ chunk, sdkThread, logger });
      continue;
    }

    // Other chunk types (reasoning-*, start, step-start, etc.) are
    // intentionally ignored — they don't map to a rendered output. Typing
    // status reacts to them through the `withTypingStatus` wrapper upstream.
  }

  // Drain whatever's still queued when the stream ends.
  await closeSession();
}
