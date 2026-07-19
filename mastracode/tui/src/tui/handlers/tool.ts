/**
 * Event handlers for tool execution events:
 * tool_start, tool_approval_required, tool_update, shell_output,
 * tool_input_start, tool_input_delta, tool_input_end, tool_end.
 *
 * Also includes formatToolResult helper.
 */

import { getToolCategory, TOOL_CATEGORIES } from '@mastra/code-sdk/permissions';
import type { TaskItemInput } from '@mastra/core/signals';
import { safeStringify } from '@mastra/core/utils';
import { parse as parseJsonRiver } from 'jsonriver';

import { reconcileChatBoundarySpacers } from '../chat-boundary-reconciliation.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { AssistantMessageComponent } from '../components/assistant-message.js';
import { PlanApprovalInlineComponent } from '../components/plan-approval-inline.js';
import { SubagentExecutionComponent } from '../components/subagent-execution.js';
import { ToolApprovalDialogComponent } from '../components/tool-approval-dialog.js';
import type { ApprovalAction } from '../components/tool-approval-dialog.js';
import { ToolExecutionComponentEnhanced } from '../components/tool-execution-enhanced.js';
import type { ToolResult } from '../components/tool-execution-enhanced.js';
import { showModalOverlay } from '../overlay.js';
import { DEFAULT_RENDER_COALESCE_MS, requestRender, flushRender } from '../render-scheduler.js';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { getMarkdownTheme } from '../theme.js';

import type { EventHandlerContext } from './types.js';

