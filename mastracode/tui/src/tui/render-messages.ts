/**
 * Message rendering helpers extracted from MastraTUI.
 *
 * Pure functions that operate on TUIState — no class dependency.
 */
import { Container, Text } from '@earendil-works/pi-tui';
import type { Component } from '@earendil-works/pi-tui';
import { readPlanFile, resolvePlanPath } from '@mastra/code-sdk/utils/plans';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { parseSubagentMeta } from '@mastra/core/agent-controller';
import type { TaskItemInput, TaskItemSnapshot } from '@mastra/core/signals';
import { assignTaskIds } from '@mastra/core/signals';
import type { GoalEvaluationPayload } from '@mastra/core/stream';
import { TASKS_STATE_ID } from '@mastra/core/tools';
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
import {
  getAssistantRenderParts,
  getBackgroundWorkLifecycleView,
  getMessageText,
  getNotificationSummaryView,
  getNotificationView,
  getReactiveSignalView,
  getReminderView,
  getSignalKind,
  getStateSignalView,
  getUserSignalView,
  isSignalMessage,
} from './db-message-parts.js';
import type { AssistantRenderPart } from './db-message-parts.js';
import { formatToolResult, isBackgroundToolPlaceholder, isTaskMutationTool } from './handlers/tool.js';
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

function getUserMessageLabel(message: MastraDBMessage, fallbackLabel?: string): string | undefined {
  const signalAttributes = (message.content?.metadata?.signal as { attributes?: Record<string, unknown> } | undefined)
    ?.attributes;
  if (signalAttributes?.delivery === 'while-active') return WHILE_ACTIVE_USER_MESSAGE_LABEL;
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

export function confirmPendingUserMessage(
  state: TUIState,
  messageId: string,
  text: string,
  attachments?: { imageCount: number; fileCount: number },
): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  if (state.streamingComponent && state.session.displayState.get().isRunning) {
    state.streamingComponent = undefined;
    state.streamingMessage = undefined;
  }

  replacePendingUserMessage(state, messageId, text, attachments);
}

