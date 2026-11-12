/**
 * Event handlers for subagent delegation events:
 * subagent_start, subagent_tool_start, subagent_tool_end, subagent_end.
 */
import { SUBAGENT_TOOL_NAME } from '@mastra/code-sdk/tool-names';
import { describeBackgroundCall } from '../background-activity.js';
import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { SubagentExecutionComponent } from '../components/subagent-execution.js';
import { flushRender, requestRender } from '../render-scheduler.js';

import type { EventHandlerContext } from './types.js';

/** The subagent definition's name, as the controller resolved it on `subagent_start`. */
export function subagentDisplayName(state: EventHandlerContext['state'], toolCallId: string): string | undefined {
  return state.session.displayState?.get().activeSubagents?.get(toolCallId)?.displayName;
}

export function handleSubagentStart(
  ctx: EventHandlerContext,
  toolCallId: string,
  agentType: string,
  task: string,
  modelId?: string,
  forked?: boolean,
): void {
  const { state } = ctx;
  const component = new SubagentExecutionComponent(agentType, task, state.ui, modelId, {
    collapseOnComplete: false,
    expandOnComplete: true,
    forked,
    isToolOutputExpanded: () => state.toolOutputExpanded,
  });
  state.pendingSubagents.set(toolCallId, component);
  state.allToolComponents.push(component as any);

  // A deferred subagent can start after its placeholder result, when the chat
  // has already moved on: place it where the call was made.
  const background = state.backgroundSubagentCalls?.get(toolCallId);
  if (background) {
    component.setBackgroundTaskId(background.taskId);
    background.component = component;
    // The activity list row was made before the definition name was known.
    const activity = state.backgroundActivities?.get(background.taskId);
    const name = subagentDisplayName(state, toolCallId);
    if (activity?.status === 'accepted' && name) {
      activity.label = describeBackgroundCall(SUBAGENT_TOOL_NAME, { agentType, task }, name);
    }
  }
  const children = state.chatContainer.children as unknown[];
  const beforeIndex = background?.insertBefore ? children.indexOf(background.insertBefore) : -1;
  const afterIndex = background?.insertAfter ? children.indexOf(background.insertAfter) : -1;
  if (beforeIndex >= 0) {
    insertChatComponentWithBoundarySpacing(state.chatContainer, component, beforeIndex);
  } else if (afterIndex >= 0) {
    insertChatComponentWithBoundarySpacing(state.chatContainer, component, afterIndex + 1);
  } else if (state.streamingComponent) {
    // Insert before the current streamingComponent so subagent box
    // appears between pre-subagent text and post-subagent text
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as any);
    if (idx >= 0) {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component, idx);
    } else {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component);
    }
  } else {
    insertChatComponentWithBoundarySpacing(state.chatContainer, component);
  }

  flushRender(state);
}

/**
 * Records that a `subagent` call became a background task. Its box may not
 * exist yet: a deferred subagent's `subagent_start` can follow its placeholder
 * result and even the end of the parent run.
 */
export function markBackgroundSubagent(ctx: EventHandlerContext, toolCallId: string, taskId: string): void {
  const { state } = ctx;
  const component = state.pendingSubagents.get(toolCallId);
  // The call's place in the chat: before the text that followed it, or, with
  // nothing streaming, after whatever the chat ends with now.
  const position = state.streamingComponent
    ? { insertBefore: state.streamingComponent }
    : { insertAfter: [...state.chatContainer.children].reverse().find(child => !isChatBoundarySpacer(child)) };
  state.backgroundSubagentCalls.set(toolCallId, { taskId, ...(component ? { component } : position) });
  if (component) {
    component.setBackgroundTaskId(taskId);
    requestRender(state);
  }
}

export function handleSubagentToolStart(
  ctx: EventHandlerContext,
  toolCallId: string,
  subToolName: string,
  subToolArgs: unknown,
): void {
  const component = ctx.state.pendingSubagents.get(toolCallId);
  if (component) {
    component.addToolStart(subToolName, subToolArgs);
    requestRender(ctx.state);
  }
}

export function handleSubagentToolEnd(
  ctx: EventHandlerContext,
  toolCallId: string,
  subToolName: string,
  subToolResult: unknown,
  isError: boolean,
): void {
  const component = ctx.state.pendingSubagents.get(toolCallId);
  if (component) {
    component.addToolEnd(subToolName, subToolResult, isError);
    requestRender(ctx.state);
  }
}

export function handleSubagentEnd(
  ctx: EventHandlerContext,
  toolCallId: string,
  isError: boolean,
  durationMs: number,
  result?: string,
): void {
  const component = ctx.state.pendingSubagents.get(toolCallId);
  if (component) {
    component.finish(isError, durationMs, result);
    ctx.state.pendingSubagents.delete(toolCallId);
    flushRender(ctx.state);
  }
}
