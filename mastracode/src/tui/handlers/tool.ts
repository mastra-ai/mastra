/**
 * Event handlers for tool execution events:
 * tool_start, tool_approval_required, tool_update, shell_output,
 * tool_input_start, tool_input_delta, tool_input_end, tool_end.
 *
 * Also includes formatToolResult helper.
 */

import type { TaskItemInput } from '@mastra/core/harness';
import { safeStringify } from '@mastra/core/utils';
import { parse as parsePartialJson } from 'partial-json';

import { getToolCategory, TOOL_CATEGORIES } from '../../permissions.js';
import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { PlanApprovalInlineComponent } from '../components/plan-approval-inline.js';
import { ToolApprovalDialogComponent } from '../components/tool-approval-dialog.js';
import type { ApprovalAction } from '../components/tool-approval-dialog.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import type { ToolResult } from '../components/tool-execution-enhanced.js';
import { showModalOverlay } from '../overlay.js';
import { getMarkdownTheme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

function getCurrentModeColor(ctx: EventHandlerContext): string | undefined {
  return ctx.state.harness.getCurrentMode?.()?.color;
}

export function isTaskMutationTool(toolName: string): boolean {
  return toolName === 'task_write' || toolName === 'task_update' || toolName === 'task_complete';
}

function applyQuietDisplayForNewTool(ctx: EventHandlerContext, component: ToolExecutionComponentEnhanced): void {
  if (!ctx.state.quietMode) return;

  component.setCompactToolModeColor(getCurrentModeColor(ctx));
  component.setQuietModeDisplay('quiet');
  component.setQuietPreviewLineLimit(ctx.state.quietModeMaxToolPreviewLines);
}

function reconcileToolBoundaries(ctx: EventHandlerContext): void {
  reconcileChatBoundarySpacers(ctx.state.chatContainer);
}

function insertTaskToolErrorComponent(ctx: EventHandlerContext, component: unknown): void {
  const { state } = ctx;
  if (state.streamingComponent) {
    const insertIndex = state.chatContainer.children.indexOf(state.streamingComponent as never);
    if (insertIndex >= 0) {
      (state.chatContainer.children as unknown[]).splice(insertIndex, 0, component);
      state.chatContainer.invalidate();
      return;
    }
  }
  ctx.addChildBeforeFollowUps(component as never);
}

function ensureSubmitPlanComponent(
  ctx: EventHandlerContext,
  toolCallId: string,
  args?: unknown,
): PlanApprovalInlineComponent {
  const { state } = ctx;
  let component = state.pendingSubmitPlanComponents.get(toolCallId);
  if (!component) {
    component = PlanApprovalInlineComponent.createStreaming(state.ui);
    state.pendingSubmitPlanComponents.set(toolCallId, component);
    state.lastSubmitPlanComponent = component;
    ctx.addChildBeforeFollowUps(component);

    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);
  }
  component.updateArgs(args);
  reconcileToolBoundaries(ctx);
  return component;
}

/**
 * Format a tool result for display.
 * Handles objects, strings, and other types.
 * Extracts content from common tool return structures like { content: "...", isError: false }
 */
function isToolResultError(result: unknown): boolean {
  return typeof result === 'object' && result !== null && (result as Record<string, unknown>).isError === true;
}

export function formatToolResult(result: unknown): string {
  if (result === null || result === undefined) {
    return '';
  }
  if (typeof result === 'string') {
    return result;
  }
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    // Handle common tool return format: { content: "...", isError: boolean }
    if ('content' in obj && typeof obj.content === 'string') {
      return obj.content;
    }
    // Handle content array format: { content: [{ type: "text", text: "..." }] }
    if ('content' in obj && Array.isArray(obj.content)) {
      const textParts = obj.content
        .filter(
          (part: unknown) =>
            typeof part === 'object' && part !== null && (part as Record<string, unknown>).type === 'text',
        )
        .map((part: unknown) => (part as Record<string, unknown>).text || '');
      if (textParts.length > 0) {
        return textParts.join('\n');
      }
    }
    try {
      return safeStringify(result, 2);
    } catch {
      return String(result);
    }
  }
  return String(result);
}

