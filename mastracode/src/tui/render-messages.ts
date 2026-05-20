/**
 * Message rendering helpers extracted from MastraTUI.
 *
 * Pure functions that operate on TUIState — no class dependency.
 */
import { Container, Spacer, Text } from '@mariozechner/pi-tui';
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessMessage, HarnessMessageContent, TaskItemInput, TaskItemSnapshot } from '@mastra/core/harness';
import { assignTaskIds, parseSubagentMeta } from '@mastra/core/harness';
import chalk from 'chalk';
import {
  insertChatComponentWithBoundarySpacing,
  reconcileChatBoundarySpacers,
} from './chat-boundary-reconciliation.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { AssistantMessageComponent } from './components/assistant-message.js';
import type { ChatSpacingKind } from './components/chat-spacing.js';
import { OMMarkerComponent } from './components/om-marker.js';
import { OMOutputComponent } from './components/om-output.js';
import { PlanResultComponent } from './components/plan-approval-inline.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { SystemReminderComponent } from './components/system-reminder.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from './components/tool-execution-enhanced.js';
import { PendingUserMessageComponent, UserMessageComponent } from './components/user-message.js';
import { formatToolResult, isTaskMutationTool } from './handlers/tool.js';
import type { TUIState } from './state.js';
import { BOX_INDENT, getMarkdownTheme, theme, mastra } from './theme.js';

// Re-export so existing consumers can still import from here
export { formatToolResult };

function getCurrentModeColor(state: TUIState): string | undefined {
  return state.harness.getCurrentMode?.()?.color;
}

// =============================================================================
// renderCompletedTasksInline / renderClearedTasksInline
// =============================================================================

class TaskHistoryComponent extends Container {
  getChatSpacingKind(): ChatSpacingKind {
    return 'task';
  }
}

function insertTaskHistoryComponent(state: TUIState, component: Component, insertIndex: number): void {
  insertChatComponentWithBoundarySpacing(
    state.chatContainer,
    component,
    insertIndex >= 0 ? insertIndex : state.chatContainer.children.length,
  );
}

/**
 * Render a completed task list inline in the chat history.
 */
export function renderCompletedTasksInline(
  state: TUIState,
  tasks: TaskItemSnapshot[],
  insertIndex = -1,
  collapsed = false,
): void {
  const headerText =
    theme.bold(theme.fg('accent', 'Tasks')) + theme.fg('dim', ` [${tasks.length}/${tasks.length} completed]`);

  const container = new TaskHistoryComponent();
  container.addChild(new Text(headerText, BOX_INDENT, 0));
  const MAX_VISIBLE = 4;
  const shouldCollapse = collapsed && tasks.length > MAX_VISIBLE + 1;
  const visible = shouldCollapse ? tasks.slice(0, MAX_VISIBLE) : tasks;
  const remaining = shouldCollapse ? tasks.length - MAX_VISIBLE : 0;

  for (const task of visible) {
    const icon = chalk.hex(mastra.green)('✓');
    const text = chalk.hex(mastra.green)(task.content);
    container.addChild(new Text(`  ${icon} ${text}`, BOX_INDENT, 0));
  }
  if (remaining > 0) {
    container.addChild(
      new Text(
        theme.fg('dim', `  ... ${remaining} more completed task${remaining > 1 ? 's' : ''} (ctrl+e to expand)`),
        BOX_INDENT,
        0,
      ),
    );
  }
  container.addChild(new Spacer(1));

  insertTaskHistoryComponent(state, container, insertIndex);
}

/**
 * Render inline display when tasks are cleared.
 */
export function renderClearedTasksInline(state: TUIState, clearedTasks: TaskItemSnapshot[], insertIndex = -1): void {
  const container = new TaskHistoryComponent();
  const count = clearedTasks.length;
  const label = count === 1 ? 'Task' : 'Tasks';
  container.addChild(new Text(theme.fg('accent', `${label} cleared`), BOX_INDENT, 0));
  for (const task of clearedTasks) {
    const icon = task.status === 'completed' ? chalk.hex(mastra.green)('✓') : chalk.hex(mastra.darkGray)('○');
    const text = chalk.hex(theme.getTheme().dim).strikethrough(task.content);
    container.addChild(new Text(`  ${icon} ${text}`, BOX_INDENT, 0));
  }
  container.addChild(new Spacer(1));
  insertTaskHistoryComponent(state, container, insertIndex);
}

