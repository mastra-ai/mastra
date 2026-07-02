/**
 * Message rendering helpers extracted from MastraTUI.
 *
 * Pure functions that operate on TUIState — no class dependency.
 */
import { Container, Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import type { AgentControllerMessage, AgentControllerMessageContent } from '@mastra/core/agent-controller';
import { parseSubagentMeta } from '@mastra/core/agent-controller';
import type { TaskItemInput, TaskItemSnapshot } from '@mastra/core/signals';
import { assignTaskIds } from '@mastra/core/signals';
import type { GoalEvaluationPayload } from '@mastra/core/stream';
import { TASKS_STATE_ID } from '@mastra/core/tools';
import { readPlanFile, resolvePlanPath } from '../utils/plans.js';
import {
  insertChatComponentWithBoundarySpacing,
  reconcileChatBoundarySpacers,
} from './chat-boundary-reconciliation.js';
import { AskQuestionInlineComponent } from './components/ask-question-inline.js';
import { AssistantMessageComponent } from './components/assistant-message.js';
import type { ChatSpacingKind } from './components/chat-spacing.js';
import { JudgeDisplayComponent } from './components/judge-display.js';
import { NotificationSummaryComponent } from './components/notification-summary.js';
import { NotificationComponent } from './components/notification.js';
import { OMMarkerComponent } from './components/om-marker.js';
import { OMOutputComponent } from './components/om-output.js';
import { PlanResultComponent } from './components/plan-approval-inline.js';
import { ReactiveSignalComponent } from './components/reactive-signal.js';
import { SlashCommandComponent } from './components/slash-command.js';
import { StateSignalComponent } from './components/state-signal.js';
import { SubagentExecutionComponent } from './components/subagent-execution.js';
import { SystemReminderComponent } from './components/system-reminder.js';
import { formatTaskProgressLine } from './components/task-progress.js';
import { TemporalGapComponent } from './components/temporal-gap.js';
import { ToolExecutionComponentEnhanced } from './components/tool-execution-enhanced.js';
import { PendingUserMessageComponent, UserMessageComponent } from './components/user-message.js';
import { formatToolResult, isTaskMutationTool } from './handlers/tool.js';
import type { TUIState } from './state.js';
import { BOX_INDENT, getMarkdownTheme, theme } from './theme.js';

// Re-export so existing consumers can still import from here
export { formatToolResult };

const WHILE_ACTIVE_USER_MESSAGE_LABEL = 'steer';
// These are internal control-plane signals handled by GithubSignals. The user-visible
// result is rendered by github-sync-status, so showing these would duplicate the UI.
const HIDDEN_REACTIVE_SIGNAL_TAGS = new Set(['github-subscribe-pr', 'github-unsubscribe-pr']);
const GOAL_STATE_SIGNAL_ID = 'goal';

function shouldRenderReactiveSignal(tagName: string): boolean {
  return !HIDDEN_REACTIVE_SIGNAL_TAGS.has(tagName);
}

type MessageWithAttributes = AgentControllerMessage & {
  attributes?: Record<string, string | number | boolean | null | undefined>;
};

function getUserMessageLabel(message: MessageWithAttributes, fallbackLabel?: string): string | undefined {
  if (message.attributes?.delivery === 'while-active') return WHILE_ACTIVE_USER_MESSAGE_LABEL;
  return fallbackLabel;
}

function getPendingUserMessageLabel(isInterjection?: boolean): string | undefined {
  return isInterjection ? WHILE_ACTIVE_USER_MESSAGE_LABEL : undefined;
}

function getCurrentModeColor(state: TUIState): string | undefined {
  const color = state.session.mode.resolve().metadata?.color;
  return typeof color === 'string' ? color : undefined;
}

function getTaskFromToolArgs(args: unknown, fallback: string): string {
  if (args && typeof args === 'object') {
    const question = (args as Record<string, unknown>).question;
    if (typeof question === 'string' && question.trim()) return question;
    const task = (args as Record<string, unknown>).task;
    if (typeof task === 'string' && task.trim()) return task;
  }
  return fallback;
}

// =============================================================================
// renderClearedTasksInline
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
 * Render inline display when tasks are cleared.
 */
export function renderClearedTasksInline(state: TUIState, clearedTasks: TaskItemSnapshot[], insertIndex = -1): void {
  const container = new TaskHistoryComponent();
  const count = clearedTasks.length;
  const label = count === 1 ? 'Task' : 'Tasks';
  container.addChild(new Text(theme.fg('accent', `${label} cleared`), BOX_INDENT, 0));
  for (const task of clearedTasks) {
    container.addChild(new Text(formatTaskProgressLine(task, '  '), BOX_INDENT, 0));
  }
  insertTaskHistoryComponent(state, container, insertIndex);
}

export function renderCompletedTasksInline(
  state: TUIState,
  completedTasks: TaskItemSnapshot[],
  insertIndex = -1,
): void {
  const container = new TaskHistoryComponent();
  const count = completedTasks.length;
  container.addChild(
    new Text(`${theme.fg('accent', 'Tasks')} ${theme.fg('dim', `[${count}/${count} completed]`)}`, BOX_INDENT, 0),
  );
  for (const task of completedTasks) {
    container.addChild(new Text(formatTaskProgressLine(task, '  '), BOX_INDENT, 0));
  }
  insertTaskHistoryComponent(state, container, insertIndex);
}

function getTaskKey(task: TaskItemSnapshot): string {
  return task.id || task.content;
}

export function renderTaskDeltaInline(
  state: TUIState,
  previousTasks: TaskItemSnapshot[],
  nextTasks: TaskItemSnapshot[],
  insertIndex = -1,
): boolean {
  const previousByKey = new Map(previousTasks.map(task => [getTaskKey(task), task]));
  const addedTasks = nextTasks.filter(task => !previousByKey.has(getTaskKey(task)));
  const inProgressTasks = nextTasks.filter(task => {
    const previous = previousByKey.get(getTaskKey(task));
    return task.status === 'in_progress' && previous?.status !== 'in_progress';
  });
  const completedTasks = nextTasks.filter(task => {
    const previous = previousByKey.get(getTaskKey(task));
    return task.status === 'completed' && previous?.status !== 'completed';
  });

  if (addedTasks.length === 0 && inProgressTasks.length === 0 && completedTasks.length === 0) return false;

  const changedTaskKeys = new Set([...addedTasks, ...inProgressTasks, ...completedTasks].map(getTaskKey));
  const changedTasks = nextTasks.filter(task => changedTaskKeys.has(getTaskKey(task)));

  const container = new TaskHistoryComponent();
  container.addChild(new Text(theme.fg('accent', 'Tasks'), BOX_INDENT, 0));

  for (const task of changedTasks) {
    container.addChild(new Text(formatTaskProgressLine(task, '  '), BOX_INDENT, 0));
  }

  insertTaskHistoryComponent(state, container, insertIndex);
  return true;
}

function renderTaskTransitionFromHistory(
  state: TUIState,
  previousTasks: TaskItemSnapshot[],
  nextTasks: TaskItemSnapshot[],
): { tasks: TaskItemSnapshot[]; replacedWithInline: boolean } {
  if (nextTasks.length > 0 && nextTasks.every(t => t.status === 'completed')) {
    renderCompletedTasksInline(state, nextTasks);
    return { tasks: nextTasks, replacedWithInline: true };
  }

  if (nextTasks.length === 0) {
    if (previousTasks.length > 0) {
      renderClearedTasksInline(state, previousTasks);
      return { tasks: [], replacedWithInline: true };
    }
    return { tasks: [], replacedWithInline: false };
  }

  renderTaskDeltaInline(state, previousTasks, nextTasks);
  return { tasks: nextTasks, replacedWithInline: true };
}

// =============================================================================
// addUserMessage
// =============================================================================

function createReminderComponent(
  reminderType: string | undefined,
  options: {
    message?: string;
    path?: string;
    gapText?: string;
    goalMaxTurns?: number;
    judgeModelId?: string;
  },
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
  options?: { isInterjection?: boolean },
): void {
  const existing = state.pendingSignalMessageComponentsById.get(messageId);
  if (existing) {
    state.chatContainer.removeChild(existing.component as never);
    reconcileChatBoundarySpacers(state.chatContainer);
  }

  const component = new PendingUserMessageComponent(text, images?.length ?? 0);
  state.pendingSignalMessageComponentsById.set(messageId, {
    component,
    text,
    images,
    isInterjection: options?.isInterjection,
  });
  state.chatContainer.addChild(component);
  reconcileChatBoundarySpacers(state.chatContainer);
  state.ui.requestRender();
}

export function confirmPendingUserMessage(state: TUIState, messageId: string, text: string): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  if (state.streamingComponent && state.session.displayState.get().isRunning) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }

  replacePendingUserMessage(state, messageId, text);
}

