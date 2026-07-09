/**
 * Event handlers for subagent delegation events:
 * subagent_start, subagent_tool_start, subagent_tool_end, subagent_end.
 */
import { insertChatComponentWithBoundarySpacing } from '../chat-boundary-reconciliation.js';
import { SubagentExecutionComponent } from '../components/subagent-execution.js';

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
    expandOnComplete: state.quietMode,
    forked,
  });
  state.pendingSubagents.set(toolCallId, component);
  state.allToolComponents.push(component as any);

  // Insert before the current streamingComponent so subagent box
  // appears between pre-subagent text and post-subagent text
  if (state.streamingComponent) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as any);
    if (idx >= 0) {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component, idx);
    } else {
      insertChatComponentWithBoundarySpacing(state.chatContainer, component);
    }
  } else {
    insertChatComponentWithBoundarySpacing(state.chatContainer, component);
  }

  state.ui.requestRender();
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
    ctx.state.ui.requestRender();
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
    ctx.state.ui.requestRender();
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
    ctx.state.ui.requestRender();
  }
}