function getCurrentModeColor(ctx: EventHandlerContext): string | undefined {
  const color = ctx.state.session?.mode?.resolve?.()?.metadata?.color;
  return typeof color === 'string' ? color : undefined;
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

const pluginSubagentToolCallIds = new Set<string>();

interface PendingShellOutput {
  output: string;
  timer: ReturnType<typeof setTimeout>;
}

const pendingShellOutputs = new Map<string, PendingShellOutput>();

export function clearPendingShellOutputs(): void {
  for (const pending of pendingShellOutputs.values()) {
    clearTimeout(pending.timer);
  }
  pendingShellOutputs.clear();
}

type JsonObject = Record<string, unknown>;

class AsyncStringQueue implements AsyncIterable<string> {
  #chunks: string[] = [];
  #waiting: ((result: IteratorResult<string>) => void) | undefined;
  #closed = false;

  push(chunk: string): void {
    if (this.#closed) return;
    const waiting = this.#waiting;
    if (waiting) {
      this.#waiting = undefined;
      waiting({ value: chunk, done: false });
      return;
    }
    this.#chunks.push(chunk);
  }

  close(): void {
    this.#closed = true;
    const waiting = this.#waiting;
    if (waiting) {
      this.#waiting = undefined;
      waiting({ value: undefined, done: true });
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<string> {
    return {
      next: () => {
        const chunk = this.#chunks.shift();
        if (chunk !== undefined) return Promise.resolve({ value: chunk, done: false });
        if (this.#closed) return Promise.resolve({ value: undefined, done: true });
        return new Promise(resolve => {
          this.#waiting = resolve;
        });
      },
    };
  }
}

interface ToolInputParserState {
  queue: AsyncStringQueue;
  iterator: AsyncIterableIterator<unknown>;
  latestArgs?: JsonObject;
  applyTimer?: ReturnType<typeof setTimeout>;
  closed: boolean;
}

const toolInputParsers = new Map<string, ToolInputParserState>();

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isTaskStatus(value: unknown): value is TaskItemInput['status'] {
  return value === 'pending' || value === 'in_progress' || value === 'completed';
}

function isRenderableTask(value: unknown): value is TaskItemInput {
  if (!isJsonObject(value) || !isTaskStatus(value.status)) return false;
  if (typeof value.content !== 'string' || value.content.length === 0) return false;
  if (value.status === 'in_progress' && (typeof value.activeForm !== 'string' || value.activeForm.length === 0)) {
    return false;
  }
  return true;
}

function getRenderableTasks(value: unknown): TaskItemInput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRenderableTask);
}

function createToolInputParser(toolCallId: string): ToolInputParserState {
  const queue = new AsyncStringQueue();
  const state: ToolInputParserState = {
    queue,
    iterator: parseJsonRiver(queue) as AsyncIterableIterator<unknown>,
    closed: false,
  };
  toolInputParsers.set(toolCallId, state);
  return state;
}

function closeToolInputParser(toolCallId: string): void {
  const parser = toolInputParsers.get(toolCallId);
  if (!parser) return;
  parser.closed = true;
  if (parser.applyTimer) {
    clearTimeout(parser.applyTimer);
    parser.applyTimer = undefined;
  }
  parser.queue.close();
  toolInputParsers.delete(toolCallId);
}

export function clearToolInputParsers(): void {
  for (const toolCallId of toolInputParsers.keys()) {
    closeToolInputParser(toolCallId);
  }
}

type SubagentProgressEvent =
  | { event: 'text'; text: string }
  | { event: 'tool_start'; toolName: string; args?: unknown }
  | { event: 'tool_end'; toolName: string; result?: unknown; isError?: boolean }
  | { event: 'finish'; isError?: boolean; durationMs?: number; result?: string };

function isSubagentProgressEvent(value: unknown): value is SubagentProgressEvent {
  if (!value || typeof value !== 'object') return false;
  const event = (value as Record<string, unknown>).event;
  return event === 'text' || event === 'tool_start' || event === 'tool_end' || event === 'finish';
}

function getTaskFromArgs(args: unknown, fallback: string): string {
  if (args && typeof args === 'object') {
    const question = (args as Record<string, unknown>).question;
    if (typeof question === 'string' && question.trim()) return question;
    const task = (args as Record<string, unknown>).task;
    if (typeof task === 'string' && task.trim()) return task;
  }
  return fallback;
}

export function createStaticSubagentComponent(
  ctx: EventHandlerContext,
  toolCallId: string,
  toolName: string,
  args: unknown,
): SubagentExecutionComponent | undefined {
  const renderConfig = ctx.state.pluginManager?.getToolRenderConfig(toolName);
  if (renderConfig?.type !== 'subagent') return undefined;

  const { state } = ctx;
  const existing = state.pendingSubagents.get(toolCallId);
  if (existing) {
    existing.setTask(getTaskFromArgs(args, toolName));
    return existing;
  }

  const component = new SubagentExecutionComponent(
    renderConfig.agentType ?? 'plugin',
    getTaskFromArgs(args, toolName),
    state.ui,
    renderConfig.modelId,
    {
      collapseOnComplete: false,
      expandOnComplete: state.quietMode,
      forked: renderConfig.forked,
      label: renderConfig.label,
      maxActivityLines: renderConfig.maxActivityLines,
      collapsedLines: renderConfig.collapsedLines,
      colors: renderConfig.colors,
      icons: renderConfig.icons,
    },
  );
  state.pendingSubagents.set(toolCallId, component);
  pluginSubagentToolCallIds.add(toolCallId);
  state.allToolComponents.push(component as any);
  ctx.addChildBeforeFollowUps(component);

  state.streamingComponent = new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme());
  ctx.addChildBeforeFollowUps(state.streamingComponent);

  reconcileToolBoundaries(ctx);
  flushRender(state);
  return component;
}

function handleSubagentProgress(
  ctx: EventHandlerContext,
  toolCallId: string,
  progress: SubagentProgressEvent,
): boolean {
  const { state } = ctx;
  const component = state.pendingSubagents.get(toolCallId);
  if (!component || !pluginSubagentToolCallIds.has(toolCallId)) return false;

  switch (progress.event) {
    case 'text':
      component.setText(progress.text);
      break;
    case 'tool_start':
      component.addToolStart(progress.toolName, progress.args);
      break;
    case 'tool_end':
      component.addToolEnd(progress.toolName, progress.result, progress.isError ?? false);
      break;
    case 'finish':
      component.finish(progress.isError ?? false, progress.durationMs ?? 0, progress.result);
      break;
  }

  reconcileToolBoundaries(ctx);
  requestRender(state);
  return true;
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
    return sanitizeAnsiForRendering(result);
  }
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    // Handle common tool return format: { content: "...", isError: boolean }
    if ('content' in obj && typeof obj.content === 'string') {
      return sanitizeAnsiForRendering(obj.content);
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
        return sanitizeAnsiForRendering(textParts.join('\n'));
      }
    }
    try {
      return sanitizeAnsiForRendering(safeStringify(result, 2));
    } catch {
      return sanitizeAnsiForRendering(String(result));
    }
  }
  return sanitizeAnsiForRendering(String(result));
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

  const firePermissionResult = (decision: 'approved' | 'declined' | 'dismissed' | 'auto_approved') => {
    state.hookManager?.runPermissionResult('tool_approval', toolCallId, toolName, decision, args).catch(() => {});
  };

  const dialog = new ToolApprovalDialogComponent({
    toolCallId,
    toolName,
    args,
    categoryLabel,
    onAction: (action: ApprovalAction) => {
      state.ui.hideOverlay();
      state.pendingApprovalDismiss = null;
      if (action.type === 'approve') {
        firePermissionResult('approved');
        state.session.respondToToolApproval({ decision: 'approve' });
      } else if (action.type === 'always_allow_category') {
        firePermissionResult('approved');
        state.session.respondToToolApproval({ decision: 'always_allow_category' });
      } else if (action.type === 'yolo') {
        firePermissionResult('auto_approved');
        void state.session.state.set({ yolo: true } as any);
        state.session.respondToToolApproval({ decision: 'approve' });
      } else {
        firePermissionResult('declined');
        state.session.respondToToolApproval({ decision: 'decline' });
      }
    },
  });

  // Set up dismissal to decline
  state.pendingApprovalDismiss = declineContext => {
    state.ui.hideOverlay();
    state.pendingApprovalDismiss = null;
    firePermissionResult('dismissed');
    state.session.respondToToolApproval({ decision: 'decline', declineContext });
  };

  // Show the dialog as an overlay
  showModalOverlay(state.ui, dialog, { widthPercent: 0.7 });
  dialog.focused = true;
  flushRender(state);
}