export function handleToolApprovalRequired(
  ctx: EventHandlerContext,
  toolCallId: string,
  toolName: string,
  args: unknown,
): void {
  const { state } = ctx;
  // Compute category label for the dialog
  const category = getToolCategory(toolName);
  const categoryLabel = category ? TOOL_CATEGORIES[category]?.label : undefined;

  // Send notification to alert the user
  ctx.notify('tool_approval', `Approve ${toolName}?`);

  const dialog = new ToolApprovalDialogComponent({
    toolCallId,
    toolName,
    args,
    categoryLabel,
    onAction: (action: ApprovalAction) => {
      state.ui.hideOverlay();
      state.pendingApprovalDismiss = null;
      if (action.type === 'approve') {
        state.harness.respondToToolApproval({ decision: 'approve' });
      } else if (action.type === 'always_allow_category') {
        state.harness.respondToToolApproval({ decision: 'always_allow_category' });
      } else if (action.type === 'yolo') {
        state.harness.setState({ yolo: true } as any);
        state.harness.respondToToolApproval({ decision: 'approve' });
      } else {
        state.harness.respondToToolApproval({ decision: 'decline' });
      }
    },
  });

  // Set up Ctrl+C dismiss to decline
  state.pendingApprovalDismiss = () => {
    state.ui.hideOverlay();
    state.pendingApprovalDismiss = null;
    state.harness.respondToToolApproval({ decision: 'decline' });
  };

  // Show the dialog as an overlay
  showModalOverlay(state.ui, dialog, { widthPercent: 0.7 });
  dialog.focused = true;
  state.ui.requestRender();
}

