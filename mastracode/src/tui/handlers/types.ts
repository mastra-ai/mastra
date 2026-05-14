/**
 * Shared context passed to extracted event handlers.
 * Keeps handlers decoupled from the MastraTUI class.
 */
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessMessage, TaskItemSnapshot } from '@mastra/core/harness';

import type { StartGoalOptions } from '../commands/goal.js';
import type { NotificationReason } from '../notify.js';
import type { TUIState } from '../state.js';

export interface EventHandlerContext {
  state: TUIState;
  showInfo: (message: string) => void;
  showError: (message: string) => void;
  showFormattedError: (
    event: { error: Error; errorType?: string; retryable?: boolean; retryDelay?: number } | Error,
  ) => void;
  updateStatusLine: () => void;
  notify: (reason: NotificationReason, message?: string) => void;
  handleSlashCommand: (input: string) => Promise<boolean>;
  addUserMessage: (message: HarnessMessage) => void;
  addChildBeforeFollowUps: (child: Component) => void;
  fireMessage: (content: string, images?: Array<{ data: string; mimeType: string }>) => void;
  startGoal: (objective: string, cancelMessage?: string, options?: StartGoalOptions) => Promise<void>;
  queueFollowUpMessage: (content: string) => void;
  renderExistingMessages: () => Promise<void>;
  renderCompletedTasksInline: (tasks: TaskItemSnapshot[], insertIndex?: number, collapsed?: boolean) => void;
  renderClearedTasksInline: (clearedTasks: TaskItemSnapshot[], insertIndex?: number) => void;
  refreshModelAuthStatus: () => Promise<void>;
}
