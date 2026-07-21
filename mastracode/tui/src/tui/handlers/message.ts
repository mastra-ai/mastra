/**
 * Event handlers for message streaming events:
 * message_start, message_update, message_end.
 *
 * The harness streams the canonical `MastraDBMessage` shape: assistant text /
 * reasoning / tool calls live as nested `content.parts`, and signals arrive as
 * their own `role: 'signal'` messages (their own `message_start`/`message_end`
 * pair) rather than inline parts of an assistant message. Signal rendering is
 * therefore delegated to `addUserMessage` / `renderSignalMessage`; this file
 * only drives the streaming assistant component and its tool boundaries.
 */
import type { MastraDBMessage } from '@mastra/core/agent-controller';

import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import { getAssistantRenderParts, isGoalJudgeEvaluationSignal } from '../db-message-parts.js';
import type { ToolRenderPart } from '../db-message-parts.js';
import { flushRender, requestRender } from '../render-scheduler.js';
import { getMarkdownTheme } from '../theme.js';

import { createStaticSubagentComponent } from './tool.js';
import type { EventHandlerContext } from './types.js';

type MessageContent = Exclude<MastraDBMessage['content'], string>;
type MessagePart = MessageContent['parts'][number];

function getCurrentModeColor(ctx: EventHandlerContext): string | undefined {
  const color = ctx.state.session?.mode?.resolve?.()?.metadata?.color;
  return typeof color === 'string' ? color : undefined;
}

function getContent(message: MastraDBMessage): MessageContent | undefined {
  const content = message.content;
  if (typeof content === 'string') return undefined;
  return content;
}

function getRawParts(message: MastraDBMessage): MessagePart[] {
  return getContent(message)?.parts ?? [];
}

function isToolPart(part: MessagePart): boolean {
  return part.type === 'tool-invocation';
}

/**
 * Build a `MastraDBMessage` view that carries only a subset of `content.parts`,
 * preserving the rest of the message (id/role/metadata) so the assistant
 * component can read stop-reason metadata while rendering the sliced text.
 */
function withParts(message: MastraDBMessage, parts: MessagePart[]): MastraDBMessage {
  const content = getContent(message);
  return {
    ...message,
    content: { ...(content ?? { format: 2, parts: [] }), parts } as MessageContent,
  };
}

/**
 * Parts after the last tool-invocation part. These are the text/reasoning parts
 * that belong to the currently-streaming assistant component (below the last
 * tool). If there are no tool parts, all parts are returned.
 */
function getTrailingParts(message: MastraDBMessage): MessagePart[] {
  const parts = getRawParts(message);
  let lastToolIndex = -1;
  for (let i = parts.length - 1; i >= 0; i--) {
    if (isToolPart(parts[i]!)) {
      lastToolIndex = i;
      break;
    }
  }
  return lastToolIndex === -1 ? parts : parts.slice(lastToolIndex + 1);
}

/**
 * Text/reasoning parts between the last already-seen tool part and the tool part
 * with `toolCallId`. Used to freeze the pre-subagent assistant slice.
 */
function getPartsBeforeTool(message: MastraDBMessage, toolCallId: string, seenToolCallIds: Set<string>): MessagePart[] {
  const parts = getRawParts(message);
  const targetIndex = parts.findIndex(part => isToolPart(part) && toolInvocationId(part) === toolCallId);
  if (targetIndex === -1) return parts;

  let startIndex = 0;
  for (let i = targetIndex - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (isToolPart(part)) {
      const id = toolInvocationId(part);
      if (id && seenToolCallIds.has(id)) {
        startIndex = i + 1;
        break;
      }
    }
  }

  return parts.slice(startIndex, targetIndex).filter(part => part.type === 'text' || part.type === 'reasoning');
}

function toolInvocationId(part: MessagePart): string | undefined {
  const inv = (part as { toolInvocation?: { toolCallId?: unknown } }).toolInvocation;
  return typeof inv?.toolCallId === 'string' ? inv.toolCallId : undefined;
}

function getTerminalStatus(message: MastraDBMessage): { stopReason?: string; errorMessage?: string } {
  const metadata = getContent(message)?.metadata as { stopReason?: string; errorMessage?: string } | undefined;
  return { stopReason: metadata?.stopReason, errorMessage: metadata?.errorMessage };
}

export function handleMessageStart(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;

  if (message.role === 'signal' || message.role === 'user') {
    // Signals arrive as distinct message_start/message_end pairs. Guard against
    // the same signal being re-emitted within a run (reminders in particular do
    // not self-register for id-based dedup in the shared renderer).
    if (message.role === 'signal') {
      if (state.currentRunSystemReminderKeys.has(message.id)) return;
      state.currentRunSystemReminderKeys.add(message.id);
      if (isGoalJudgeEvaluationSignal(message)) return;
    }
    ctx.addUserMessage(message);
    return;
  }

  if (message.role === 'assistant') {
    // Clear tool component references when starting a new assistant message
    state.lastAskUserComponent = undefined;
    state.lastSubmitPlanComponent = undefined;
    if (!state.streamingComponent) {
      state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
      ctx.addChildBeforeFollowUps(state.streamingComponent);
      state.streamingMessage = message;
      state.streamingComponent.updateContent(withParts(message, getTrailingParts(message)));
      reconcileChatBoundarySpacers(state.chatContainer);
    }
    flushRender(state);
  }
}