export function handleToolStart(ctx: EventHandlerContext, toolCallId: string, toolName: string, args: unknown): void {
  const { state } = ctx;
  // Component may already exist if created early by handleToolInputStart
  const existingComponent = state.pendingTools.get(toolCallId);
  const existingSubmitPlanComponent = state.pendingSubmitPlanComponents?.get(toolCallId);

  if (existingComponent) {
    // Component was created during input streaming — update with final args
    existingComponent.updateArgs(args);
    reconcileToolBoundaries(ctx);
  } else if (existingSubmitPlanComponent) {
    existingSubmitPlanComponent.updateArgs(args);
  } else if (!state.seenToolCallIds.has(toolCallId)) {
    state.seenToolCallIds.add(toolCallId);

    // Skip creating the regular tool component for subagent calls
    // The SubagentExecutionComponent will handle all the rendering
    if (toolName === 'subagent') {
      return;
    }

    // Skip creating regular component for ask_user — it uses AskQuestionInlineComponent
    // (normally created by handleToolInputStart, but handleToolStart may fire first)
    if (toolName === 'ask_user') {
      return;
    }

    if (toolName === 'submit_plan') {
      ensureSubmitPlanComponent(ctx, toolCallId, args);
      state.ui.requestRender();
      return;
    }

    if (isTaskMutationTool(toolName)) {
      state.taskToolInsertIndex = state.chatContainer.children.length;
      const component = new ToolExecutionComponentEnhanced(
        toolName,
        args,
        { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
        state.ui,
      );
      component.setExpanded(state.toolOutputExpanded);
      state.pendingTools.set(toolCallId, component);
      state.pendingTaskToolIds?.add(toolCallId);
      state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
      ctx.addChildBeforeFollowUps(state.streamingComponent);
      state.ui.requestRender();
      return;
    }

    const component = new ToolExecutionComponentEnhanced(
      toolName,
      args,
      { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
      state.ui,
    );
    component.setExpanded(state.toolOutputExpanded);
    applyQuietDisplayForNewTool(ctx, component);
    ctx.addChildBeforeFollowUps(component);
    state.pendingTools.set(toolCallId, component);
    state.allToolComponents.push(component);
    reconcileToolBoundaries(ctx);

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);

    state.ui.requestRender();
  }

  // File modification tracking is handled by the Harness display state
}

export function handleToolUpdate(ctx: EventHandlerContext, toolCallId: string, partialResult: unknown): void {
  const { state } = ctx;
  const component = state.pendingTools.get(toolCallId);
  if (component) {
    const result: ToolResult = {
      content: [{ type: 'text', text: formatToolResult(partialResult) }],
      isError: false,
    };
    component.updateResult(result, true);
    reconcileToolBoundaries(ctx);
    state.ui.requestRender();
  }
}

/**
 * Handle streaming shell output from execute_command tool.
 */
export function handleShellOutput(
  ctx: EventHandlerContext,
  toolCallId: string,
  output: string,
  _stream: 'stdout' | 'stderr',
): void {
  const { state } = ctx;
  const component = state.pendingTools.get(toolCallId);
  if (component?.appendStreamingOutput) {
    component.appendStreamingOutput(output);
    reconcileToolBoundaries(ctx);
    state.ui.requestRender();
  }
}

/**
 * Handle the start of streaming tool call input arguments.
 * Creates the tool component early so partial args can render as they arrive.
 */
export function handleToolInputStart(ctx: EventHandlerContext, toolCallId: string, toolName: string): void {
  const { state } = ctx;

  // Mark as seen so handleMessageUpdate doesn't create a duplicate component
  if (!state.seenToolCallIds.has(toolCallId)) {
    state.seenToolCallIds.add(toolCallId);
  }

  if (state.pendingTools.has(toolCallId)) {
    if (isTaskMutationTool(toolName)) {
      state.pendingTaskToolIds?.add(toolCallId);
    }
    return;
  }

  // Create the component early so deltas can update it
  // Skip for subagent (handled by SubagentExecutionComponent),
  // task tools (they stream to or update the pinned TaskProgressComponent),
  // and ask_user (uses AskQuestionInlineComponent)
  if (toolName === 'submit_plan') {
    ensureSubmitPlanComponent(ctx, toolCallId);
    state.ui.requestRender();
  } else if (toolName === 'ask_user') {
    if (state.goalManager?.isActive()) {
      return;
    }

    const askComponent = AskQuestionInlineComponent.createStreaming(state.ui);
    ctx.addChildBeforeFollowUps(askComponent);
    state.lastAskUserComponent = askComponent;
    state.pendingAskUserComponents.set(toolCallId, askComponent);

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);

    state.ui.requestRender();
  } else if (isTaskMutationTool(toolName)) {
    // Record position so task_updated can place inline completed/cleared display here
    state.taskToolInsertIndex = state.chatContainer.children.length;
    const component = new ToolExecutionComponentEnhanced(
      toolName,
      {},
      { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
      state.ui,
    );
    component.setExpanded(state.toolOutputExpanded);
    state.pendingTools.set(toolCallId, component);
    state.pendingTaskToolIds?.add(toolCallId);

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    // (even though task_write doesn't render a tool component inline, we still need
    // to split the streaming component so getTrailingContentParts doesn't overwrite it)
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);
    state.ui.requestRender();
  } else if (toolName !== 'subagent') {
    const component = new ToolExecutionComponentEnhanced(
      toolName,
      {},
      { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
      state.ui,
    );
    component.setExpanded(state.toolOutputExpanded);
    applyQuietDisplayForNewTool(ctx, component);
    ctx.addChildBeforeFollowUps(component);
    state.pendingTools.set(toolCallId, component);
    state.allToolComponents.push(component);
    reconcileToolBoundaries(ctx);

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);

    state.ui.requestRender();
  }
}

/**
 * Handle an incremental delta of tool call input arguments.
 * Buffers the partial JSON text and attempts to parse it, updating the component's args.
 */
