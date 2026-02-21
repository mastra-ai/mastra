/**
 * Event handlers for subagent delegation events:
 * subagent_start, subagent_tool_start, subagent_tool_end, subagent_end.
 */
import { SubagentExecutionComponent } from '../components/subagent-execution.js';

import type { EventHandlerContext } from './types.js';

export function handleSubagentStart(
  ctx: EventHandlerContext,
  toolCallId: string,
  agentType: string,
  task: string,
  modelId?: string,
): void {
  const { state } = ctx;
  const component = new SubagentExecutionComponent(agentType, task, state.ui, modelId);
  state.pendingSubagents.set(toolCallId, component);
  state.allToolComponents.push(component as any);

  // Insert before the current streamingComponent so subagent box
  // appears between pre-subagent text and post-subagent text
  if (state.streamingComponent) {
    const idx = state.chatContainer.children.indexOf(state.streamingComponent as any);
    if (idx >= 0) {
      (state.chatContainer.children as unknown[]).splice(idx, 0, component);
      state.chatContainer.invalidate();
    } else {
      state.chatContainer.addChild(component);
    }
  } else {
    state.chatContainer.addChild(component);
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
