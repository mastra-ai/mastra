/**
 * Event handlers for message streaming events:
 * message_start, message_update, message_end.
 *
 * Also includes pure helper functions for content partitioning.
 */
import type { AgentControllerMessage, AgentControllerMessageContent } from '@mastra/core/agent-controller';
import { TASKS_STATE_ID } from '@mastra/core/tools';

import {
  insertChatComponentWithBoundarySpacing,
  reconcileChatBoundarySpacers,
} from '../chat-boundary-reconciliation.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { NotificationSummaryComponent } from '../components/notification-summary.js';
import { NotificationComponent } from '../components/notification.js';
import { ReactiveSignalComponent } from '../components/reactive-signal.js';
import { StateSignalComponent } from '../components/state-signal.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { TemporalGapComponent } from '../components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import { UserMessageComponent } from '../components/user-message.js';
import { addChildBeforeMessageOrFollowUps } from '../render-messages.js';
import { getMarkdownTheme } from '../theme.js';

import { createStaticSubagentComponent } from './tool.js';
import type { EventHandlerContext } from './types.js';

function getCurrentModeColor(ctx: EventHandlerContext): string | undefined {
  const color = ctx.state.session?.mode?.resolve?.()?.metadata?.color;
  return typeof color === 'string' ? color : undefined;
}

/**
 * Get content parts after the last tool_call/tool_result in the message.
 * These are the parts that should be rendered in the current streaming component.
 */
function getTrailingContentParts(message: AgentControllerMessage): AgentControllerMessage['content'] {
  let lastToolIndex = -1;
  for (let i = message.content.length - 1; i >= 0; i--) {
    const c = message.content[i]!;
    if (isInlineBoundary(c)) {
      lastToolIndex = i;
      break;
    }
  }
  if (lastToolIndex === -1) {
    // No tool calls — return all content
    return message.content;
  }
  // Return everything after the last tool-related part
  return message.content.slice(lastToolIndex + 1);
}

/**
 * Get content parts between the last processed tool call and this one (text/thinking only).
 */
type StreamedSystemReminderPart = {
  type: 'system_reminder';
  message?: string;
  reminderType?: string;
  path?: string;
  precedesMessageId?: string;
  gapText?: string;
  goalMaxTurns?: number;
  judgeModelId?: string;
};

type StreamedStateSignalPart = {
  type: 'state_signal';
  stateId: string;
  mode: 'snapshot' | 'delta';
  cacheKey?: string;
  version?: number;
  message?: string;
};

type StreamedReactiveSignalPart = {
  type: 'reactive_signal';
  tagName: string;
  message?: string;
};

// These are internal control-plane signals handled by GithubSignals. The user-visible
// result is rendered by github-sync-status, so showing these would duplicate the UI.
const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
const GOAL_STATE_SIGNAL_ID = 'goal';

function shouldRenderReactiveSignal(tagName: string): boolean {
  return !HIDDEN_REACTIVE_SIGNAL_TAGS.has(tagName);
}

type StreamedNotificationSummaryPart = {
  type: 'notification_summary';
  message: string;
  pending: number;
  bySource: Record<string, number>;
};

type StreamedNotificationPart = {
  type: 'notification';
  message: string;
  source?: string;
  kind?: string;
  priority?: string;
  status?: string;
};

function isInlineBoundary(part: AgentControllerMessageContent): boolean {
  return (
    part.type === 'tool_call' ||
    part.type === 'tool_result' ||
    (part as { type?: string }).type === 'system_reminder' ||
    (part as { type?: string }).type === 'state_signal' ||
    (part as { type?: string }).type === 'reactive_signal' ||
    (part as { type?: string }).type === 'notification_summary' ||
    (part as { type?: string }).type === 'notification'
  );
}

function isSystemReminderPart(part: AgentControllerMessageContent): boolean {
  return (part as { type?: string }).type === 'system_reminder';
}

function isStateSignalPart(part: AgentControllerMessageContent): boolean {
  return (part as { type?: string }).type === 'state_signal';
}

function isReactiveSignalPart(part: AgentControllerMessageContent): boolean {
  return (part as { type?: string }).type === 'reactive_signal';
}