export function handleToolInputDelta(ctx: EventHandlerContext, toolCallId: string, _argsTextDelta: string): void {
  const { state } = ctx;
  const ds = state.harness.getDisplayState();
  const buffer = ds.toolInputBuffers.get(toolCallId);
  if (buffer === undefined) return;

  const updatedText = buffer.text;

  try {
    const partialArgs = parsePartialJson(updatedText);
    if (partialArgs && typeof partialArgs === 'object') {
      // Update inline tool component if it exists
      const component = state.pendingTools.get(toolCallId);
      if (component) {
        component.updateArgs(partialArgs, false);
        reconcileToolBoundaries(ctx);
        component.refresh?.();
      }

      // For ask_user, stream partial args into the question component
      if (buffer.toolName === 'ask_user') {
        const askComponent = state.pendingAskUserComponents.get(toolCallId);
        if (askComponent) {
          try {
            askComponent.updateArgs(partialArgs);
          } catch {
            // Don't crash on malformed partial args
          }
        }
      }

      // For submit_plan, stream the title/plan args into the inline purple plan box.
      if (buffer.toolName === 'submit_plan') {
        const planComponent = state.pendingSubmitPlanComponents?.get(toolCallId);
        if (planComponent) {
          planComponent.updateArgs(partialArgs);
        }
      }

      // For task_write, stream partial tasks into the pinned TaskProgressComponent.
      // The last array item is actively being written so its content is unstable.
      // If all existing pinned items are already completed, the list is stable and
      // we can stream in new items immediately (including the last one).
      // Otherwise, exclude the last item to avoid jumpy partial-content matches.
      if (buffer.toolName === 'task_write' && state.taskProgress) {
        const tasks = (partialArgs as { tasks?: TaskItemInput[] }).tasks;
        if (tasks && tasks.length > 0) {
          const existing = state.taskProgress.getTasks();
          const allExistingDone = existing.length === 0 || existing.every(t => t.status === 'completed');
          if (allExistingDone) {
            // Old list is done — start fresh, stream new items immediately
            state.taskProgress.updateTasks(tasks);
          } else if (tasks.length > 1) {
            // Merge only completed items (exclude the last still-streaming one)
            const merged = [...existing];
            for (const task of tasks.slice(0, -1)) {
              if (!task.content) continue;
              const idx = task.id
                ? merged.findIndex(t => t.id === task.id)
                : merged.findIndex(t => !t.id && t.content === task.content);
              if (idx >= 0) {
                merged[idx] = task;
              } else {
                merged.push(task);
              }
            }
            state.taskProgress.updateTasks(merged);
          }
        }
      }

      state.ui.requestRender();
    }
  } catch {
    // Malformed or incomplete JSON — partial-json throws MalformedJSON for invalid input
  }
}

/**
 * Clean up the input buffer when tool input streaming ends.
 */
export function handleToolInputEnd(_ctx: EventHandlerContext, _toolCallId: string): void {
  // Buffer cleanup handled by Harness display state
}

export function handleToolEnd(ctx: EventHandlerContext, toolCallId: string, result: unknown, isError: boolean): void {
  const { state } = ctx;
  // If this is a subagent tool, store the result in the SubagentExecutionComponent
  const subagentComponent = state.pendingSubagents.get(toolCallId);
  if (subagentComponent) {
    // The final result is available here
    const resultText = formatToolResult(result);
    // We'll need to wait for subagent_end to set this
    // Store it temporarily
    (subagentComponent as any)._pendingResult = resultText;
  }

  // File modification tracking is handled by the Harness display state

  // Clean up ask_user component tracking
  state.pendingAskUserComponents.delete(toolCallId);

  if (state.pendingSubmitPlanComponents?.has(toolCallId)) {
    // submit_plan renders through PlanApprovalInlineComponent, not the generic tool box.
    return;
  }

  const component = state.pendingTools.get(toolCallId);
  if (component) {
    const isPendingTaskTool = state.pendingTaskToolIds?.has(toolCallId) ?? false;
    const effectiveIsError = isError || isToolResultError(result);
    if (isPendingTaskTool && effectiveIsError) {
      insertTaskToolErrorComponent(ctx, component);
      state.allToolComponents.push(component);
    }

    const toolResult: ToolResult = {
      content: [{ type: 'text', text: formatToolResult(result) }],
      isError: effectiveIsError,
    };
    component.updateResult(toolResult, false);
    reconcileToolBoundaries(ctx);

    state.pendingTools.delete(toolCallId);
    state.pendingTaskToolIds?.delete(toolCallId);
    state.ui.requestRender();
  }
}
