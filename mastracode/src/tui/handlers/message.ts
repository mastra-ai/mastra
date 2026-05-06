/**
 * Event handlers for message streaming events:
 * message_start, message_update, message_end.
 *
 * Also includes pure helper functions for content partitioning.
 */
import type { HarnessMessage, HarnessMessageContent } from '@mastra/core/harness';

import { AssistantMessageComponent } from '../components/assistant-message.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { TemporalGapComponent } from '../components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import { UserMessageComponent } from '../components/user-message.js';
import { addChildBeforeMessageOrFollowUps } from '../render-messages.js';
import { getMarkdownTheme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

/**
 * Get content parts after the last tool_call/tool_result in the message.
 * These are the parts that should be rendered in the current streaming component.
 */
function getTrailingContentParts(message: HarnessMessage): HarnessMessage['content'] {
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
};

function isInlineBoundary(part: HarnessMessageContent): boolean {
  return (
    part.type === 'tool_call' || part.type === 'tool_result' || (part as { type?: string }).type === 'system_reminder'
  );
}

function isSystemReminderPart(part: HarnessMessageContent): boolean {
  return (part as { type?: string }).type === 'system_reminder';
}

function toStreamedSystemReminderPart(part: HarnessMessageContent): StreamedSystemReminderPart | undefined {
  if (!isSystemReminderPart(part)) return undefined;
  const reminder = part as unknown as Partial<StreamedSystemReminderPart>;

  return {
    type: 'system_reminder',
    message: typeof reminder.message === 'string' ? reminder.message : undefined,
    reminderType: reminder.reminderType,
    path: reminder.path,
    precedesMessageId: typeof reminder.precedesMessageId === 'string' ? reminder.precedesMessageId : undefined,
    gapText: typeof reminder.gapText === 'string' ? reminder.gapText : undefined,
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
  });
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
        (state.chatContainer.children as unknown[]).splice(idx, 0, component);
        state.chatContainer.invalidate();
        return;
      }
    }
  }

  if (state.streamingComponent && !reminder.precedesMessageId) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as never);
    if (idx >= 0) {
      (state.chatContainer.children as unknown[]).splice(idx, 0, component);
      state.chatContainer.invalidate();
      return;
    }
  }

  addChildBeforeMessageOrFollowUps(state, component, reminder.precedesMessageId);
}

function getContentBeforeToolCall(
  message: HarnessMessage,
  toolCallId: string,
  seenToolCallIds: Set<string>,
): HarnessMessage['content'] {
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

export function handleMessageStart(ctx: EventHandlerContext, message: HarnessMessage): void {
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
    }
    state.ui.requestRender();
  }
}

export function handleMessageUpdate(ctx: EventHandlerContext, message: HarnessMessage): void {
  const { state } = ctx;
  if (message.role !== 'assistant') return;

  const systemReminderParts = message.content
    .map(toStreamedSystemReminderPart)
    .filter((part): part is StreamedSystemReminderPart => part !== undefined);

  for (const reminder of systemReminderParts) {
    const reminderKey = `${message.id}:${reminder.reminderType ?? ''}:${reminder.path ?? ''}:${reminder.message}`;
    if (!state.currentRunSystemReminderKeys.has(reminderKey)) {
      state.currentRunSystemReminderKeys.add(reminderKey);
      addInlineReminder(ctx, reminder);
    }
  }

  if (!state.streamingComponent) {
    if (systemReminderParts.length > 0) {
      state.ui.requestRender();
    }
    return;
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
        continue;
      }

      if (!state.seenToolCallIds.has(content.id)) {
        state.seenToolCallIds.add(content.id);

        const component = new ToolExecutionComponentEnhanced(
          content.name,
          content.args,
          { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
          state.ui,
        );
        component.setExpanded(state.toolOutputExpanded);
        ctx.addChildBeforeFollowUps(component);
        state.pendingTools.set(content.id, component);
        state.allToolComponents.push(component);

        state.streamingComponent = new AssistantMessageComponent(
          undefined,
          state.hideThinkingBlock,
          getMarkdownTheme(),
        );
        ctx.addChildBeforeFollowUps(state.streamingComponent);
      } else {
        const component = state.pendingTools.get(content.id);
        if (component) {
          component.updateArgs(content.args);
        }
      }
    }
  }

  const trailingParts = getTrailingContentParts(message);
  // Avoid replacing visible assistant text with an empty trailing segment
  // (commonly happens immediately after tool_result-only updates).
  if (trailingParts.length > 0) {
    state.streamingComponent.updateContent({
      ...message,
      content: trailingParts,
    });
  }

  state.ui.requestRender();
}

export function handleMessageEnd(ctx: EventHandlerContext, message: HarnessMessage): void {
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