function renderTaskTransitionFromHistory(
  state: TUIState,
  previousTasks: TaskItemSnapshot[],
  nextTasks: TaskItemSnapshot[],
): { tasks: TaskItemSnapshot[]; replacedWithInline: boolean } {
  const wasAllCompleted = previousTasks.length > 0 && previousTasks.every(t => t.status === 'completed');

  if (nextTasks.length > 0 && nextTasks.every(t => t.status === 'completed')) {
    if (!wasAllCompleted) {
      renderCompletedTasksInline(state, nextTasks, -1, state.quietMode);
    }
    return { tasks: nextTasks, replacedWithInline: true };
  }

  if (nextTasks.length === 0) {
    if (previousTasks.length > 0) {
      renderClearedTasksInline(state, previousTasks);
      return { tasks: [], replacedWithInline: true };
    }
    return { tasks: [], replacedWithInline: false };
  }

  return { tasks: nextTasks, replacedWithInline: true };
}

// =============================================================================
// addUserMessage
// =============================================================================

function createReminderComponent(
  reminderType: string | undefined,
  options: { message?: string; path?: string; gapText?: string; goalMaxTurns?: number; judgeModelId?: string },
): SystemReminderComponent | TemporalGapComponent {
  if (reminderType === 'temporal-gap') {
    return new TemporalGapComponent({
      message: options.message,
      gapText: options.gapText,
    });
  }

  return new SystemReminderComponent({
    message: options.message,
    reminderType,
    path: options.path,
    goalMaxTurns: options.goalMaxTurns,
    judgeModelId: options.judgeModelId,
  });
}

function addChildBeforeFollowUps(state: TUIState, child: Component): void {
  const pendingSignalComponents = state.pendingSignalMessageComponentsById?.values() ?? [];
  const firstPinned = [...state.followUpComponents, ...pendingSignalComponents].find(pinned =>
    state.chatContainer.children.includes(('component' in pinned ? pinned.component : pinned) as never),
  );

  if (firstPinned) {
    const component = 'component' in firstPinned ? firstPinned.component : firstPinned;
    const idx = state.chatContainer.children.indexOf(component as never);
    if (idx >= 0) {
      insertChatComponentWithBoundarySpacing(state.chatContainer, child, idx);
      return;
    }
  }

  insertChatComponentWithBoundarySpacing(state.chatContainer, child);
}

export function addChildBeforeMessageOrFollowUps(state: TUIState, child: Component, precedesMessageId?: string): void {
  if (precedesMessageId) {
    const anchor = state.messageComponentsById.get(precedesMessageId);
    if (anchor) {
      const idx = state.chatContainer.children.indexOf(anchor as never);
      if (idx >= 0) {
        insertChatComponentWithBoundarySpacing(state.chatContainer, child, idx);
        return;
      }
    }
  }

  addChildBeforeFollowUps(state, child);
}

/**
 * Add a user message to the chat container.
 */
export function addPendingUserMessage(
  state: TUIState,
  messageId: string,
  text: string,
  images?: Array<{ data: string; mimeType: string }>,
): void {
  const existing = state.pendingSignalMessageComponentsById.get(messageId);
  if (existing) {
    state.chatContainer.removeChild(existing.component as never);
    reconcileChatBoundarySpacers(state.chatContainer);
  }

  const component = new PendingUserMessageComponent(text, images?.length ?? 0);
  state.pendingSignalMessageComponentsById.set(messageId, { component, text });
  state.chatContainer.addChild(component);
  reconcileChatBoundarySpacers(state.chatContainer);
  state.ui.requestRender();
}

export function confirmPendingUserMessage(state: TUIState, messageId: string, text: string): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  if (state.streamingComponent && state.harness.getDisplayState().isRunning) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }

  replacePendingUserMessage(state, messageId, text);
}