function isNotificationSummaryPart(part: AgentControllerMessageContent): boolean {
  return (part as { type?: string }).type === 'notification_summary';
}

function isNotificationPart(part: AgentControllerMessageContent): boolean {
  return (part as { type?: string }).type === 'notification';
}

function toStreamedSystemReminderPart(part: AgentControllerMessageContent): StreamedSystemReminderPart | undefined {
  if (!isSystemReminderPart(part)) return undefined;
  const reminder = part as unknown as Partial<StreamedSystemReminderPart>;

  return {
    type: 'system_reminder',
    message: typeof reminder.message === 'string' ? reminder.message : undefined,
    reminderType: reminder.reminderType,
    path: reminder.path,
    precedesMessageId: typeof reminder.precedesMessageId === 'string' ? reminder.precedesMessageId : undefined,
    gapText: typeof reminder.gapText === 'string' ? reminder.gapText : undefined,
    goalMaxTurns: typeof reminder.goalMaxTurns === 'number' ? reminder.goalMaxTurns : undefined,
    judgeModelId: typeof reminder.judgeModelId === 'string' ? reminder.judgeModelId : undefined,
  };
}

function toStreamedStateSignalPart(part: AgentControllerMessageContent): StreamedStateSignalPart | undefined {
  if (!isStateSignalPart(part)) return undefined;
  const stateSignal = part as unknown as Partial<StreamedStateSignalPart>;
  if (typeof stateSignal.stateId !== 'string') return undefined;

  return {
    type: 'state_signal',
    stateId: stateSignal.stateId,
    mode: stateSignal.mode === 'delta' ? 'delta' : 'snapshot',
    cacheKey:
      typeof (stateSignal as Record<string, unknown>).cacheKey === 'string'
        ? ((stateSignal as Record<string, unknown>).cacheKey as string)
        : undefined,
    version: typeof stateSignal.version === 'number' ? stateSignal.version : undefined,
    message: typeof stateSignal.message === 'string' ? stateSignal.message : undefined,
  };
}

function toStreamedReactiveSignalPart(part: AgentControllerMessageContent): StreamedReactiveSignalPart | undefined {
  if (!isReactiveSignalPart(part)) return undefined;
  const reactiveSignal = part as unknown as Partial<StreamedReactiveSignalPart>;
  if (typeof reactiveSignal.tagName !== 'string') return undefined;

  return {
    type: 'reactive_signal',
    tagName: reactiveSignal.tagName,
    message: typeof reactiveSignal.message === 'string' ? reactiveSignal.message : undefined,
  };
}

function toStreamedNotificationSummaryPart(
  part: AgentControllerMessageContent,
): StreamedNotificationSummaryPart | undefined {
  if (!isNotificationSummaryPart(part)) return undefined;
  const summary = part as unknown as Partial<StreamedNotificationSummaryPart>;
  if (typeof summary.message !== 'string' || typeof summary.pending !== 'number') return undefined;

  return {
    type: 'notification_summary',
    message: summary.message,
    pending: summary.pending,
    bySource: summary.bySource && typeof summary.bySource === 'object' ? summary.bySource : {},
  };
}

function toStreamedNotificationPart(part: AgentControllerMessageContent): StreamedNotificationPart | undefined {
  if (!isNotificationPart(part)) return undefined;
  const notification = part as unknown as Partial<StreamedNotificationPart>;
  if (typeof notification.message !== 'string') return undefined;

  return {
    type: 'notification',
    message: notification.message,
    source: typeof notification.source === 'string' ? notification.source : undefined,
    kind: typeof notification.kind === 'string' ? notification.kind : undefined,
    priority: typeof notification.priority === 'string' ? notification.priority : undefined,
    status: typeof notification.status === 'string' ? notification.status : undefined,
  };
}

function createReminderComponent(reminder: StreamedSystemReminderPart): SystemReminderComponent | TemporalGapComponent {
  if (reminder.reminderType === 'temporal-gap') {
    return new TemporalGapComponent({
      message: reminder.message,
      gapText: reminder.gapText,
    });
  }

  return new SystemReminderComponent({
    message: reminder.message,
    reminderType: reminder.reminderType,
    path: reminder.path,
    goalMaxTurns: reminder.goalMaxTurns,
    judgeModelId: reminder.judgeModelId,
  });
}