function replacePendingUserMessage(state: TUIState, messageId: string, text: string): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  const imageCount = pending.images?.length ?? 0;
  const prefix = imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}] ` : '';
  const label = getPendingUserMessageLabel(pending.isInterjection);
  const confirmed = new UserMessageComponent(prefix + text, getMarkdownTheme(), {
    ...(label ? { label } : {}),
  });
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

export function removeUserMessage(state: TUIState, messageId: string): void {
  const component = state.messageComponentsById.get(messageId);
  if (!component) return;
  state.chatContainer.removeChild(component as never);
  state.messageComponentsById.delete(messageId);
  reconcileChatBoundarySpacers(state.chatContainer);
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

    const label = getPendingUserMessageLabel(pending.isInterjection);
    const confirmed = new UserMessageComponent(text, getMarkdownTheme(), {
      ...(label ? { label } : {}),
    });
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

export function addUserMessage(state: TUIState, message: AgentControllerMessage, options?: { label?: string }): void {
  if (state.messageComponentsById.has(message.id)) {
    return;
  }

  const reminderPart = message.content.find(
    (content): content is Extract<AgentControllerMessageContent, { type: 'system_reminder' }> =>
      content.type === 'system_reminder',
  );

  if (reminderPart) {
    const goalMetadata = reminderPart as typeof reminderPart & {
      goalMaxTurns?: number;
      judgeModelId?: string;
      goalEvaluation?: GoalEvaluationPayload;
    };

    if (reminderPart.reminderType === 'goal-judge' && goalMetadata.goalEvaluation) {
      const judgeComponent = new JudgeDisplayComponent(
        null,
        goalMetadata.goalEvaluation.iteration,
        goalMetadata.goalEvaluation.maxRuns,
      );
      judgeComponent.setEvaluation(goalMetadata.goalEvaluation);
      addChildBeforeMessageOrFollowUps(state, judgeComponent, reminderPart.precedesMessageId);
      state.messageComponentsById.set(message.id, judgeComponent);
      state.ui.requestRender();
      return;
    }

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

  const stateSignalPart = message.content.find(content => (content as { type?: string }).type === 'state_signal') as
    | { type: 'state_signal'; stateId: string; mode: 'snapshot' | 'delta'; version?: number; message?: string }
    | undefined;

  // The `tasks` state signal is rendered by the pinned task list UI (replayed
  // from task tool history), so skip its raw <current-task-list> snapshot here.
  // The `goal` state signal is surfaced by the goal/judge UI, so likewise skip
  // its raw <current-objective> snapshot.
  if (
    stateSignalPart &&
    (stateSignalPart.stateId === TASKS_STATE_ID || stateSignalPart.stateId === GOAL_STATE_SIGNAL_ID)
  ) {
    return;
  }

  if (stateSignalPart) {
    const component = new StateSignalComponent({
      stateId: stateSignalPart.stateId,
      mode: stateSignalPart.mode,
      version: stateSignalPart.version,
      message: stateSignalPart.message,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return;
  }

  const reactiveSignalPart = message.content.find(
    content => (content as { type?: string }).type === 'reactive_signal',
  ) as { type: 'reactive_signal'; tagName: string; message?: string } | undefined;

  if (reactiveSignalPart) {
    if (!shouldRenderReactiveSignal(reactiveSignalPart.tagName)) return;
    const component = new ReactiveSignalComponent({
      tagName: reactiveSignalPart.tagName,
      message: reactiveSignalPart.message,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return;
  }

  const notificationPart = message.content.find(content => (content as { type?: string }).type === 'notification') as
    | {
        type: 'notification';
        message: string;
        source?: string;
        kind?: string;
        priority?: string;
        status?: string;
      }
    | undefined;

  if (notificationPart) {
    const component = new NotificationComponent({
      message: notificationPart.message,
      source: notificationPart.source,
      kind: notificationPart.kind,
      priority: notificationPart.priority,
      status: notificationPart.status,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return;
  }

  const notificationSummaryPart = message.content.find(
    content => (content as { type?: string }).type === 'notification_summary',
  ) as
    | {
        type: 'notification_summary';
        message: string;
        pending: number;
        bySource: Record<string, number>;
      }
    | undefined;

  if (notificationSummaryPart) {
    const component = new NotificationSummaryComponent({
      message: notificationSummaryPart.message,
      pending: notificationSummaryPart.pending,
      bySource: notificationSummaryPart.bySource,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return;
  }

  const textContent = message.content
    .filter(c => c.type === 'text')
    .map(c => (c as { type: 'text'; text: string }).text)
    .join('\n');

  const imageCount = message.content.filter(c => c.type === 'image').length;
  const fileCount = message.content.filter(c => c.type === 'file').length;

  // Strip [image] markers from text since we show count separately
  const displayText = imageCount > 0 ? textContent.replace(/\[image\]\s*/g, '').trim() : textContent.trim();
  const exactDisplayText = displayText.trim();

  const slashCommandMatch = exactDisplayText.match(/^<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>$/);
  if (slashCommandMatch) {
    const commandName = slashCommandMatch[1]!;
    const commandContent = slashCommandMatch[2]!.trim();
    const pending = state.pendingSignalMessageComponentsById.get(message.id);
    if (pending) {
      state.chatContainer.removeChild(pending.component as never);
      state.pendingSignalMessageComponentsById.delete(message.id);
      reconcileChatBoundarySpacers(state.chatContainer);
    }
    const existingSlashComp = state.allSlashCommandComponents.find(
      component =>
        component.matches(commandName, commandContent) && state.chatContainer.children.includes(component as never),
    );
    if (existingSlashComp) {
      state.messageComponentsById.set(message.id, existingSlashComp);
      state.ui.requestRender();
      return;
    }

    const slashComp = new SlashCommandComponent(commandName, commandContent);
    state.allSlashCommandComponents.push(slashComp);
    insertChatComponentWithBoundarySpacing(state.chatContainer, slashComp);
    state.ui.requestRender();
    return;
  }

  const skillMatch = exactDisplayText.match(/^<skill\s+name="([^"]*)">([\s\S]*?)<\/skill>$/);
  if (skillMatch) {
    const commandName = `skill/${skillMatch[1]!}`;
    const skillContent = unescapeSkillBoundary(skillMatch[2]!.trim());
    const pending = state.pendingSignalMessageComponentsById.get(message.id);
    if (pending) {
      state.chatContainer.removeChild(pending.component as never);
      state.pendingSignalMessageComponentsById.delete(message.id);
      reconcileChatBoundarySpacers(state.chatContainer);
    }
    const existingSkillComp = state.allSlashCommandComponents.find(
      component =>
        component.matches(commandName, skillContent) && state.chatContainer.children.includes(component as never),
    );
    if (existingSkillComp) {
      state.messageComponentsById.set(message.id, existingSkillComp);
      state.ui.requestRender();
      return;
    }

    const skillComp = new SlashCommandComponent(commandName, skillContent);
    state.allSlashCommandComponents.push(skillComp);
    insertChatComponentWithBoundarySpacing(state.chatContainer, skillComp);
    state.ui.requestRender();
    return;
  }

  if (state.pendingSignalMessageComponentsById.has(message.id)) {
    confirmPendingUserMessage(state, message.id, displayText);
    return;
  }

  if (confirmMatchingPendingUserMessage(state, message.id, displayText)) {
    return;
  }

  // Suppress subscription echo of locally-rendered queued messages (Ctrl+F queue).
  // drainQueuedAction already rendered the message with a local ID; the subscription
  // echoes it back with a different signal ID which would otherwise create a duplicate.
  const dedupKey = displayText.trim();
  const pendingEchoCounts = state.firedQueuedMessageTexts;
  const dedupCount = pendingEchoCounts?.get(dedupKey) ?? 0;
  if (dedupCount > 0) {
    if (dedupCount === 1) pendingEchoCounts!.delete(dedupKey);
    else pendingEchoCounts!.set(dedupKey, dedupCount - 1);
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

  const attachmentLabels = [
    imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}]` : '',
    fileCount > 0 ? `[${fileCount} file${fileCount > 1 ? 's' : ''}]` : '',
  ].filter(Boolean);
  const prefix = attachmentLabels.length > 0 ? `${attachmentLabels.join(' ')} ` : '';
  if (displayText || prefix) {
    const label = getUserMessageLabel(message, options?.label);
    const userComponent = new UserMessageComponent(prefix + displayText, getMarkdownTheme(), {
      ...(label ? { label } : {}),
    });

    state.messageComponentsById.set(message.id, userComponent);

    if (state.streamingComponent && state.session.displayState.get().isRunning) {
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

const STARTUP_MESSAGE_WINDOW_SIZE = 200;

function getLatestMessageTimestamp(messages: AgentControllerMessage[]): number | undefined {
  let latest: number | undefined;
  for (const message of messages) {
    const time = new Date(message.createdAt).getTime();
    if (Number.isNaN(time)) continue;
    latest = latest === undefined ? time : Math.max(latest, time);
  }
  return latest;
}

/**
 * Re-render all existing messages from the controller thread into the chat container.
 * Called on thread switch and initial load.
 */
export async function renderExistingMessages(state: TUIState): Promise<void> {
  const messages = await state.session.thread.listActiveMessages({ limit: STARTUP_MESSAGE_WINDOW_SIZE });
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
      let accumulatedContent: AgentControllerMessageContent[] = [];

      for (const content of message.content) {
        if (content.type === 'text' || content.type === 'thinking') {
          accumulatedContent.push(content);
        } else if (content.type === 'tool_call') {
          // Render accumulated text first if any
          if (accumulatedContent.length > 0) {
            const textMessage: AgentControllerMessage = {
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
            const currentModelId = state.session.model.get() || undefined;
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

          const pluginRenderConfig = state.pluginManager?.getToolRenderConfig(content.name);
          if (pluginRenderConfig?.type === 'subagent') {
            const rawResult = toolResult?.type === 'tool_result' ? formatToolResult(toolResult.result) : undefined;
            const isErr = toolResult?.type === 'tool_result' && toolResult.isError;
            const subComponent = new SubagentExecutionComponent(
              pluginRenderConfig.agentType ?? 'plugin',
              getTaskFromToolArgs(content.args, content.name),
              state.ui,
              pluginRenderConfig.modelId,
              {
                collapseOnComplete: false,
                expandOnComplete: state.quietMode,
                forked: pluginRenderConfig.forked,
                label: pluginRenderConfig.label,
                maxActivityLines: pluginRenderConfig.maxActivityLines,
                collapsedLines: pluginRenderConfig.collapsedLines,
                colors: pluginRenderConfig.colors,
                icons: pluginRenderConfig.icons,
              },
            );
            subComponent.finish(isErr ?? false, 0, rawResult);
            insertChatComponentWithBoundarySpacing(state.chatContainer, subComponent);
            state.allToolComponents.push(subComponent as any);
            continue;
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
            const args = content.args as { path?: string } | undefined;
            // Result could be a string or an object with content property
            let resultText = '';
            let submittedPlan: { title?: string; path?: string; plan?: string } | undefined;
            if (typeof toolResult.result === 'string') {
              resultText = toolResult.result;
            } else if (typeof toolResult.result === 'object' && toolResult.result !== null) {
              if ('content' in toolResult.result && typeof (toolResult.result as any).content === 'string') {
                resultText = (toolResult.result as any).content;
              }
              if (
                'submittedPlan' in toolResult.result &&
                typeof (toolResult.result as any).submittedPlan === 'object'
              ) {
                submittedPlan = (toolResult.result as any).submittedPlan;
              }
            }
            // The approved result starts with "Plan approved." while rejected
            // results start with "Plan was not approved" — a naive `includes`
            // would match both since "not approved" still contains "approved".
            const isApproved = resultText.startsWith('Plan approved');
            // Extract feedback if rejected with inline feedback
            let feedback: string | undefined;
            if (!isApproved && resultText.includes('not approved')) {
              const feedbackMatch = resultText.match(/User feedback:\s*(.+?)(?:\n|$)/);
              // Use extracted feedback or a generic marker so PlanResultComponent
              // renders "Changes requested" (it checks truthiness of feedback).
              feedback = feedbackMatch?.[1] || 'Revision requested';
            }

            const submittedPath = submittedPlan?.path || args?.path;
            if (submittedPath) {
              // Prefer the submitted plan snapshot persisted in the tool result.
              // Older history entries may not have it, so fall back to reading the
              // submitted file from disk.
              const sessionState = state.session.state.get() as any;
              const projectPath = sessionState?.projectPath as string | undefined;
              const recoverAbsPath = !submittedPlan?.plan
                ? resolvePlanPath(projectPath ?? process.cwd(), submittedPath)
                : undefined;
              const recovered = recoverAbsPath ? await readPlanFile(recoverAbsPath) : undefined;
              const planBody = submittedPlan?.plan ?? recovered?.plan ?? '';
              const planTitle = submittedPlan?.title || recovered?.title || 'Implementation Plan';
              const planResult = new PlanResultComponent({
                title: planTitle,
                plan: planBody,
                planFilename: submittedPath,
                isApproved,
                feedback,
              });
              state.chatContainer.addChild(planResult);
              replacedWithInline = true;
              // Restore previousPlanSnapshot (keyed by submitted path) so that if the
              // agent resubmits after a restart, the diff can be computed against
              // the last submitted plan body, not whatever the mutable file now contains.
              state.previousPlanSnapshot = { path: submittedPath, plan: planBody };
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
            const textMessage: AgentControllerMessage = {
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
        const textMessage: AgentControllerMessage = {
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
    const currentTasks = (state.session.state.get() as { tasks?: TaskItemSnapshot[] } | undefined)?.tasks;
    if (!areTasksEqual(currentTasks, previousTasksAcc)) {
      try {
        await state.session.state.set({ tasks: previousTasksAcc });
      } catch {
        // Custom controller state schemas may not accept TUI replayed task state.
        // Keep the reconstructed task list local to display state in that case.
      }
    }
    state.session.displayState.restoreTasks(previousTasksAcc);
  }

  reconcileChatBoundarySpacers(state.chatContainer);
  state.ui.requestRender();
}

function unescapeSystemReminderText(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
}
