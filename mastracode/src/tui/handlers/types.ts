/**
 * Shared context passed to extracted event handlers.
 * Keeps handlers decoupled from the MastraTUI class.
 */
import type { Component } from '@mariozechner/pi-tui';
import type { HarnessMessage, TaskItem } from '@mastra/core/harness';

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
  resetStatusLineState: () => void;
  notify: (reason: NotificationReason, message?: string) => void;
  handleSlashCommand: (input: string) => Promise<boolean>;
  addUserMessage: (message: HarnessMessage) => void;
  addChildBeforeFollowUps: (child: Component) => void;
  fireMessage: (content: string, images?: Array<{ data: string; mimeType: string }>) => void;
  renderExistingMessages: () => Promise<void>;
  syncOMThresholdsFromHarness: () => void;
  renderCompletedTasksInline: (tasks: TaskItem[], insertIndex?: number, collapsed?: boolean) => void;
  renderClearedTasksInline: (clearedTasks: TaskItem[], insertIndex?: number) => void;
  refreshModelAuthStatus: () => Promise<void>;
}