function replacePendingUserMessage(state: TUIState, messageId: string, text: string): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  const confirmed = new UserMessageComponent(text, getMarkdownTheme());
  const idx = state.chatContainer.children.indexOf(pending.component as never);
  if (idx >= 0) {
    (state.chatContainer.children as unknown[]).splice(idx, 1, confirmed);
    reconcileChatBoundarySpacers(state.chatContainer);
  } else {
    addChildBeforeFollowUps(state, confirmed);
  }
  state.pendingSignalMessageComponentsById.delete(messageId);
  state.messageComponentsById.set(messageId, confirmed);
  state.ui.requestRender();
}

export function removePendingUserMessage(state: TUIState, messageId: string): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;
  state.chatContainer.removeChild(pending.component as never);
  state.pendingSignalMessageComponentsById.delete(messageId);
  state.ui.requestRender();
}

export function clearPendingUserMessages(state: TUIState): void {
  for (const pending of state.pendingSignalMessageComponentsById.values()) {
    state.chatContainer.removeChild(pending.component as never);
  }
  state.pendingSignalMessageComponentsById.clear();
  state.ui.requestRender();
}

function confirmMatchingPendingUserMessage(state: TUIState, messageId: string, text: string): boolean {
  const normalizedText = text.trim();
  for (const [pendingId, pending] of state.pendingSignalMessageComponentsById) {
    if (pending.text.trim() !== normalizedText) continue;

    const confirmed = new UserMessageComponent(text, getMarkdownTheme());
    const idx = state.chatContainer.children.indexOf(pending.component as never);
    if (idx >= 0) {
      (state.chatContainer.children as unknown[]).splice(idx, 1, confirmed);
      reconcileChatBoundarySpacers(state.chatContainer);
    } else {
      addChildBeforeFollowUps(state, confirmed);
    }
    state.pendingSignalMessageComponentsById.delete(pendingId);
    state.messageComponentsById.set(messageId, confirmed);
    state.ui.requestRender();
    return true;
  }
  return false;
}

function unescapeSkillBoundary(text: string): string {
  return text.replaceAll('&lt;/skill&gt;', '</skill>');
}