export function handleToolStart(ctx: EventHandlerContext, toolCallId: string, toolName: string, args: unknown): void {
  const { state } = ctx;
  // Component may already exist if created early by handleToolInputStart
  const existingComponent = state.pendingTools.get(toolCallId);
  const existingSubmitPlanComponent = state.pendingSubmitPlanComponents?.get(toolCallId);

  if (state.pendingSubagents.has(toolCallId) && pluginSubagentToolCallIds.has(toolCallId)) {
    createStaticSubagentComponent(ctx, toolCallId, toolName, args);
    return;
  }

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

    if (createStaticSubagentComponent(ctx, toolCallId, toolName, args)) {
      return;
    }

    // Skip creating regular component for ask_user — it uses AskQuestionInlineComponent
    // (normally created by handleToolInputStart, but handleToolStart may fire first)
    if (toolName === 'ask_user') {
      return;
    }

    if (toolName === 'submit_plan') {
      ensureSubmitPlanComponent(ctx, toolCallId, args);
      flushRender(state);
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
      flushRender(state);
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

    flushRender(state);
  }

  // File modification tracking is handled by the AgentController display state
}

export function handleToolUpdate(ctx: EventHandlerContext, toolCallId: string, partialResult: unknown): void {
  if (isSubagentProgressEvent(partialResult) && handleSubagentProgress(ctx, toolCallId, partialResult)) {
    return;
  }

  const { state } = ctx;
  const component = state.pendingTools.get(toolCallId);
  if (component) {
    const result: ToolResult = {
      content: [{ type: 'text', text: formatToolResult(partialResult) }],
      isError: false,
    };
    component.updateResult(result, true);
    reconcileToolBoundaries(ctx);
    requestRender(state);
  }
}

/**
 * Handle streaming shell output from execute_command tool.
 */
function flushPendingShellOutput(ctx: EventHandlerContext, toolCallId: string): void {
  const pending = pendingShellOutputs.get(toolCallId);
  if (!pending) return;
  pendingShellOutputs.delete(toolCallId);
  clearTimeout(pending.timer);

  const { state } = ctx;
  const component = state.pendingTools.get(toolCallId);
  if (component?.appendStreamingOutput) {
    component.appendStreamingOutput(pending.output);
    reconcileToolBoundaries(ctx);
    requestRender(state);
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
  const pending = pendingShellOutputs.get(toolCallId);
  if (pending) {
    pending.output += output;
    return;
  }

  pendingShellOutputs.set(toolCallId, {
    output,
    timer: setTimeout(() => flushPendingShellOutput(ctx, toolCallId), DEFAULT_RENDER_COALESCE_MS),
  });
}

/**
 * Handle the start of streaming tool call input arguments.
 * Creates the tool component early so partial args can render as they arrive.
 */
export function handleToolInputStart(ctx: EventHandlerContext, toolCallId: string, toolName: string): void {
  const { state } = ctx;
  closeToolInputParser(toolCallId);
  const parser = createToolInputParser(toolCallId);
  void processToolInputParser(ctx, toolCallId, parser);

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
    flushRender(state);
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

    flushRender(state);
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
    flushRender(state);
  } else if (toolName !== 'subagent') {
    if (createStaticSubagentComponent(ctx, toolCallId, toolName, {})) {
      return;
    }

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

    flushRender(state);
  }
}

/**
 * Apply the latest progressive JSON object from the stateful tool-input parser.
 */
