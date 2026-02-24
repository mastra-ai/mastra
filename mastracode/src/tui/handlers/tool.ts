/**
 * Event handlers for tool execution events:
 * tool_start, tool_approval_required, tool_update, shell_output,
 * tool_input_start, tool_input_delta, tool_input_end, tool_end.
 *
 * Also includes formatToolResult helper.
 */
import { Text } from '@mariozechner/pi-tui';
import type { TaskItem } from '@mastra/core/harness';
import { parse as parsePartialJson } from 'partial-json';

import { getToolCategory, TOOL_CATEGORIES } from '../../permissions.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { ToolApprovalDialogComponent } from '../components/tool-approval-dialog.js';
import type { ApprovalAction } from '../components/tool-approval-dialog.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import type { ToolResult } from '../components/tool-execution-enhanced.js';
import { getMarkdownTheme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

/** Tools that modify files, used for /diff tracking */
const FILE_TOOLS = ['string_replace_lsp', 'write_file', 'ast_smart_edit'];

/**
 * Format a tool result for display.
 * Handles objects, strings, and other types.
 * Extracts content from common tool return structures like { content: "...", isError: false }
 */
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
      return JSON.stringify(result, null, 2);
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
        ctx.updateStatusLine();
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
  state.ui.showOverlay(dialog, {
    width: '70%',
    anchor: 'center',
  });
  dialog.focused = true;
  state.ui.requestRender();
}

export function handleToolStart(ctx: EventHandlerContext, toolCallId: string, toolName: string, args: unknown): void {
  const { state } = ctx;
  // Component may already exist if created early by handleToolInputStart
  const existingComponent = state.pendingTools.get(toolCallId);

  if (existingComponent) {
    // Component was created during input streaming — update with final args
    existingComponent.updateArgs(args);
  } else if (!state.seenToolCallIds.has(toolCallId)) {
    state.seenToolCallIds.add(toolCallId);

    // Skip creating the regular tool component for subagent calls
    // The SubagentExecutionComponent will handle all the rendering
    if (toolName === 'subagent') {
      return;
    }

    ctx.addChildBeforeFollowUps(new Text('', 0, 0));
    const component = new ToolExecutionComponentEnhanced(
      toolName,
      args,
      { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
      state.ui,
    );
    component.setExpanded(state.toolOutputExpanded);
    ctx.addChildBeforeFollowUps(component);
    state.pendingTools.set(toolCallId, component);
    state.allToolComponents.push(component);

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);

    state.ui.requestRender();
  }

  // Track ask_user tool components for inline question placement
  const component = state.pendingTools.get(toolCallId);
  if (component) {
    if (toolName === 'ask_user') {
      state.lastAskUserComponent = component;
    }
    // Track submit_plan tool components for inline plan approval placement
    if (toolName === 'submit_plan') {
      state.lastSubmitPlanComponent = component;
    }
  }

  // Track file-modifying tools for /diff command
  if (FILE_TOOLS.includes(toolName)) {
    const toolArgs = args as Record<string, unknown>;
    const filePath = toolArgs?.path as string;
    if (filePath) {
      state.pendingFileTools.set(toolCallId, { toolName, filePath });
    }
  }
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
    state.ui.requestRender();
  }
}

/**
 * Handle the start of streaming tool call input arguments.
 * Creates the tool component early so partial args can render as they arrive.
 */
export function handleToolInputStart(ctx: EventHandlerContext, toolCallId: string, toolName: string): void {
  const { state } = ctx;
  state.toolInputBuffers.set(toolCallId, { text: '', toolName });

  // Mark as seen so handleMessageUpdate doesn't create a duplicate component
  if (!state.seenToolCallIds.has(toolCallId)) {
    state.seenToolCallIds.add(toolCallId);
  }

  // Create the component early so deltas can update it
  // Skip for subagent (handled by SubagentExecutionComponent) and task_write (streams to pinned TaskProgressComponent)
  if (toolName === 'task_write') {
    // Record position so task_updated can place inline completed/cleared display here
    state.taskWriteInsertIndex = state.chatContainer.children.length;

    // Create a new post-tool AssistantMessageComponent so pre-tool text is preserved
    // (even though task_write doesn't render a tool component inline, we still need
    // to split the streaming component so getTrailingContentParts doesn't overwrite it)
    state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
    ctx.addChildBeforeFollowUps(state.streamingComponent);
    state.ui.requestRender();
  } else if (toolName !== 'subagent') {
    ctx.addChildBeforeFollowUps(new Text('', 0, 0));
    const component = new ToolExecutionComponentEnhanced(
      toolName,
      {},
      { showImages: false, collapsedByDefault: !state.toolOutputExpanded },
      state.ui,
    );
    component.setExpanded(state.toolOutputExpanded);
    ctx.addChildBeforeFollowUps(component);
    state.pendingTools.set(toolCallId, component);
    state.allToolComponents.push(component);

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
export function handleToolInputDelta(ctx: EventHandlerContext, toolCallId: string, argsTextDelta: string): void {
  const { state } = ctx;
  const buffer = state.toolInputBuffers.get(toolCallId);
  if (buffer === undefined) return;

  buffer.text += argsTextDelta;
  const updatedText = buffer.text;

  try {
    const partialArgs = parsePartialJson(updatedText);
    if (partialArgs && typeof partialArgs === 'object') {
      // Update inline tool component if it exists
      const component = state.pendingTools.get(toolCallId);
      if (component) {
        component.updateArgs(partialArgs);
      }

      // For task_write, stream partial tasks into the pinned TaskProgressComponent.
      // The last array item is actively being written so its content is unstable.
      // If all existing pinned items are already completed, the list is stable and
      // we can stream in new items immediately (including the last one).
      // Otherwise, exclude the last item to avoid jumpy partial-content matches.
      if (buffer.toolName === 'task_write' && state.taskProgress) {
        const tasks = (partialArgs as { tasks?: TaskItem[] }).tasks;
        if (tasks && tasks.length > 0) {
          const existing = state.taskProgress.getTasks();
          const allExistingDone = existing.length === 0 || existing.every(t => t.status === 'completed');
          if (allExistingDone) {
            // Old list is done — start fresh, stream new items immediately
            state.taskProgress.updateTasks(tasks as TaskItem[]);
          } else if (tasks.length > 1) {
            // Merge only completed items (exclude the last still-streaming one)
            const merged = [...existing];
            for (const task of tasks.slice(0, -1)) {
              if (!task.content) continue;
              const idx = merged.findIndex(t => t.content === task.content);
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
export function handleToolInputEnd(ctx: EventHandlerContext, toolCallId: string): void {
  ctx.state.toolInputBuffers.delete(toolCallId);
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

  // Track successful file modifications for /diff command
  const pendingFile = state.pendingFileTools.get(toolCallId);
  if (pendingFile && !isError) {
    const existing = state.modifiedFiles.get(pendingFile.filePath);
    if (existing) {
      existing.operations.push(pendingFile.toolName);
    } else {
      state.modifiedFiles.set(pendingFile.filePath, {
        operations: [pendingFile.toolName],
        firstModified: new Date(),
      });
    }
  }
  state.pendingFileTools.delete(toolCallId);

  const component = state.pendingTools.get(toolCallId);
  if (component) {
    const toolResult: ToolResult = {
      content: [{ type: 'text', text: formatToolResult(result) }],
      isError,
    };
    component.updateResult(toolResult, false);

    state.pendingTools.delete(toolCallId);
    state.ui.requestRender();
  }
}