export function addUserMessage(state: TUIState, message: HarnessMessage): void {
  if (state.messageComponentsById.has(message.id)) {
    return;
  }

  const reminderPart = message.content.find(
    (content): content is Extract<HarnessMessageContent, { type: 'system_reminder' }> =>
      content.type === 'system_reminder',
  );

  if (reminderPart) {
    const goalMetadata = reminderPart as typeof reminderPart & { goalMaxTurns?: number; judgeModelId?: string };
    const reminderComponent = createReminderComponent(reminderPart.reminderType, {
      message: reminderPart.message,
      path: reminderPart.path,
      gapText: reminderPart.gapText,
      goalMaxTurns: goalMetadata.goalMaxTurns,
      judgeModelId: goalMetadata.judgeModelId,
    });
    reminderComponent.setExpanded(state.toolOutputExpanded);
    state.allSystemReminderComponents.push(reminderComponent);

    if (!reminderPart.precedesMessageId && state.streamingComponent) {
      const idx = state.chatContainer.children.indexOf(state.streamingComponent as never);
      if (idx >= 0) {
        (state.chatContainer.children as unknown[]).splice(idx, 0, reminderComponent);
        reconcileChatBoundarySpacers(state.chatContainer);
        state.ui.requestRender();
        return;
      }
    }

    addChildBeforeMessageOrFollowUps(state, reminderComponent, reminderPart.precedesMessageId);
    state.ui.requestRender();
    return;
  }

  const textContent = message.content
    .filter(c => c.type === 'text')
    .map(c => (c as { type: 'text'; text: string }).text)
    .join('\n');

  const imageCount = message.content.filter(c => c.type === 'image').length;

  // Strip [image] markers from text since we show count separately
  const displayText = imageCount > 0 ? textContent.replace(/\[image\]\s*/g, '').trim() : textContent.trim();
  const exactDisplayText = displayText.trim();

  if (state.pendingSignalMessageComponentsById.has(message.id)) {
    confirmPendingUserMessage(state, message.id, displayText);
    return;
  }

  if (confirmMatchingPendingUserMessage(state, message.id, displayText)) {
    return;
  }

  const legacyReminderMatch = exactDisplayText.match(
    /^<system-reminder(?<attrs>\s+[^>]*)?>(?<body>[\s\S]*?)<\/system-reminder>$/,
  );
  if (legacyReminderMatch?.groups?.body) {
    const attrs = legacyReminderMatch.groups.attrs ?? '';
    const reminderType = attrs.match(/\stype="([^"]+)"/)?.[1];
    const path = attrs.match(/\spath="([^"]+)"/)?.[1];
    const precedesMessageId = attrs.match(/\sprecedesMessageId="([^"]+)"/)?.[1];
    const reminderText = unescapeSystemReminderText(legacyReminderMatch.groups.body.trim());
    const reminderComponent = createReminderComponent(reminderType, {
      message: reminderText,
      path,
      gapText: reminderType === 'temporal-gap' ? reminderText.split(' — ')[0]?.trim() : undefined,
    });
    reminderComponent.setExpanded(state.toolOutputExpanded);
    state.allSystemReminderComponents.push(reminderComponent);

    addChildBeforeMessageOrFollowUps(state, reminderComponent, precedesMessageId);
    state.ui.requestRender();
    return;
  }

  // Check for persisted slash command tags.
  const slashCommandMatch = exactDisplayText.match(/^<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>$/);
  if (slashCommandMatch) {
    const commandName = slashCommandMatch[1]!;
    const commandContent = slashCommandMatch[2]!.trim();
    const existingSlashComp = state.allSlashCommandComponents.find(
      component =>
        component.matches(commandName, commandContent) && state.chatContainer.children.includes(component as never),
    );
    if (existingSlashComp) {
      state.messageComponentsById.set(message.id, existingSlashComp);
      return;
    }

    const slashComp = new SlashCommandComponent(commandName, commandContent);
    state.allSlashCommandComponents.push(slashComp);
    state.chatContainer.addChild(slashComp);
    state.ui.requestRender();
    return;
  }

  // Check for persisted skill activation tags.
  const skillMatch = exactDisplayText.match(/^<skill\s+name="([^"]*)">([\s\S]*?)<\/skill>$/);
  if (skillMatch) {
    const commandName = `skill/${skillMatch[1]!}`;
    const skillContent = unescapeSkillBoundary(skillMatch[2]!.trim());
    const existingSkillComp = state.allSlashCommandComponents.find(
      component =>
        component.matches(commandName, skillContent) && state.chatContainer.children.includes(component as never),
    );
    if (existingSkillComp) {
      state.messageComponentsById.set(message.id, existingSkillComp);
      return;
    }

    const skillComp = new SlashCommandComponent(commandName, skillContent);
    state.allSlashCommandComponents.push(skillComp);
    state.chatContainer.addChild(skillComp);
    state.ui.requestRender();
    return;
  }

  const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
  if (displayText || prefix) {
    const userComponent = new UserMessageComponent(prefix + displayText, getMarkdownTheme());

    state.messageComponentsById.set(message.id, userComponent);

    if (state.streamingComponent && state.harness.getDisplayState().isRunning) {
      state.chatContainer.addChild(userComponent);
      state.followUpComponents.push(userComponent);
      reconcileChatBoundarySpacers(state.chatContainer);
      return;
    }

    addChildBeforeFollowUps(state, userComponent);
  }
}

function getTaskResultTasks(result: unknown): TaskItemInput[] | undefined {
  if (typeof result !== 'object' || result === null || !('tasks' in result)) return undefined;
  const tasks = (result as { tasks?: unknown }).tasks;
  return Array.isArray(tasks) ? (tasks as TaskItemInput[]) : undefined;
}

function areTasksEqual(left: readonly TaskItemSnapshot[] | undefined, right: readonly TaskItemSnapshot[]): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((task, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      task.id === other.id &&
      task.content === other.content &&
      task.status === other.status &&
      task.activeForm === other.activeForm
    );
  });
}

function applyTaskPatchFallback(
  tasks: TaskItemSnapshot[],
  args: unknown,
  status?: TaskItemSnapshot['status'],
): TaskItemSnapshot[] {
  if (
    typeof args !== 'object' ||
    args === null ||
    !('id' in args) ||
    typeof (args as { id?: unknown }).id !== 'string'
  ) {
    return tasks;
  }

  const patch = args as { id: string; content?: string; status?: TaskItemSnapshot['status']; activeForm?: string };
  return tasks.map(task => (task.id === patch.id ? { ...task, ...patch, ...(status ? { status } : {}) } : task));
}