function replacePendingUserMessage(
  state: TUIState,
  messageId: string,
  text: string,
  attachments?: { imageCount: number; fileCount: number },
): void {
  const pending = state.pendingSignalMessageComponentsById.get(messageId);
  if (!pending) return;

  const prefix = formatAttachmentPrefix(
    attachments?.imageCount ?? pending.images?.length ?? 0,
    attachments?.fileCount ?? 0,
  );
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

function confirmMatchingPendingUserMessage(
  state: TUIState,
  messageId: string,
  text: string,
  attachments: { imageCount: number; fileCount: number },
): boolean {
  const normalizedText = text.trim();
  for (const [pendingId, pending] of state.pendingSignalMessageComponentsById) {
    if (pending.text.trim() !== normalizedText) continue;

    const label = getPendingUserMessageLabel(pending.isInterjection);
    const confirmed = new UserMessageComponent(
      formatAttachmentPrefix(attachments.imageCount, attachments.fileCount) + text,
      getMarkdownTheme(),
      {
        ...(label ? { label } : {}),
      },
    );
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

function getUserContentParts(
  message: MastraDBMessage,
): Array<{ type?: string; mimeType?: string; mediaType?: string }> {
  const content = message.content;
  if (typeof content === 'string' || !content?.parts) return [];
  return content.parts as Array<{ type?: string; mimeType?: string; mediaType?: string }>;
}

/**
 * DB-native user attachments are persisted as `file` parts; images are `file`
 * parts whose media type is `image/*`. Distinguish them so the TUI can show
 * separate image and file counts.
 */
function isImagePart(part: { type?: string; mimeType?: string; mediaType?: string }): boolean {
  if (part.type === 'image') return true;
  if (part.type !== 'file') return false;
  const media = part.mediaType ?? part.mimeType ?? '';
  return media.startsWith('image/');
}

function formatAttachmentPrefix(imageCount: number, fileCount: number): string {
  const labels = [
    imageCount > 0 ? `[${imageCount} image${imageCount > 1 ? 's' : ''}]` : '',
    fileCount > 0 ? `[${fileCount} file${fileCount > 1 ? 's' : ''}]` : '',
  ].filter(Boolean);
  return labels.length > 0 ? `${labels.join(' ')} ` : '';
}

/**
 * Render a `role: 'signal'` message into its dedicated TUI component (reminder,
 * judge, state, reactive, notification, notification-summary). Returns true when
 * the signal was fully handled; returns false for `user`-kind signals so the
 * caller renders it through the shared user-message component path.
 */
export function renderSignalMessage(state: TUIState, message: MastraDBMessage): boolean {
  const kind = getSignalKind(message);

  if (kind === 'reminder') {
    const reminder = getReminderView(message);

    if (reminder.reminderType === 'goal-judge') {
      // Goal-judge reminders with an evaluation payload render the judge result.
      // Bare goal-judge continuation reminders ("[Goal attempt N/M] Continue…")
      // are suppressed because the goal/judge UI already surfaces that state.
      if (reminder.goalEvaluation) {
        const goalEvaluation = reminder.goalEvaluation as GoalEvaluationPayload;
        const judgeComponent = new JudgeDisplayComponent(null, goalEvaluation.iteration, goalEvaluation.maxRuns);
        judgeComponent.setEvaluation(goalEvaluation);
        addChildBeforeMessageOrFollowUps(state, judgeComponent, reminder.precedesMessageId);
        state.messageComponentsById.set(message.id, judgeComponent);
        state.ui.requestRender();
      }
      return true;
    }

    const reminderComponent = createReminderComponent(reminder.reminderType, {
      message: reminder.message,
      path: reminder.path,
      gapText: reminder.gapText,
      goalMaxTurns: reminder.goalMaxTurns,
      judgeModelId: reminder.judgeModelId,
    });
    reminderComponent.setExpanded(state.toolOutputExpanded);
    state.allSystemReminderComponents.push(reminderComponent);

    // If the reminder anchors before a user message that has not been rendered
    // yet (its id is not mapped), fall back to inserting it before the latest
    // rendered user message so temporal-gap markers stay above the run they
    // precede.
    if (reminder.precedesMessageId && !state.messageComponentsById.has(reminder.precedesMessageId)) {
      const latestUserComponent = [...state.chatContainer.children]
        .reverse()
        .find(child => child instanceof UserMessageComponent);
      if (latestUserComponent) {
        const idx = state.chatContainer.children.indexOf(latestUserComponent as never);
        if (idx >= 0) {
          insertChatComponentWithBoundarySpacing(state.chatContainer, reminderComponent, idx);
          state.ui.requestRender();
          return true;
        }
      }
    }

    if (!reminder.precedesMessageId && state.streamingComponent) {
      const idx = state.chatContainer.children.indexOf(state.streamingComponent as never);
      if (idx >= 0) {
        insertChatComponentWithBoundarySpacing(state.chatContainer, reminderComponent, idx);
        state.ui.requestRender();
        return true;
      }
    }

    addChildBeforeMessageOrFollowUps(state, reminderComponent, reminder.precedesMessageId);
    state.ui.requestRender();
    return true;
  }

  if (kind === 'state') {
    const stateSignal = getStateSignalView(message);

    // The `tasks` state signal is rendered by the pinned task list UI (replayed
    // from task tool history), so skip its raw <current-task-list> snapshot here.
    // The `goal` state signal is surfaced by the goal/judge UI, so likewise skip
    // its raw <current-objective> snapshot.
    if (stateSignal.stateId === TASKS_STATE_ID || stateSignal.stateId === GOAL_STATE_SIGNAL_ID) {
      return true;
    }

    const component = new StateSignalComponent({
      stateId: stateSignal.stateId,
      mode: stateSignal.mode,
      version: stateSignal.version,
      message: stateSignal.message,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return true;
  }

  if (kind === 'reactive') {
    const reactive = getReactiveSignalView(message);
    if (!reactive.tagName || !shouldRenderReactiveSignal(reactive.tagName)) return true;
    const component = new ReactiveSignalComponent({
      tagName: reactive.tagName,
      message: reactive.message,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return true;
  }

  if (kind === 'notification') {
    const backgroundWork = getBackgroundWorkLifecycleView(message);
    if (backgroundWork) {
      const component = state.pendingTools.get(backgroundWork.originToolCallId);
      if (backgroundWork.taskId) component?.setBackgroundTaskId?.(backgroundWork.taskId);
      if (component && (backgroundWork.tagName === 'work-completed' || backgroundWork.tagName === 'work-failed')) {
        const status =
          backgroundWork.tagName === 'work-completed'
            ? 'Completed in background; reconciling result…'
            : 'Background execution failed; reconciling error…';
        component.updateResult({ content: [{ type: 'text', text: status }], isError: false }, true);
        state.ui.requestRender();
      }
      return true;
    }

    const notification = getNotificationView(message);
    const component = new NotificationComponent({
      message: notification.message,
      source: notification.source,
      kind: notification.kind,
      priority: notification.priority,
      status: notification.status,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return true;
  }

  if (kind === 'notification-summary') {
    const summary = getNotificationSummaryView(message);
    const component = new NotificationSummaryComponent({
      message: summary.message,
      pending: summary.pending,
      bySource: summary.bySource,
    });
    addChildBeforeFollowUps(state, component);
    state.messageComponentsById.set(message.id, component);
    state.ui.requestRender();
    return true;
  }

  // kind === 'user': fall through to shared user-message text rendering.
  return false;
}

function isPersistedBackgroundCompletionDirective(message: MastraDBMessage): boolean {
  if (message.role !== 'user' && message.role !== 'signal') return false;
  const text = isSignalMessage(message) ? getUserSignalView(message).message : getMessageText(message);
  return /^IMPORTANT: The following tool-call IDs (?:completed successfully|failed|were cancelled by the user before completion|are suspended):/.test(
    text.trim(),
  );
}

export function addUserMessage(state: TUIState, message: MastraDBMessage, options?: { label?: string }): void {
  if (state.messageComponentsById.has(message.id) || isPersistedBackgroundCompletionDirective(message)) {
    return;
  }

  let textContent: string;
  let imageCount: number;
  let fileCount: number;
  if (isSignalMessage(message)) {
    if (renderSignalMessage(state, message)) return;
    const userSignal = getUserSignalView(message);
    textContent = userSignal.message;
    imageCount = userSignal.imageCount;
    fileCount = userSignal.fileCount;
  } else {
    const parts = getUserContentParts(message);
    textContent = getMessageText(message);
    imageCount = parts.filter(part => isImagePart(part)).length;
    fileCount = parts.filter(part => part.type === 'file' && !isImagePart(part)).length;
  }

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

  const attachments = { imageCount, fileCount };
  if (state.pendingSignalMessageComponentsById.has(message.id)) {
    confirmPendingUserMessage(state, message.id, displayText, attachments);
    return;
  }

  if (confirmMatchingPendingUserMessage(state, message.id, displayText, attachments)) {
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

  const prefix = formatAttachmentPrefix(imageCount, fileCount);
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

/**
 * Build a partial assistant `MastraDBMessage` carrying only the accumulated
 * text/thinking render parts, so the interleaving history replay can flush a
 * standalone `AssistantMessageComponent` before each tool/OM boundary.
 *
 * Terminal metadata (`stopReason`/`errorMessage`) is stripped from all but the
 * final slice so an aborted/errored message shows its terminal line once at
 * the end instead of after every accumulated text slice.
 */
function buildAssistantSlice(
  message: MastraDBMessage,
  parts: Array<Extract<AssistantRenderPart, { kind: 'text' | 'thinking' }>>,
  options?: { includeTerminalMetadata?: boolean },
): MastraDBMessage {
  const sliceParts = parts.map(part =>
    part.kind === 'thinking'
      ? { type: 'reasoning' as const, reasoning: part.text }
      : { type: 'text' as const, text: part.text },
  );
  const baseContent = typeof message.content === 'string' ? { format: 2 } : message.content;
  let metadata = (baseContent as { metadata?: Record<string, unknown> }).metadata;
  if (!options?.includeTerminalMetadata && metadata) {
    const { stopReason: _stopReason, errorMessage: _errorMessage, ...rest } = metadata;
    metadata = rest;
  }
  return {
    ...message,
    content: {
      ...baseContent,
      format: 2,
      parts: sliceParts as MastraDBMessage['content']['parts'],
      ...(metadata !== undefined ? { metadata } : {}),
    },
  } as MastraDBMessage;
}

/** Whether a message carries terminal metadata that renders a trailing abort/error line. */
function hasTerminalMetadata(message: MastraDBMessage): boolean {
  if (typeof message.content === 'string') return false;
  const stopReason = (message.content.metadata as { stopReason?: string } | undefined)?.stopReason;
  return stopReason === 'aborted' || stopReason === 'error';
}

function getLatestMessageTimestamp(messages: MastraDBMessage[]): number | undefined {
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
    if (message.role === 'user' || message.role === 'signal') {
      addUserMessage(state, message);
    } else if (message.role === 'assistant') {
      // Render content in order - interleaving text and tool calls
      // Accumulate text/thinking until we hit a tool call, then render both
      let accumulatedParts: Array<Extract<AssistantRenderPart, { kind: 'text' | 'thinking' }>> = [];

      const flushAccumulated = (isFinal = false): void => {
        // The final flush still renders when there is no trailing text but the
        // message carries terminal metadata, so the abort/error line shows once.
        if (accumulatedParts.length === 0 && !(isFinal && hasTerminalMetadata(message))) return;
        const textMessage = buildAssistantSlice(message, accumulatedParts, { includeTerminalMetadata: isFinal });
        const textComponent = new AssistantMessageComponent(textMessage, state.hideThinkingBlock, getMarkdownTheme());
        state.chatContainer.addChild(textComponent);
        accumulatedParts = [];
      };

      for (const part of getAssistantRenderParts(message)) {
        if (part.kind === 'text' || part.kind === 'thinking') {
          accumulatedParts.push(part);
        } else if (part.kind === 'tool') {
          // Render accumulated text first if any
          flushAccumulated();

          const toolName = part.toolName;
          const toolArgs = part.args;
          const hasResult = part.hasResult;
          const resultValue = part.result;
          const resultIsError = part.isError;
          const isBackgroundPlaceholder = hasResult && !resultIsError && isBackgroundToolPlaceholder(resultValue);

          // Render subagent tool calls with dedicated component
          if (toolName === 'subagent') {
            const subArgs = toolArgs as
              | {
                  agentType?: string;
                  task?: string;
                  modelId?: string;
                  forked?: boolean;
                }
              | undefined;
            const rawResult = hasResult ? formatToolResult(resultValue) : undefined;
            const isErr = hasResult && resultIsError;

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
          if (toolName === 'ask_user' && hasResult) {
            const askArgs = toolArgs as
              { question?: string; options?: Array<{ label: string; description?: string }> } | undefined;
            const answer = typeof resultValue === 'string' ? resultValue : formatToolResult(resultValue);
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

          const pluginRenderConfig = state.pluginManager?.getToolRenderConfig(toolName);
          if (pluginRenderConfig?.type === 'subagent') {
            const rawResult = hasResult ? formatToolResult(resultValue) : undefined;
            const isErr = hasResult && resultIsError;
            const subComponent = new SubagentExecutionComponent(
              pluginRenderConfig.agentType ?? 'plugin',
              getTaskFromToolArgs(toolArgs, toolName),
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
            toolName,
            toolArgs,
            {
              showImages: false,
              collapsedByDefault: !state.toolOutputExpanded,
            },
            state.ui,
          );

          if (hasResult) {
            toolComponent.updateResult(
              {
                content: [
                  {
                    type: 'text',
                    text: isBackgroundPlaceholder ? 'Running in background…' : formatToolResult(resultValue),
                  },
                ],
                isError: resultIsError,
              },
              isBackgroundPlaceholder,
            );
          }

          if (isBackgroundPlaceholder) {
            state.pendingTools.set(part.toolCallId, toolComponent);
          }

          // Successful task transition tools render through the pinned task UI,
          // not as regular tool result boxes.
          let replacedWithInline = false;
          if (isTaskMutationTool(toolName) && hasResult && !resultIsError) {
            hasReplayedTaskState = true;
            const nextTasks = applyTaskToolResult(previousTasksAcc, toolName, toolArgs, resultValue, resultIsError);
            const transition = renderTaskTransitionFromHistory(state, previousTasksAcc, nextTasks);
            previousTasksAcc = transition.tasks;
            replacedWithInline = transition.replacedWithInline;
          }

          if (toolName === 'task_check' && hasResult && !resultIsError) {
            const resultTasks = getTaskResultTasks(resultValue);
            if (resultTasks) {
              hasReplayedTaskState = true;
              previousTasksAcc = assignTaskIds(resultTasks, previousTasksAcc);
            }
          }

          // If this was submit_plan, show the plan with approval status
          if (toolName === 'submit_plan' && hasResult) {
            const args = toolArgs as { path?: string } | undefined;
            // Result could be a string or an object with content property
            let resultText = '';
            let submittedPlan: { title?: string; path?: string; plan?: string } | undefined;
            if (typeof resultValue === 'string') {
              resultText = resultValue;
            } else if (typeof resultValue === 'object' && resultValue !== null) {
              if ('content' in resultValue && typeof (resultValue as any).content === 'string') {
                resultText = (resultValue as any).content;
              }
              if ('submittedPlan' in resultValue && typeof (resultValue as any).submittedPlan === 'object') {
                submittedPlan = (resultValue as any).submittedPlan;
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
        } else if (part.kind === 'om') {
          // Skip start markers in history — only show completed/failed results
          if (part.event === 'start') continue;

          // Render accumulated text first if any
          flushAccumulated();

          const omData = part.data as Record<string, any>;

          if (part.event === 'end') {
            // Render bordered output box with marker info in footer
            const isReflection = part.operationType === 'reflection';
            const outputComponent = new OMOutputComponent({
              type: isReflection ? 'reflection' : 'observation',
              observations: omData.observations ?? '',
              currentTask: omData.currentTask,
              suggestedResponse: omData.suggestedResponse,
              durationMs: omData.durationMs,
              tokensObserved: omData.tokensObserved,
              observationTokens: omData.observationTokens,
              compressedTokens: isReflection ? omData.observationTokens : undefined,
            });
            state.chatContainer.addChild(outputComponent);
          } else if (part.event === 'failed') {
            // Failed marker
            state.chatContainer.addChild(
              new OMMarkerComponent({
                type: 'om_observation_failed',
                error: typeof omData.error === 'string' ? omData.error : 'observation failed',
                tokensAttempted: typeof omData.tokensAttempted === 'number' ? omData.tokensAttempted : undefined,
                operationType: omData.operationType,
              }),
            );
          } else if (part.event === 'thread-title') {
            if (state.quietMode) continue;
            // Render thread title update marker in history
            state.chatContainer.addChild(
              new OMMarkerComponent({
                type: 'om_thread_title_updated',
                newTitle: omData.newTitle,
                oldTitle: omData.oldTitle,
              }),
            );
          }
        }
        // Skip tool result parts - they are folded into the tool-invocation part above
      }

      // Render any remaining text after the last tool call
      flushAccumulated(true);
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