function applyParsedToolArgs(
  ctx: EventHandlerContext,
  toolCallId: string,
  toolName: string,
  partialArgs: JsonObject,
): void {
  const { state } = ctx;

  const component = state.pendingTools.get(toolCallId);
  if (component) {
    component.updateArgs(partialArgs, false);
    reconcileToolBoundaries(ctx);
    component.refresh?.();
  }

  if (toolName === 'ask_user') {
    const askComponent = state.pendingAskUserComponents.get(toolCallId);
    if (askComponent) {
      try {
        askComponent.updateArgs(partialArgs);
      } catch {
        // Don't crash on malformed partial args
      }
    }
  }

  if (toolName === 'submit_plan') {
    const planComponent = state.pendingSubmitPlanComponents?.get(toolCallId);
    if (planComponent) {
      planComponent.updateArgs(partialArgs);
    }
  }

  if (toolName === 'task_write' && state.taskProgress) {
    const tasks = getRenderableTasks(partialArgs.tasks);
    if (tasks.length > 0) {
      const existing = state.taskProgress.getTasks();
      const allExistingDone = existing.length === 0 || existing.every(t => t.status === 'completed');
      if (allExistingDone) {
        // Old list is done — start fresh, stream new items immediately
        state.taskProgress.updateTasks(tasks);
      } else if (tasks.length > 1) {
        // Merge only completed items (exclude the last still-streaming one)
        const merged = [...existing];
        for (const task of tasks.slice(0, -1)) {
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

  requestRender(state);
}

function flushLatestParsedToolArgs(ctx: EventHandlerContext, toolCallId: string): void {
  const parser = toolInputParsers.get(toolCallId);
  if (!parser || parser.closed || !parser.latestArgs) return;

  const buffer = ctx.state.session.displayState.get().toolInputBuffers.get(toolCallId);
  if (!buffer) return;
  applyParsedToolArgs(ctx, toolCallId, buffer.toolName, parser.latestArgs);
}

function scheduleParsedToolArgsApply(ctx: EventHandlerContext, toolCallId: string, parser: ToolInputParserState): void {
  if (parser.applyTimer) return;
  parser.applyTimer = setTimeout(() => {
    parser.applyTimer = undefined;
    flushLatestParsedToolArgs(ctx, toolCallId);
  }, DEFAULT_RENDER_COALESCE_MS);
}

async function processToolInputParser(
  ctx: EventHandlerContext,
  toolCallId: string,
  parser: ToolInputParserState,
): Promise<void> {
  try {
    while (!parser.closed) {
      const next = await parser.iterator.next();
      if (next.done) return;
      if (!isJsonObject(next.value)) continue;

      parser.latestArgs = next.value;
      if (parser.closed) return;
      scheduleParsedToolArgsApply(ctx, toolCallId, parser);
    }
  } catch {
    closeToolInputParser(toolCallId);
  }
}

/**
 * Handle an incremental delta of tool call input arguments.
 * Feeds only the incoming JSON fragment to the stateful parser.
 */
export function handleToolInputDelta(ctx: EventHandlerContext, toolCallId: string, argsTextDelta: string): void {
  const buffer = ctx.state.session.displayState.get().toolInputBuffers.get(toolCallId);
  if (buffer === undefined) return;

  let parser = toolInputParsers.get(toolCallId);
  if (!parser) {
    parser = createToolInputParser(toolCallId);
    void processToolInputParser(ctx, toolCallId, parser);
  }

  parser.queue.push(argsTextDelta);
}

/**
 * Clean up the input buffer when tool input streaming ends.
 */
export function handleToolInputEnd(ctx: EventHandlerContext, toolCallId: string): void {
  flushLatestParsedToolArgs(ctx, toolCallId);
  closeToolInputParser(toolCallId);
}

export function handleToolEnd(ctx: EventHandlerContext, toolCallId: string, result: unknown, isError: boolean): void {
  flushPendingShellOutput(ctx, toolCallId);
  const { state } = ctx;
  // If this is a subagent tool, store the result in the SubagentExecutionComponent
  const subagentComponent = state.pendingSubagents.get(toolCallId);
  if (subagentComponent) {
    const resultText = formatToolResult(result);
    if (pluginSubagentToolCallIds.has(toolCallId)) {
      subagentComponent.finish(isError, 0, resultText);
      state.pendingSubagents.delete(toolCallId);
      pluginSubagentToolCallIds.delete(toolCallId);
      flushRender(state);
    } else {
      // We'll need to wait for subagent_end to set this
      // Store it temporarily
      (subagentComponent as any)._pendingResult = resultText;
    }
  }

  // File modification tracking is handled by the AgentController display state

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
    flushRender(state);
  }
}