function applyTaskToolResult(
  tasks: TaskItemSnapshot[],
  toolName: string,
  args: unknown,
  result: unknown,
  isError: boolean,
): TaskItemSnapshot[] {
  if (isError) return tasks;

  if (toolName === 'task_write') {
    const resultTasks = getTaskResultTasks(result);
    const inputTasks = (args as { tasks?: TaskItemInput[] } | undefined)?.tasks;
    const rawTasks = resultTasks ?? inputTasks;
    const nextTasks = rawTasks ? assignTaskIds(rawTasks, tasks) : undefined;
    return nextTasks ? [...nextTasks] : [];
  }

  if (toolName === 'task_update' || toolName === 'task_complete') {
    const resultTasks = getTaskResultTasks(result);
    // Current task patch tools return structured task snapshots. Keep this
    // fallback only for early persisted histories created before that snapshot
    // field existed.
    return resultTasks
      ? assignTaskIds(resultTasks, tasks)
      : applyTaskPatchFallback(tasks, args, toolName === 'task_complete' ? 'completed' : undefined);
  }

  if (toolName === 'task_check') {
    const resultTasks = getTaskResultTasks(result);
    return resultTasks ? assignTaskIds(resultTasks, tasks) : tasks;
  }

  return tasks;
}

// =============================================================================
// renderExistingMessages
// =============================================================================

const STARTUP_MESSAGE_WINDOW_SIZE = 40;

function getLatestMessageTimestamp(messages: HarnessMessage[]): number | undefined {
  let latest: number | undefined;
  for (const message of messages) {
    const time = new Date(message.createdAt).getTime();
    if (Number.isNaN(time)) continue;
    latest = latest === undefined ? time : Math.max(latest, time);
  }
  return latest;
}

/**
 * Re-render all existing messages from the harness thread into the chat container.
 * Called on thread switch and initial load.
 */