export function handleMessageUpdate(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;

  // Signals arrive as their own message_start/message_end pair; if an update is
  // delivered for one, route it through the shared signal renderer (deduped by id).
  if (message.role === 'signal') {
    if (isGoalJudgeEvaluationSignal(message)) return;
    ctx.addUserMessage(message);
    return;
  }

  if (message.role !== 'assistant') return;

  const renderParts = getAssistantRenderParts(message);
  const toolParts = renderParts.filter((part): part is ToolRenderPart => part.kind === 'tool');
  const trailingParts = getTrailingParts(message);
  const hasToolCalls = toolParts.length > 0;

  let createdStreamingComponent = false;
  if (!state.streamingComponent) {
    if (trailingParts.length === 0 && !hasToolCalls) {
      return;
    }
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);
    createdStreamingComponent = true;
  }

  state.streamingMessage = message;

  // Check for new tool calls
  for (const tool of toolParts) {
    if (!state.seenToolCallIds.has(tool.toolCallId)) {
      state.seenToolCallIds.add(tool.toolCallId);

      const preParts = getPartsBeforeTool(message, tool.toolCallId, state.seenToolCallIds);
      state.streamingComponent.updateContent(withParts(message, preParts));

      const staticSubagent = createStaticSubagentComponent(ctx, tool.toolCallId, tool.toolName, tool.args);
      if (staticSubagent) {
        state.subagentToolCallIds.add(tool.toolCallId);
        createdStreamingComponent = true;
        continue;
      }

      // For built-in subagent calls without a plugin renderer, freeze the current
      // assistant slice before the tool and continue text in a fresh component.
      if (tool.toolName === 'subagent' && !state.subagentToolCallIds.has(tool.toolCallId)) {
        state.subagentToolCallIds.add(tool.toolCallId);
        state.streamingComponent = new AssistantMessageComponent(
          undefined,
          state.hideThinkingBlock,
          getMarkdownTheme(),
        );
        ctx.addChildBeforeFollowUps(state.streamingComponent);
        createdStreamingComponent = true;
        continue;
      }

      const component = new ToolExecutionComponentEnhanced(
        tool.toolName,
        tool.args as Record<string, unknown>,
        { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
        state.ui,
      );
      component.setExpanded(state.toolOutputExpanded);
      if (state.quietMode) {
        component.setCompactToolModeColor(getCurrentModeColor(ctx));
        component.setQuietModeDisplay('quiet');
        component.setQuietPreviewLineLimit(state.quietModeMaxToolPreviewLines);
      }
      ctx.addChildBeforeFollowUps(component);
      state.pendingTools.set(tool.toolCallId, component);
      state.allToolComponents.push(component);
      reconcileChatBoundarySpacers(state.chatContainer);

      state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
      ctx.addChildBeforeFollowUps(state.streamingComponent);
      createdStreamingComponent = true;
    } else {
      const component = state.pendingTools.get(tool.toolCallId);
      if (component) {
        component.updateArgs(tool.args as Record<string, unknown>);
        reconcileChatBoundarySpacers(state.chatContainer);
      }
    }
  }

  // Avoid replacing visible assistant text with an empty trailing segment
  // (commonly happens immediately after tool-result-only updates).
  if (trailingParts.length > 0) {
    const wasSpacingParticipant = state.streamingComponent.getChatSpacingKind() !== undefined;
    state.streamingComponent.updateContent(withParts(message, trailingParts));
    if (
      createdStreamingComponent ||
      (!wasSpacingParticipant && state.streamingComponent.getChatSpacingKind() !== undefined)
    ) {
      reconcileChatBoundarySpacers(state.chatContainer);
    }
  }

  requestRender(state);
}

export function handleMessageEnd(ctx: EventHandlerContext, message: MastraDBMessage): void {
  const { state } = ctx;
  if (message.role === 'signal' || message.role === 'user') return;

  if (state.streamingComponent && message.role === 'assistant') {
    state.streamingMessage = message;
    const trailingParts = getTrailingParts(message);
    const { stopReason, errorMessage } = getTerminalStatus(message);

    // If the final assistant chunk has no trailing text/thinking after tools,
    // keep the last rendered content instead of blanking the component.
    if (trailingParts.length > 0 || stopReason === 'aborted' || stopReason === 'error') {
      state.streamingComponent.updateContent(withParts(message, trailingParts));
    }

    if (stopReason === 'aborted' || stopReason === 'error') {
      const abortMessage = errorMessage || 'Operation aborted';
      for (const [, component] of state.pendingTools) {
        component.updateResult(
          {
            content: [{ type: 'text', text: abortMessage }],
            isError: true,
          },
          false,
        );
      }
      reconcileChatBoundarySpacers(state.chatContainer);
      state.pendingTools.clear();
      state.pendingTaskToolIds?.clear();
    }

    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
    state.seenToolCallIds.clear();
    state.subagentToolCallIds.clear();
    state.currentRunSystemReminderKeys.clear();
  }
  flushRender(state);
}