function addInlineStateSignal(ctx: EventHandlerContext, stateSignal: StreamedStateSignalPart): void {
  const { state } = ctx;
  const component = new StateSignalComponent({
    stateId: stateSignal.stateId,
    mode: stateSignal.mode,
    version: stateSignal.version,
    message: stateSignal.message,
  });

  if (state.streamingComponent) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as never);
    if (idx >= 0) {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component, idx);
      return;
    }
  }

  ctx.addChildBeforeFollowUps(component);
}

function addInlineReactiveSignal(ctx: EventHandlerContext, reactiveSignal: StreamedReactiveSignalPart): void {
  const component = new ReactiveSignalComponent({
    tagName: reactiveSignal.tagName,
    message: reactiveSignal.message,
  });
  ctx.addChildBeforeFollowUps(component);
}

function addInlineNotificationSummary(ctx: EventHandlerContext, summary: StreamedNotificationSummaryPart): void {
  ctx.addChildBeforeFollowUps(
    new NotificationSummaryComponent({
      message: summary.message,
      pending: summary.pending,
      bySource: summary.bySource,
    }),
  );
}

function addInlineNotification(ctx: EventHandlerContext, notification: StreamedNotificationPart): void {
  ctx.addChildBeforeFollowUps(
    new NotificationComponent({
      message: notification.message,
      source: notification.source,
      kind: notification.kind,
      priority: notification.priority,
      status: notification.status,
    }),
  );
}

function addInlineReminder(ctx: EventHandlerContext, reminder: StreamedSystemReminderPart): void {
  const { state } = ctx;
  const component = createReminderComponent(reminder);
  component.setExpanded(state.toolOutputExpanded);
  state.allSystemReminderComponents.push(component);

  if (reminder.precedesMessageId && !state.messageComponentsById.has(reminder.precedesMessageId)) {
    const latestUserComponent = [...state.chatContainer.children]
      .reverse()
      .find(child => child instanceof UserMessageComponent);

    if (latestUserComponent) {
      const idx = state.chatContainer.children.indexOf(latestUserComponent as never);
      if (idx >= 0) {
        insertChatComponentWithBoundarySpacing(state.chatContainer, component, idx);
        return;
      }
    }
  }

  if (state.streamingComponent && !reminder.precedesMessageId) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as never);
    if (idx >= 0) {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component, idx);
      return;
    }
  }

  addChildBeforeMessageOrFollowUps(state, component, reminder.precedesMessageId);
}

function getContentBeforeToolCall(
  message: AgentControllerMessage,
  toolCallId: string,
  seenToolCallIds: Set<string>,
): AgentControllerMessage['content'] {
  const idx = message.content.findIndex(c => c.type === 'tool_call' && c.id === toolCallId);
  if (idx === -1) return message.content;
  // Find the start: after the last tool_call/tool_result that we've already seen
  let startIdx = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const c = message.content[i]!;
    if (
      (c.type === 'tool_call' && 'id' in c && seenToolCallIds.has(c.id)) ||
      (c.type === 'tool_result' && 'id' in c && seenToolCallIds.has(c.id))
    ) {
      startIdx = i + 1;
      break;
    }
  }

  return message.content.slice(startIdx, idx).filter(c => c.type === 'text' || c.type === 'thinking');
}

export function handleMessageStart(ctx: EventHandlerContext, message: AgentControllerMessage): void {
  const { state } = ctx;
  if (message.role === 'user') {
    ctx.addUserMessage(message);
  } else if (message.role === 'assistant') {
    // Clear tool component references when starting a new assistant message
    state.lastAskUserComponent = undefined;
    state.lastSubmitPlanComponent = undefined;
    if (!state.streamingComponent) {
      state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
      ctx.addChildBeforeFollowUps(state.streamingComponent);
      state.streamingMessage = message;
      const trailingParts = getTrailingContentParts(message);
      state.streamingComponent.updateContent({
        ...message,
        content: trailingParts,
      });
      reconcileChatBoundarySpacers(state.chatContainer);
    }
    state.ui.requestRender();
  }
}

