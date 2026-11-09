import { isSessionStartupCancelledError } from '@mastra/core/agent-controller';
import { showError, showInfo } from './display.js';
import type { TUIState } from './state.js';

export function showSessionError(state: TUIState, error: unknown): void {
  if (isSessionStartupCancelledError(error)) {
    showInfo(state, 'Interrupted');
    return;
  }
  showError(state, error instanceof Error ? error.message : 'Unknown error');
}
