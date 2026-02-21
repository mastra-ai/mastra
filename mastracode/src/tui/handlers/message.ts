/**
 * Event handlers for message streaming events:
 * message_start, message_update, message_end.
 *
 * Also includes pure helper functions for content partitioning.
 */
import { Text } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';

import { AssistantMessageComponent } from '../components/assistant-message.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
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
    if (c.type === 'tool_call' || c.type === 'tool_result') {
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
  if (!state.streamingComponent || message.role !== 'assistant') return;

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

        ctx.addChildBeforeFollowUps(new Text('', 0, 0));
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
  state.streamingComponent.updateContent({
    ...message,
    content: trailingParts,
  });

  state.ui.requestRender();
}

export function handleMessageEnd(ctx: EventHandlerContext, message: HarnessMessage): void {
  const { state } = ctx;
  if (message.role === 'user') return;

  if (state.streamingComponent && message.role === 'assistant') {
    state.streamingMessage = message;
    const trailingParts = getTrailingContentParts(message);
    state.streamingComponent.updateContent({
      ...message,
      content: trailingParts,
    });

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
      state.toolInputBuffers.clear();
    }

    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
    state.seenToolCallIds.clear();
    state.subagentToolCallIds.clear();
  }
  state.ui.requestRender();
}
