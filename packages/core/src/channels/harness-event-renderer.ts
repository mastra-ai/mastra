/**
 * Render a Harness {@link HarnessEvent} stream to a chat platform.
 *
 * This is the Harness analogue of the agent stream consumer in
 * `chat-driver-streaming.ts`. The streaming driver is hardwired to
 * `AgentChunkType`; a Harness {@link Session} instead emits already-reduced
 * `HarnessEvent`s (the assistant message arrives fully reassembled on each
 * `message_update`). So rather than reuse the chunk driver, we render forward
 * from the event stream using the same platform primitives
 * (`editOrPostMessage`, {@link ToolTracker}, `renderBuiltInToolEvent`,
 * `postStreamError`).
 *
 * The model for this translator is `mastracode/src/acp/event-mapper.ts`, which
 * maps the same events to the ACP protocol. The one genuinely new piece here is
 * the post-once / edit-in-place / finalize lifecycle for the assistant message:
 * ACP streams append-only `agent_message_chunk` deltas, but chat platforms want
 * a single message edited in place so the thread isn't spammed.
 */
import type { Adapter, Thread } from 'chat';

import type { HarnessEvent, HarnessMessage } from '../harness/types';
import type { IMastraLogger } from '../logger/logger';
import { formatResult, stripToolPrefix, formatArgsSummary } from './formatting';
import type { PendingApprovalRecord } from './stream-helpers';
import { ToolTracker, editOrPostMessage, renderBuiltInToolEvent } from './stream-helpers';
import type { PostableMessage, ToolDisplayEvent } from './types';

/**
 * Per-channel-thread render state. One instance is created lazily when a
 * Session subscription opens for a chat thread and lives for the lifetime of
 * that subscription. Mirrors `PromptState` in the ACP event-mapper plus the
 * post-vs-edit bookkeeping the chat transport needs.
 */
export interface HarnessRenderState {
  /** Platform message id of the streamed assistant message, once posted. */
  messageId?: string;
  /** Length of assistant text already rendered, to slice cumulative updates. */
  lastTextLength: number;
  /** Wall-clock time of the last edit, for `updateIntervalMs` rate limiting. */
  lastEditAt: number;
  /** Cross-event tool correlation (start → result/error). */
  toolTracker: ToolTracker;
  /** Platform message id of each in-flight tool card, keyed by toolCallId. */
  toolCardMessageIds: Map<string, string>;
}

/** Create a fresh per-thread render state. */
export function createHarnessRenderState(): HarnessRenderState {
  return {
    messageId: undefined,
    lastTextLength: 0,
    lastEditAt: 0,
    toolTracker: new ToolTracker(),
    toolCardMessageIds: new Map(),
  };
}

/**
 * Dependencies the renderer needs to talk to one chat platform thread. Injected
 * so the renderer stays pure and unit-testable with mock `chatThread`/`adapter`.
 */
export interface HarnessRenderDeps {
  chatThread: Pick<Thread, 'id' | 'post'>;
  adapter: Pick<Adapter<any, any>, 'editMessage'>;
  platform: string;
  /**
   * Tool rendering mode. `'cards'`/`'text'` post discrete per-tool messages;
   * `'hidden'` executes silently (only the streamed text is shown).
   */
  toolDisplay: 'cards' | 'text' | 'hidden';
  /** Tool names whose effects are already visible on the platform — skip cards. */
  channelToolNames: Set<string>;
  /**
   * Whether the platform can render Approve/Deny buttons. When false, the
   * renderer doesn't post an approval prompt (the Session auto-approves).
   */
  canRenderApprovalButtons: boolean;
  /** Minimum ms between edits to the streamed assistant message. */
  updateIntervalMs: number;
  /**
   * Called when an approval card is posted so the channels instance can resume
   * the correct tool call when the user clicks Approve/Deny.
   */
  onApprovalPosted?: (toolCallId: string, record: PendingApprovalRecord) => void;
  /** Optional adapter-supplied formatter for `error` events. */
  formatError?: (error: Error) => PostableMessage;
  logger?: IMastraLogger;
}