export function handleMessageUpdate(ctx: EventHandlerContext, message: AgentControllerMessage): void {
  const { state } = ctx;
  if (message.role !== 'assistant') return;

  const systemReminderParts = message.content
    .map(toStreamedSystemReminderPart)
    .filter((part): part is StreamedSystemReminderPart => part !== undefined);
  const stateSignalParts = message.content
    .map(toStreamedStateSignalPart)
    .filter((part): part is StreamedStateSignalPart => part !== undefined);
  const reactiveSignalParts = message.content
    .map(toStreamedReactiveSignalPart)
    .filter((part): part is StreamedReactiveSignalPart => part !== undefined);
  const notificationSummaryParts = message.content
    .map(toStreamedNotificationSummaryPart)
    .filter((part): part is StreamedNotificationSummaryPart => part !== undefined);
  const notificationParts = message.content
    .map(toStreamedNotificationPart)
    .filter((part): part is StreamedNotificationPart => part !== undefined);

  for (const stateSignal of stateSignalParts) {
    // The `tasks` state signal is already rendered by the pinned task list UI
    // (driven by the `task_updated` display event), so don't also echo its raw
    // <current-task-list> snapshot into the transcript. The `goal` state signal
    // is surfaced by the goal/judge UI (driven by the `goal` chunk), so likewise
    // don't echo its raw <current-objective> snapshot. Other state-signal
    // categories still render inline.
    if (stateSignal.stateId === TASKS_STATE_ID || stateSignal.stateId === GOAL_STATE_SIGNAL_ID) continue;
    const stateSignalKey = `state:${message.id}:${stateSignal.cacheKey ?? ''}:${stateSignal.stateId}:${stateSignal.mode}:${stateSignal.version ?? ''}:${stateSignal.message ?? ''}`;
    if (!state.currentRunSystemReminderKeys.has(stateSignalKey)) {
      state.currentRunSystemReminderKeys.add(stateSignalKey);
      addInlineStateSignal(ctx, stateSignal);
    }
  }

  for (const reminder of systemReminderParts) {
    if (reminder.reminderType === 'goal-judge') continue;

    const reminderKey = `${message.id}:${reminder.reminderType ?? ''}:${reminder.path ?? ''}:${reminder.message}`;
    if (!state.currentRunSystemReminderKeys.has(reminderKey)) {
      state.currentRunSystemReminderKeys.add(reminderKey);
      addInlineReminder(ctx, reminder);
    }
  }

  for (const reactiveSignal of reactiveSignalParts) {
    if (!shouldRenderReactiveSignal(reactiveSignal.tagName)) continue;
    const reactiveSignalKey = `${message.id}:${reactiveSignal.tagName}:${reactiveSignal.message ?? ''}`;
    if (!state.currentRunSystemReminderKeys.has(reactiveSignalKey)) {
      state.currentRunSystemReminderKeys.add(reactiveSignalKey);
      addInlineReactiveSignal(ctx, reactiveSignal);
    }
  }

  for (const summary of notificationSummaryParts) {
    const summaryKey = `${message.id}:notification-summary:${summary.pending}:${summary.message}`;
    if (!state.currentRunSystemReminderKeys.has(summaryKey)) {
      state.currentRunSystemReminderKeys.add(summaryKey);
      addInlineNotificationSummary(ctx, summary);
    }
  }

  for (const notification of notificationParts) {
    const notificationKey = `${message.id}:notification:${notification.source ?? ''}:${notification.kind ?? ''}:${notification.message}`;
    if (!state.currentRunSystemReminderKeys.has(notificationKey)) {
      state.currentRunSystemReminderKeys.add(notificationKey);
      addInlineNotification(ctx, notification);
    }
  }

  let createdStreamingComponent = false;
  if (!state.streamingComponent) {
    const trailingParts = getTrailingContentParts(message);
    const hasToolCalls = message.content.some(content => content.type === 'tool_call');
    if (trailingParts.length === 0 && !hasToolCalls) {
      if (
        systemReminderParts.length > 0 ||
        stateSignalParts.length > 0 ||
        reactiveSignalParts.length > 0 ||
        notificationSummaryParts.length > 0 ||
        notificationParts.length > 0
      ) {
        state.ui.requestRender();
      }
      return;
    }

    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);
    createdStreamingComponent = true;
  }

  state.streamingMessage = message;
  // Check for new tool calls
  for (const content of message.content) {
    if (content.type === 'tool_call') {
      // For subagent calls, freeze the current streaming component
      // with content before the tool call, then create a new one.
      // SubagentExecutionComponent handles the visual rendering.
      // Check subagentToolCallIds separately since handleToolStart
      // may have already added the ID to seenToolCallIds.
      if (content.name === 'subagent' && !state.subagentToolCallIds.has(content.id)) {
        state.seenToolCallIds.add(content.id);
        state.subagentToolCallIds.add(content.id);
        // Freeze current component with pre-subagent content
        const preContent = getContentBeforeToolCall(message, content.id, state.seenToolCallIds);
        state.streamingComponent.updateContent({
          ...message,
          content: preContent,
        });
        state.streamingComponent = new AssistantMessageComponent(
          undefined,
          state.hideThinkingBlock,
          getMarkdownTheme(),
        );
        ctx.addChildBeforeFollowUps(state.streamingComponent);
        createdStreamingComponent = true;
        continue;
      }

      if (!state.seenToolCallIds.has(content.id)) {
        state.seenToolCallIds.add(content.id);

        const preContent = getContentBeforeToolCall(message, content.id, state.seenToolCallIds);
        state.streamingComponent.updateContent({
          ...message,
          content: preContent,
        });

        if (createStaticSubagentComponent(ctx, content.id, content.name, content.args)) {
          createdStreamingComponent = true;
          continue;
        }

        const component = new ToolExecutionComponentEnhanced(
          content.name,
          content.args,
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
        state.pendingTools.set(content.id, component);
        state.allToolComponents.push(component);
        reconcileChatBoundarySpacers(state.chatContainer);

        state.streamingComponent = new AssistantMessageComponent(
          undefined,
          state.hideThinkingBlock,
          getMarkdownTheme(),
        );
        ctx.addChildBeforeFollowUps(state.streamingComponent);
        createdStreamingComponent = true;
      } else {
        const component = state.pendingTools.get(content.id);
        if (component) {
          component.updateArgs(content.args);
          reconcileChatBoundarySpacers(state.chatContainer);
        }
      }
    }
  }

  const trailingParts = getTrailingContentParts(message);
  // Avoid replacing visible assistant text with an empty trailing segment
  // (commonly happens immediately after tool_result-only updates).
  if (trailingParts.length > 0) {
    const wasSpacingParticipant = state.streamingComponent.getChatSpacingKind() !== undefined;
    state.streamingComponent.updateContent({
      ...message,
      content: trailingParts,
    });
    if (
      createdStreamingComponent ||
      (!wasSpacingParticipant && state.streamingComponent.getChatSpacingKind() !== undefined)
    ) {
      reconcileChatBoundarySpacers(state.chatContainer);
    }
  }

  state.ui.requestRender();
}

export function handleMessageEnd(ctx: EventHandlerContext, message: AgentControllerMessage): void {
  const { state } = ctx;
  if (message.role === 'user') return;

  if (state.streamingComponent && message.role === 'assistant') {
    state.streamingMessage = message;
    const trailingParts = getTrailingContentParts(message);
    // If the final assistant chunk has no trailing text/thinking after tools,
    // keep the last rendered content instead of blanking the component.
    if (trailingParts.length > 0 || message.stopReason === 'aborted' || message.stopReason === 'error') {
      state.streamingComponent.updateContent({
        ...message,
        content: trailingParts,
      });
    }

    if (message.stopReason === 'aborted' || message.stopReason === 'error') {
      const errorMessage = message.errorMessage || 'Operation aborted';
      for (const [, component] of state.pendingTools) {
        component.updateResult(
          {
            content: [{ type: 'text', text: errorMessage }],
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
  state.ui.requestRender();
}
