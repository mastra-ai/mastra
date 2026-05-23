import type { Adapter, StreamChunk, Thread } from 'chat';

import type { IMastraLogger } from '../logger/logger';
import type { AgentChunkType } from '../stream/types';
import { chatModule } from './chat-lazy';
import { formatToolApproval } from './formatting';
import { asOmChunk, formatTokens, renderOmTaskUpdate } from './om';
import type { PendingApprovalRecord } from './stream-helpers';
import {
  ToolTracker,
  editOrPostMessage,
  postFileAttachment,
  postStreamError,
  postTripwire,
  renderBuiltInToolEvent,
} from './stream-helpers';
import type { PostableMessage, ToolDisplayEvent, ToolDisplayFn } from './types';

export interface StreamingDriverArgs {
  stream: AsyncIterable<AgentChunkType<any>>;
  chatThread: Thread;
  adapter: Adapter;
  /**
   * Resolved tool display mode. `'timeline'`/`'grouped'`/`'hidden'` render
   * inside the streaming `Plan` widget; `'cards'`/`'text'` render as
   * discrete `chatThread.post`/`edit` calls — the driver closes the active
   * session, posts the per-tool message, and reopens on the next chunk.
   */
  toolDisplay: 'cards' | 'text' | 'timeline' | 'grouped' | 'hidden';
  /**
   * Optional function-form `toolDisplay` callback. When set, the built-in
   * renderers are bypassed and this is called once per tool lifecycle event.
   * A `{ kind: 'post' }` return triggers the close/post/reopen lifecycle
   * (same as `'cards'`/`'text'`); a `{ kind: 'stream' }` return pushes the
   * chunk into the active streaming session.
   */
  toolDisplayFn?: ToolDisplayFn;
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
  chatThread,
  adapter,
  toolDisplay,
  toolDisplayFn,
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

  // Only `'timeline'`/`'grouped'` configure the chat-SDK Plan widget. The
  // rest (`'cards'`/`'text'`/`'hidden'`) stream just the text body and post
  // per-tool messages out-of-band via close/post/reopen.
  const groupTasks: 'plan' | 'timeline' | undefined =
    toolDisplay === 'timeline' ? 'timeline' : toolDisplay === 'grouped' ? 'plan' : undefined;

  // `'timeline'`/`'grouped'`/`'hidden'` push tool events as task_updates
  // into the active streaming Plan. `'cards'`/`'text'` (and `fn` returning
  // `{ kind: 'post' }`) close the session, post the message, and reopen on
  // the next chunk.
  const rendersToolsInPlan = toolDisplay === 'timeline' || toolDisplay === 'grouped';

  const tracker = new ToolTracker();
  // Box the session in a ref object so TypeScript's CFA can't narrow it to
  // `null` across closure-mutation boundaries (we open/close via
  // `pushToSession` / `closeSession` helpers that mutate `sessionRef.current`,
  // and a plain `let` would get narrowed to its initial `null` between
  // iterations of the for-await loop).
  const sessionRef: { current: StreamingSession | null } = { current: null };

  // Tracks OM cycles currently in `'in_progress'` so we can flush them as
  // `'complete'` before closing the session. OM buffering runs async in the
  // background — without this, a session that closes before `buffering-end`
  // leaves the "Saving to memory…" task visually flipped to error by the
  // chat-SDK plan widget. Keyed by the same stable id (`om-buffer:<cycleId>`)
  // that `renderOmTaskUpdate` uses, so `buffering-end`/`failed` arriving
  // later (in a new session) still replace the entry by id.
  const pendingOmTasks = new Map<string, { title: string }>();

  // Coalesces consecutive "Recalled memory" activations within a single
  // session into one aggregated row. Each `data-om-activation` chunk has a
  // distinct `cycleId`, so naively pushing them produces a stack of
  // "Recalled memory" rows. Instead we keep a single task (id
  // `om-activation`) per session and roll subsequent activations into it
  // by summing the token deltas. Reset on `closeSession()` so a new run
  // starts fresh. Reflection activations are not aggregated — they have a
  // distinct title per event and are typically one-shot.
  const aggregatedRecallRef: {
    current: {
      count: number;
      messageTokens: number; // sum of tokensActivated
      memoryTokens: number; // sum of observationTokens
    } | null;
  } = { current: null };