/** Join the text parts of a {@link HarnessMessage} into a single string. */
function assistantText(message: HarnessMessage): string {
  return message.content
    .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
    .map(c => c.text)
    .join('');
}

/**
 * Render a single {@link HarnessEvent} to the chat platform, mutating
 * `state` to track the streamed message and in-flight tools.
 *
 * Returns a promise that resolves once any platform I/O for this event
 * completes. Unknown / unhandled event types are ignored (forward-compat with
 * the open `HarnessEvent` union).
 */
export async function handleHarnessEvent(
  event: HarnessEvent,
  state: HarnessRenderState,
  deps: HarnessRenderDeps,
): Promise<void> {
  switch (event.type) {
    case 'agent_start':
      // New turn: reset the streamed-message cursor so a fresh assistant
      // message is posted rather than edited onto the previous turn's message.
      state.messageId = undefined;
      state.lastTextLength = 0;
      state.lastEditAt = 0;
      break;

    case 'message_start':
      if (event.message.role !== 'assistant') break;
      state.messageId = undefined;
      state.lastTextLength = 0;
      state.lastEditAt = 0;
      break;

    case 'message_update': {
      if (event.message.role !== 'assistant') break;
      const fullText = assistantText(event.message);
      if (fullText.length <= state.lastTextLength) break;

      // Rate-limit edits: only flush when enough time has passed since the last
      // edit. The terminal `message_end` always flushes the final text.
      const now = Date.now();
      if (state.messageId && now - state.lastEditAt < deps.updateIntervalMs) break;

      state.lastTextLength = fullText.length;
      state.lastEditAt = now;
      state.messageId = await editOrPostMessage({
        adapter: deps.adapter,
        chatThread: deps.chatThread,
        messageId: state.messageId,
        message: fullText,
        logger: deps.logger,
      });
      break;
    }

    case 'message_end': {
      if (event.message.role !== 'assistant') break;
      const fullText = assistantText(event.message);
      // Always flush the final text even if it's identical length (e.g. the
      // last delta was rate-limited away) so the message isn't left stale.
      if (fullText.length === 0 && !state.messageId) break;
      state.lastTextLength = fullText.length;
      state.lastEditAt = Date.now();
      state.messageId = await editOrPostMessage({
        adapter: deps.adapter,
        chatThread: deps.chatThread,
        messageId: state.messageId,
        message: fullText,
        logger: deps.logger,
      });
      // Finalize: the next assistant turn starts a fresh message.
      state.messageId = undefined;
      state.lastTextLength = 0;
      state.lastEditAt = 0;
      break;
    }

    case 'tool_start': {
      if (deps.toolDisplay === 'hidden') break;
      if (deps.channelToolNames.has(event.toolName)) break;
      const enrichment = state.toolTracker.trackStart({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
      });
      const displayEvent: ToolDisplayEvent = {
        kind: 'running',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        displayName: enrichment.displayName,
        argsSummary: enrichment.argsSummary,
        args: event.args,
      };
      const message = renderBuiltInToolEvent(displayEvent, deps.toolDisplay);
      await postToolCard(event.toolCallId, message, state, deps);
      break;
    }

    case 'tool_end': {
      if (deps.toolDisplay === 'hidden') break;
      const tracked = state.toolTracker.has(event.toolCallId);
      if (!tracked) break;
      const enrichment = event.isError
        ? state.toolTracker.enrichError({
            toolCallId: event.toolCallId,
            toolName: '',
            args: undefined,
            error: event.result,
          })
        : state.toolTracker.enrichResult({
            toolCallId: event.toolCallId,
            toolName: '',
            args: undefined,
            result: event.result,
          });
      // The tool was tracked at `tool_start` (channel tools are filtered there),
      // so the enrichment carries the original display name / args.
      const displayEvent: ToolDisplayEvent = event.isError
        ? {
            kind: 'error',
            toolCallId: event.toolCallId,
            toolName: enrichment.toolName,
            displayName: enrichment.displayName,
            argsSummary: enrichment.argsSummary,
            args: enrichment.args,
            error: event.result,
            errorText: enrichment.errorText ?? formatResult(event.result, true),
            durationMs: enrichment.durationMs ?? 0,
          }
        : {
            kind: 'result',
            toolCallId: event.toolCallId,
            toolName: enrichment.toolName,
            displayName: enrichment.displayName,
            argsSummary: enrichment.argsSummary,
            args: enrichment.args,
            result: event.result,
            resultText: enrichment.resultText ?? formatResult(event.result, false),
            durationMs: enrichment.durationMs ?? 0,
            isError: false,
          };
      const message = renderBuiltInToolEvent(displayEvent, deps.toolDisplay);
      await editToolCard(event.toolCallId, message, state, deps);
      break;
    }

    case 'tool_approval_required': {
      if (!deps.canRenderApprovalButtons) break;
      const displayName = stripToolPrefix(event.toolName);
      const argsObj = typeof event.args === 'object' && event.args != null ? event.args : {};
      const argsSummary = formatArgsSummary(argsObj as Record<string, unknown>);
      const displayEvent: ToolDisplayEvent = {
        kind: 'approval',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        displayName,
        argsSummary,
        args: event.args,
      };
      const message = renderBuiltInToolEvent(displayEvent, deps.toolDisplay === 'text' ? 'text' : 'cards');
      let messageId: string | undefined;
      try {
        const sent = await deps.chatThread.post(message);
        messageId = sent?.id;
      } catch (e) {
        deps.logger?.debug?.('[CHANNEL] Failed to post approval card', { error: e });
      }
      deps.onApprovalPosted?.(event.toolCallId, {
        messageId,
        displayName,
        argsSummary,
        startedAt: Date.now(),
        toolName: event.toolName,
        args: argsObj as Record<string, unknown>,
      });
      break;
    }

    case 'error': {
      const err = event.error instanceof Error ? event.error : new Error(String((event as { error?: unknown }).error));
      const postable = deps.formatError ? deps.formatError(err) : `❌ Error: ${err.message}`;
      try {
        await deps.chatThread.post(postable);
      } catch (e) {
        deps.logger?.debug?.('[CHANNEL] Failed to post error message', { error: e });
      }
      break;
    }

    case 'info':
      try {
        await deps.chatThread.post(event.message);
      } catch (e) {
        deps.logger?.debug?.('[CHANNEL] Failed to post info message', { error: e });
      }
      break;

    // Forward-compat: tool input streaming, shell output, subagents, OM,
    // tasks, usage, goals, mode/model/thread/workspace lifecycle, and any
    // unknown event types are intentionally ignored in v1.
    default:
      break;
  }
}

/** Post a per-tool card and remember its message id for the later result edit. */
async function postToolCard(
  toolCallId: string,
  message: PostableMessage,
  state: HarnessRenderState,
  deps: HarnessRenderDeps,
): Promise<void> {
  try {
    const sent = await deps.chatThread.post(message);
    if (sent?.id) state.toolCardMessageIds.set(toolCallId, sent.id);
  } catch (e) {
    deps.logger?.debug?.('[CHANNEL] Failed to post tool card', { error: e });
  }
}

/** Edit a previously-posted tool card to its terminal result/error state. */
async function editToolCard(
  toolCallId: string,
  message: PostableMessage,
  state: HarnessRenderState,
  deps: HarnessRenderDeps,
): Promise<void> {
  const messageId = state.toolCardMessageIds.get(toolCallId);
  const resolved = await editOrPostMessage({
    adapter: deps.adapter,
    chatThread: deps.chatThread,
    messageId,
    message,
    logger: deps.logger,
  });
  state.toolCardMessageIds.delete(toolCallId);
  void resolved;
}
