/**
 * Shared context passed to extracted event handlers.
 * Keeps handlers decoupled from the MastraTUI class.
 */
import type { Component } from '@earendil-works/pi-tui';
import type { HarnessMessage, TaskItemSnapshot } from '@mastra/core/harness';

import type { MastraCodeAnalytics } from '../../analytics';
import type { StartGoalOptions } from '../commands/goal';
import type { NotificationReason } from '../notify';
import type { TUIState } from '../state';

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
  addUserMessage: (message: HarnessMessage) => void;
  addChildBeforeFollowUps: (child: Component) => void;
  fireMessage: (content: string, images?: Array<{ data: string; mimeType: string }>) => void;
  startGoal: (objective: string, cancelMessage?: string, options?: StartGoalOptions) => Promise<void>;
  queueFollowUpMessage: (content: string) => void;
  renderExistingMessages: () => Promise<void>;
  renderClearedTasksInline: (clearedTasks: TaskItemSnapshot[], insertIndex?: number) => void;
  refreshModelAuthStatus: () => Promise<void>;
}