  // Whether we have set a non-default plan title this session. The chat
  // SDK falls back to "Thinking completed" when no `plan_update` ever fires
  // — push a meaningful title with the first OM event so memory-only runs
  // don't show the default.
  const planTitleRef: { current: boolean } = { current: false };

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
        await chatThread.post(postable as Parameters<Thread['post']>[0]);
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
            await chatThread.post(cleaned);
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
    // OM buffering is background work that often finishes after the session
    // closes. The chat-SDK plan widget flips any still-`in_progress` task to
    // an error icon at stream end, so optimistically mark pending OM tasks
    // complete. If `buffering-failed` arrives later it will overwrite the
    // entry by stable id in a future session.
    for (const [id, { title }] of pendingOmTasks) {
      s.push({ type: 'task_update', id, title, status: 'complete' });
    }
    pendingOmTasks.clear();
    aggregatedRecallRef.current = null;
    planTitleRef.current = false;
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

  /**
   * Close any active streaming session, post `message` as a standalone
   * platform message (Block Kit card or plain text), and let the next
   * chunk reopen a fresh session. Used for `'cards'`/`'text'` tool events
   * and `ToolDisplayFn` `{ kind: 'post' }` returns.
   */
  const postOutOfBand = async (message: PostableMessage): Promise<string | undefined> => {
    await closeSession();
    try {
      const sent = await chatThread.post(message);
      return sent?.id;
    } catch (e) {
      logger?.debug?.('[CHANNEL] streaming out-of-band post failed', { error: e });
      return undefined;
    }
  };

  /**
   * Dispatch a tool lifecycle event:
   *   - If `toolDisplayFn` is set, call it. `{ kind: 'post' }` → close /
   *     post / reopen. `{ kind: 'stream' }` → push to active session.
   *     `undefined` → skip.
   *   - Else if `toolDisplay` renders inside the Plan widget
   *     (`'timeline'`/`'grouped'`/`'hidden'`), return null so the caller
   *     can push the built-in `task_update` into the session.
   *   - Else (`'cards'`/`'text'`), render via `renderBuiltInToolEvent` and
   *     post out-of-band.
   * Returns the posted message id (when posted out-of-band) so the caller
   * can stash it on `tool-call` and edit it on `tool-result`/`-error`.
   */
  const dispatchToolEvent = async (event: ToolDisplayEvent): Promise<{ posted: boolean; messageId?: string }> => {
    if (toolDisplayFn) {
      const result = toolDisplayFn(event, { mode: 'streaming', platform });
      if (result == null) return { posted: true };
      if (result.kind === 'stream') {
        pushToSession(result.chunk);
        return { posted: false };
      }
      // kind === 'post'
      const id = result.message != null ? await postOutOfBand(result.message) : undefined;
      return { posted: true, messageId: id };
    }
    if (rendersToolsInPlan || toolDisplay === 'hidden') {
      return { posted: false };
    }
    // 'cards' | 'text' — post out-of-band
    const message = renderBuiltInToolEvent(event, toolDisplay);
    const id = await postOutOfBand(message);
    return { posted: true, messageId: id };
  };

  // Stash messageId of out-of-band "Running…" posts per toolCallId so the
  // tool-result/-error handler can edit the same message instead of posting
  // a second one. Only used when tools are posted out-of-band (cards/text
  // or fn returning `{ kind: 'post' }`).
  const toolMessageIds = new Map<string, string | undefined>();

  const editOrPost = async (messageId: string | undefined, message: PostableMessage): Promise<void> => {
    await closeSession();
    await editOrPostMessage({ adapter, chatThread, messageId, message, logger });
  };