export async function renderExistingMessages(state: TUIState): Promise<void> {
  const messages = await state.harness.listMessages({ limit: STARTUP_MESSAGE_WINDOW_SIZE });
  state.lastRenderedMessageAt = getLatestMessageTimestamp(messages);

  state.chatContainer.clear();
  state.pendingTools.clear();
  state.pendingTaskToolIds?.clear();
  state.allToolComponents = [];
  state.allSlashCommandComponents = [];
  state.allSystemReminderComponents = [];
  state.messageComponentsById.clear();
  state.pendingSignalMessageComponentsById.clear();
  state.allShellComponents = [];

  // Local accumulator for detecting task clears during visible history reconstruction.
  // Startup only replays task state from the bounded message window. If no task
  // snapshot exists in that window, keep the existing display-state snapshot.
  let previousTasksAcc: TaskItemSnapshot[] = [];
  let hasReplayedTaskState = false;

  for (const message of messages) {
    if (message.role === 'user') {
      addUserMessage(state, message);
    } else if (message.role === 'assistant') {
      // Render content in order - interleaving text and tool calls
      // Accumulate text/thinking until we hit a tool call, then render both
      let accumulatedContent: HarnessMessageContent[] = [];

      for (const content of message.content) {
        if (content.type === 'text' || content.type === 'thinking') {
          accumulatedContent.push(content);
        } else if (content.type === 'tool_call') {
          // Render accumulated text first if any
          if (accumulatedContent.length > 0) {
            const textMessage: HarnessMessage = {
              ...message,
              content: accumulatedContent,
            };
            const textComponent = new AssistantMessageComponent(
              textMessage,
              state.hideThinkingBlock,
              getMarkdownTheme(),
            );
            state.chatContainer.addChild(textComponent);
            accumulatedContent = [];
          }

          // Find matching tool result
          const toolResult = message.content.find(c => c.type === 'tool_result' && c.id === content.id);

          // Render subagent tool calls with dedicated component
          if (content.name === 'subagent') {
            const subArgs = content.args as
              | {
                  agentType?: string;
                  task?: string;
                  modelId?: string;
                  forked?: boolean;
                }
              | undefined;
            const rawResult = toolResult?.type === 'tool_result' ? formatToolResult(toolResult.result) : undefined;
            const isErr = toolResult?.type === 'tool_result' && toolResult.isError;

            // Parse embedded metadata for model ID, duration, tool calls
            const meta = rawResult ? parseSubagentMeta(rawResult) : null;
            const resultText = meta?.text ?? rawResult;
            const currentModelId =
              typeof (state.harness as { getFullModelId?: () => string }).getFullModelId === 'function'
                ? (state.harness as { getFullModelId: () => string }).getFullModelId()
                : undefined;
            const modelId = meta?.modelId ?? subArgs?.modelId ?? (subArgs?.forked ? currentModelId : undefined);
            const durationMs = meta?.durationMs ?? 0;

            const subComponent = new SubagentExecutionComponent(
              subArgs?.agentType ?? 'unknown',
              subArgs?.task ?? '',
              state.ui,
              modelId,
              { collapseOnComplete: false, expandOnComplete: state.quietMode, forked: subArgs?.forked },
            );
            // Populate tool calls from metadata
            if (meta?.toolCalls) {
              for (const tc of meta.toolCalls) {
                subComponent.addToolStart(tc.name, {});
                subComponent.addToolEnd(tc.name, '', tc.isError);
              }
            }
            // Mark as finished with result
            subComponent.finish(isErr ?? false, durationMs, resultText);
            insertChatComponentWithBoundarySpacing(state.chatContainer, subComponent);
            state.allToolComponents.push(subComponent as any);
            continue;
          }

          // Render ask_user with the proper question component
          if (content.name === 'ask_user' && toolResult?.type === 'tool_result') {
            const askArgs = content.args as
              | { question?: string; options?: Array<{ label: string; description?: string }> }
              | undefined;
            const answer =
              typeof toolResult.result === 'string' ? toolResult.result : formatToolResult(toolResult.result);
            const cancelled = answer === '(skipped)';
            if (askArgs?.question) {
              const askComponent = AskQuestionInlineComponent.fromHistory(
                askArgs.question,
                askArgs.options,
                answer,
                cancelled,
              );
              state.chatContainer.addChild(askComponent);
              continue;
            }
          }

          // Render the tool call
          const toolComponent = new ToolExecutionComponentEnhanced(
            content.name,
            content.args,
            {
              showImages: false,
              collapsedByDefault: !state.toolOutputExpanded,
            },
            state.ui,
          );

          if (toolResult && toolResult.type === 'tool_result') {
            toolComponent.updateResult(
              {
                content: [
                  {
                    type: 'text',
                    text: formatToolResult(toolResult.result),
                  },
                ],
                isError: toolResult.isError,
              },
              false,
            );
          }

          // Successful task transition tools render through the pinned task UI,
          // not as regular tool result boxes.
          let replacedWithInline = false;
          if (isTaskMutationTool(content.name) && toolResult?.type === 'tool_result' && !toolResult.isError) {
            hasReplayedTaskState = true;
            const nextTasks = applyTaskToolResult(
              previousTasksAcc,
              content.name,
              content.args,
              toolResult.result,
              toolResult.isError,
            );
            const transition = renderTaskTransitionFromHistory(state, previousTasksAcc, nextTasks);
            previousTasksAcc = transition.tasks;
            replacedWithInline = transition.replacedWithInline;
          }

          if (content.name === 'task_check' && toolResult?.type === 'tool_result' && !toolResult.isError) {
            const resultTasks = getTaskResultTasks(toolResult.result);
            if (resultTasks) {
              hasReplayedTaskState = true;
              previousTasksAcc = assignTaskIds(resultTasks, previousTasksAcc);
            }
          }

          // If this was submit_plan, show the plan with approval status
          if (content.name === 'submit_plan' && toolResult?.type === 'tool_result') {
            const args = content.args as { title?: string; plan?: string } | undefined;
            // Result could be a string or an object with content property
            let resultText = '';
            if (typeof toolResult.result === 'string') {
              resultText = toolResult.result;
            } else if (
              typeof toolResult.result === 'object' &&
              toolResult.result !== null &&
              'content' in toolResult.result &&
              typeof (toolResult.result as any).content === 'string'
            ) {
              resultText = (toolResult.result as any).content;
            }
            const isApproved = resultText.toLowerCase().includes('approved');
            // Extract feedback if rejected with feedback
            let feedback: string | undefined;
            if (!isApproved && resultText.includes('Feedback:')) {
              const feedbackMatch = resultText.match(/Feedback:\s*(.+)/);
              feedback = feedbackMatch?.[1];
            }

            if (args?.title && args?.plan) {
              const planResult = new PlanResultComponent({
                title: args.title,
                plan: args.plan,
                isApproved,
                feedback,
              });
              state.chatContainer.addChild(planResult);
              replacedWithInline = true;
            }
          }

          if (!replacedWithInline) {
            if (state.quietMode) {
              toolComponent.setCompactToolModeColor(getCurrentModeColor(state));
              toolComponent.setQuietModeDisplay('quiet');
              toolComponent.setQuietPreviewLineLimit(state.quietModeMaxToolPreviewLines);
            }
            state.chatContainer.addChild(toolComponent);
            state.allToolComponents.push(toolComponent);
          } else {
          }
        } else if (
          content.type === 'om_observation_start' ||
          content.type === 'om_observation_end' ||
          content.type === 'om_observation_failed'
        ) {
          // Skip start markers in history — only show completed/failed results
          if (content.type === 'om_observation_start') continue;

          // Render accumulated text first if any
          if (accumulatedContent.length > 0) {
            const textMessage: HarnessMessage = {
              ...message,
              content: accumulatedContent,
            };
            const textComponent = new AssistantMessageComponent(
              textMessage,
              state.hideThinkingBlock,
              getMarkdownTheme(),
            );
            state.chatContainer.addChild(textComponent);
            accumulatedContent = [];
          }

          if (content.type === 'om_observation_end') {
            // Render bordered output box with marker info in footer
            const isReflection = content.operationType === 'reflection';
            const outputComponent = new OMOutputComponent({
              type: isReflection ? 'reflection' : 'observation',
              observations: content.observations ?? '',
              currentTask: content.currentTask,
              suggestedResponse: content.suggestedResponse,
              durationMs: content.durationMs,
              tokensObserved: content.tokensObserved,
              observationTokens: content.observationTokens,
              compressedTokens: isReflection ? content.observationTokens : undefined,
            });
            state.chatContainer.addChild(outputComponent);
          } else {
            // Failed marker
            state.chatContainer.addChild(new OMMarkerComponent(content));
          }
        } else if (content.type === 'om_thread_title_updated') {
          if (state.quietMode) continue;
          // Render thread title update marker in history
          state.chatContainer.addChild(
            new OMMarkerComponent({
              type: 'om_thread_title_updated',
              newTitle: content.newTitle,
              oldTitle: content.oldTitle,
            }),
          );
        }
        // Skip tool_result - it's handled with tool_call above
      }

      // Render any remaining text after the last tool call
      if (accumulatedContent.length > 0) {
        const textMessage: HarnessMessage = {
          ...message,
          content: accumulatedContent,
        };
        const textComponent = new AssistantMessageComponent(textMessage, state.hideThinkingBlock, getMarkdownTheme());
        state.chatContainer.addChild(textComponent);
      }
    }
  }

  // Restore or clear the pinned task list from history replay when the bounded
  // window contains a task snapshot. Otherwise, keep the existing display-state
  // snapshot instead of clobbering older tasks that are outside the render window.
  if (hasReplayedTaskState) {
    if (state.taskProgress) {
      state.taskProgress.updateTasks(previousTasksAcc);
    }
    const currentTasks =
      typeof state.harness.getState === 'function'
        ? (state.harness.getState() as { tasks?: TaskItemSnapshot[] }).tasks
        : undefined;
    if (!areTasksEqual(currentTasks, previousTasksAcc)) {
      try {
        await state.harness.setState({ tasks: previousTasksAcc });
      } catch {
        // Custom harness state schemas may not accept TUI replayed task state.
        // Keep the reconstructed task list local to display state in that case.
      }
    }
    const harnessWithReplayTasks = state.harness as typeof state.harness & {
      restoreDisplayTasks?: (tasks: TaskItemSnapshot[]) => void;
    };
    harnessWithReplayTasks.restoreDisplayTasks?.(previousTasksAcc);
  }

  reconcileChatBoundarySpacers(state.chatContainer);
  state.ui.requestRender();
}

function unescapeSystemReminderText(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
