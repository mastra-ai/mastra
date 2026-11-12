/**
 * Event handlers for subagent delegation events:
 * subagent_start, subagent_tool_start, subagent_tool_end, subagent_end.
 */
import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import { SubagentExecutionComponent } from '../components/subagent-execution.js';
import { flushRender, requestRender } from '../render-scheduler.js';

import type { EventHandlerContext } from './types.js';

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
  });
  state.pendingSubagents.set(toolCallId, component);
  state.allToolComponents.push(component as any);

  // A deferred subagent can start after its placeholder result, when the chat
  // has already moved on: place it where the call was made.
  const background = state.backgroundSubagentCalls?.get(toolCallId);
  if (background) {
    component.setBackgroundTaskId(background.taskId);
    background.component = component;
  }
  const anchorIndex = background?.anchor ? state.chatContainer.children.indexOf(background.anchor as any) : -1;
  if (anchorIndex >= 0) {
    insertChatComponentWithBoundarySpacing(state.chatContainer, component, anchorIndex);
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
  state.backgroundSubagentCalls.set(toolCallId, {
    taskId,
    ...(component ? { component } : { anchor: state.streamingComponent }),
  });
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
