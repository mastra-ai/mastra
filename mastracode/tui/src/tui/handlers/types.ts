/**
 * Shared context passed to extracted event handlers.
 * Keeps handlers decoupled from the MastraTUI class.
 */
import type { Component } from '@earendil-works/pi-tui';
import type { MastraCodeAnalytics } from '@mastra/code-sdk/analytics';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import type { TaskItemSnapshot } from '@mastra/core/signals';

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
  analytics?: MastraCodeAnalytics;
  handleSlashCommand: (input: string) => Promise<boolean>;
  addUserMessage: (message: MastraDBMessage) => void;
  addChildBeforeFollowUps: (child: Component) => void;
  fireMessage: (content: string, images?: Array<{ data: string; mimeType: string }>) => void;
  startGoal: (objective: string, cancelMessage?: string, options?: StartGoalOptions) => Promise<void>;
  queueFollowUpMessage: (content: string) => void;
  renderExistingMessages: () => Promise<void>;
  renderClearedTasksInline: (clearedTasks: TaskItemSnapshot[], insertIndex?: number) => void;
  renderCompletedTasksInline: (completedTasks: TaskItemSnapshot[], insertIndex?: number) => void;
  renderTaskDeltaInline: (
    previousTasks: TaskItemSnapshot[],
    nextTasks: TaskItemSnapshot[],
    insertIndex?: number,
  ) => boolean;
  refreshModelAuthStatus: () => Promise<void>;
}