  for await (const chunk of stream) {
    // Reset the recall aggregator the moment anything other than an
    // observation activation appears. Without this, separate activation
    // bursts (text/tool calls in between) would merge into a single row.
    if (aggregatedRecallRef.current) {
      const probe = asOmChunk(chunk);
      const isObsActivation = probe?.type === 'data-om-activation' && probe.data.operationType === 'observation';
      if (!isObsActivation) {
        aggregatedRecallRef.current = null;
      }
    }
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
        // OM events render into the Plan widget, so they only make sense
        // when tool calls already live there. In non-plan modes
        // (`'cards'`/`'text'`/`'hidden'`/fn) we skip them entirely — a
        // phantom Plan widget showing only memory rows would be inconsistent
        // with the mode contract ("everything out of band"). If users want
        // memory visibility in those modes we can expose it through a
        // separate option later.
        if (!rendersToolsInPlan) continue;
        // `cycleId` is the stable task ID across start/end/failed events.
        if (om.data.cycleId) {
          // Set a meaningful plan title on first OM event so memory-only
          // runs don't show the chat-SDK default ("Thinking completed").
          if (!planTitleRef.current) {
            pushToSession({ type: 'plan_update', title: 'Updating memory' });
            planTitleRef.current = true;
          }

          // Coalesce consecutive observation activations into a single
          // aggregated row. Each activation chunk has its own `cycleId`,
          // so without this we'd render N stacked "Recalled memory" rows.
          // The top-of-loop reset breaks the sequence on any non-observation
          // chunk so separate bursts don't merge.
          if (om.type === 'data-om-activation' && om.data.operationType === 'observation') {
            const prev = aggregatedRecallRef.current;
            aggregatedRecallRef.current = {
              count: (prev?.count ?? 0) + 1,
              messageTokens: (prev?.messageTokens ?? 0) + om.data.tokensActivated,
              memoryTokens: (prev?.memoryTokens ?? 0) + om.data.observationTokens,
            };
            const { count, messageTokens, memoryTokens } = aggregatedRecallRef.current;
            pushToSession({
              type: 'task_update',
              id: 'om-activation',
              title: count === 1 ? 'Recalled memory' : `Recalled memory (${count}x)`,
              status: 'complete',
              details: `-${formatTokens(messageTokens)} message tokens, +${formatTokens(memoryTokens)} memory tokens`,
            });
            continue;
          }

          const update = renderOmTaskUpdate(om);
          if (update.type === 'task_update') {
            if (update.status === 'in_progress') {
              pendingOmTasks.set(update.id, { title: update.title ?? '' });
            } else {
              // `complete` or `error` resolves the cycle — drop it from
              // the pending set so closeSession doesn't double-write.
              pendingOmTasks.delete(update.id);
            }
          }
          pushToSession(update);
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
      await postFileAttachment({ chunk, chatThread, logger });
      continue;
    }

    if (chunk.type === 'finish') {
      await closeSession();
      tracker.reset();
      continue;
    }

    if (chunk.type === 'error') {
      await closeSession();
      await postStreamError({ chunk, chatThread, platform, logger, formatError });
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

      // For Plan-widget modes, close any active text-only session before
      // the first tool of a step in timeline mode so the preceding text
      // posts as its own platform message. In grouped mode keep the
      // session open so every task accumulates under one plan widget.
      if (toolDisplay === 'timeline' && sessionRef.current && tracker.inFlightCount === 1) {
        await closeSession();
      }

      if (toolDisplayFn || !rendersToolsInPlan) {
        // 'cards' | 'text' | fn → post out-of-band, stash messageId for
        // the result handler to edit. Skip the eager "running" post when
        // a custom fn is set — most fns prefer to render once on result.
        if (toolDisplayFn) {
          toolMessageIds.set(enr.toolCallId, undefined);
          // Still call the fn so it can render a "running" view if it wants.
          const { messageId } = await dispatchToolEvent({
            kind: 'running',
            toolCallId: enr.toolCallId,
            toolName: enr.toolName,
            displayName: enr.displayName,
            argsSummary: enr.argsSummary,
            args: enr.args,
          });
          if (messageId) toolMessageIds.set(enr.toolCallId, messageId);
        } else {
          const { messageId } = await dispatchToolEvent({
            kind: 'running',
            toolCallId: enr.toolCallId,
            toolName: enr.toolName,
            displayName: enr.displayName,
            argsSummary: enr.argsSummary,
            args: enr.args,
          });
          toolMessageIds.set(enr.toolCallId, messageId);
        }
        continue;
      }

      // 'timeline' | 'grouped' — push task_update into Plan widget.
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
      const approvalStash = takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;

      if (toolDisplayFn || !rendersToolsInPlan) {
        const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
        toolMessageIds.delete(enr.toolCallId);
        if (toolDisplayFn) {
          const result = toolDisplayFn(
            {
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
            },
            { mode: 'streaming', platform },
          );
          if (result == null) continue;
          if (result.kind === 'stream') {
            pushToSession(result.chunk);
            continue;
          }
          if (result.message != null) await editOrPost(messageId, result.message);
          continue;
        }
        const message = renderBuiltInToolEvent(
          {
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
          },
          toolDisplay as 'cards' | 'text',
        );
        await editOrPost(messageId, message);
        continue;
      }

      // 'timeline' | 'grouped' — push task_update into Plan widget.
      const fallbackTitle = `${enr.displayName} ${enr.argsSummary}`;
      const taskTitle = lookupTaskTitle(enr.toolCallId, fallbackTitle);
      pushToSession({ type: 'plan_update', title: taskTitle });
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
      const approvalStash = takePendingApproval(enr.toolCallId);
      if (toolDisplay === 'hidden') continue;

      if (toolDisplayFn || !rendersToolsInPlan) {
        const messageId = toolMessageIds.get(enr.toolCallId) ?? approvalStash?.messageId;
        toolMessageIds.delete(enr.toolCallId);
        if (toolDisplayFn) {
          const result = toolDisplayFn(
            {
              kind: 'error',
              toolCallId: enr.toolCallId,
              toolName: enr.toolName,
              displayName: enr.displayName,
              argsSummary: enr.argsSummary,
              args: enr.args,
              error: chunk.payload.error,
              errorText: enr.errorText ?? '',
              durationMs: enr.durationMs ?? 0,
            },
            { mode: 'streaming', platform },
          );
          if (result == null) continue;
          if (result.kind === 'stream') {
            pushToSession(result.chunk);
            continue;
          }
          if (result.message != null) await editOrPost(messageId, result.message);
          continue;
        }
        const message = renderBuiltInToolEvent(
          {
            kind: 'error',
            toolCallId: enr.toolCallId,
            toolName: enr.toolName,
            displayName: enr.displayName,
            argsSummary: enr.argsSummary,
            args: enr.args,
            error: chunk.payload.error,
            errorText: enr.errorText ?? '',
            durationMs: enr.durationMs ?? 0,
          },
          toolDisplay as 'cards' | 'text',
        );
        await editOrPost(messageId, message);
        continue;
      }

      // 'timeline' | 'grouped' — push task_update into Plan widget.
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
      // Only park the plan row in modes where tool calls are already rendered
      // in the plan. Non-plan modes (`'cards'`/`'text'`/`'hidden'`) would
      // otherwise flash a one-row Plan widget that closes immediately after.
      if (rendersToolsInPlan) {
        pushToSession({ type: 'plan_update', title: `Requesting approval: ${enr.displayName}` });
        pushToSession({
          type: 'task_update',
          id: enr.toolCallId,
          title: taskTitle,
          status: 'complete',
          details: 'Requesting user approval…',
        });
      }
      await closeSession();
      // Approval cards are always rendered as Block Kit (`useCards: true`)
      // so the Approve/Deny buttons render — non-cards modes never opt out
      // of rich approval rendering.
      const approvalMessage = formatToolApproval(enr.displayName, enr.argsSummary, enr.toolCallId, true);
      // Prefer editing the running tool-card posted by `tool-call` (cards
      // mode stashes it in `toolMessageIds`) so the approval buttons replace
      // the running card in-place. Fall back to a re-posted approval message
      // and finally to a fresh post when neither exists.
      const runningCardMessageId = toolMessageIds.get(enr.toolCallId);
      const existing = getPendingApproval(enr.toolCallId);
      let messageId: string | undefined = runningCardMessageId ?? existing?.messageId;
      if (messageId) {
        try {
          await adapter.editMessage(chatThread.id, messageId, approvalMessage);
        } catch {
          const sent = await chatThread.post(approvalMessage);
          messageId = sent?.id;
        }
      } else {
        const sent = await chatThread.post(approvalMessage);
        messageId = sent?.id;
      }
      // Keep `toolMessageIds` in sync so the eventual `tool-result` edits the
      // same message (whether we edited the existing card or had to repost).
      if (messageId) toolMessageIds.set(enr.toolCallId, messageId);
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
      await postTripwire({ chunk, chatThread, logger });
      continue;
    }

    // Other chunk types (reasoning-*, start, step-start, etc.) are
    // intentionally ignored — they don't map to a rendered output. Typing
    // status reacts to them through the `withTypingStatus` wrapper upstream.
  }

  // Drain whatever's still queued when the stream ends.
  await closeSession();
}
