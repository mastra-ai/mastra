/**
 * Display helpers for the TUI: error messages, info messages, notifications.
 */
import { Spacer, Text } from '@mariozechner/pi-tui';

import { parseError } from '../utils/errors.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import { sendNotification } from './notify.js';
import type { TUIState } from './state.js';
import { theme } from './theme.js';

export function showError(state: TUIState, message: string): void {
  state.chatContainer.addChild(new Spacer(1));
  state.chatContainer.addChild(new Text(theme.fg('error', `Error: ${message}`), 1, 0));
  state.ui.requestRender();
}

export function showInfo(state: TUIState, message: string): void {
  state.chatContainer.addChild(new Spacer(1));
  state.chatContainer.addChild(new Text(theme.fg('muted', message), 1, 0));
  state.ui.requestRender();
}

export function showFormattedError(
  state: TUIState,
  event:
    | {
        error: Error;
        errorType?: string;
        retryable?: boolean;
        retryDelay?: number;
      }
    | Error,
): void {
  const error = 'error' in event ? event.error : event;
  const parsed = parseError(error);

  state.chatContainer.addChild(new Spacer(1));

  // Check if this is a tool validation error
  const errorMessage = error.message || String(error);
  const isValidationError =
    errorMessage.toLowerCase().includes('validation failed') ||
    errorMessage.toLowerCase().includes('required parameter') ||
    errorMessage.includes('Required');

  if (isValidationError) {
    // Show a simplified message for validation errors
    state.chatContainer.addChild(new Text(theme.fg('error', 'Tool validation error - see details above'), 1, 0));
    state.chatContainer.addChild(
      new Text(theme.fg('muted', '  Check the tool execution box for specific parameter requirements'), 1, 0),
    );
  } else {
    // Show the main error message
    let errorText = `Error: ${parsed.message}`;

    // Add retry info if applicable
    const retryable = 'retryable' in event ? event.retryable : parsed.retryable;
    const retryDelay = 'retryDelay' in event ? event.retryDelay : parsed.retryDelay;
    if (retryable && retryDelay) {
      const seconds = Math.ceil(retryDelay / 1000);
      errorText += theme.fg('muted', ` (retry in ${seconds}s)`);
    }

    state.chatContainer.addChild(new Text(theme.fg('error', errorText), 1, 0));

    // Add helpful hints based on error type
    const hint = getErrorHint(parsed.type);
    if (hint) {
      state.chatContainer.addChild(new Text(theme.fg('muted', `  Hint: ${hint}`), 1, 0));
    }
  }

  state.ui.requestRender();
}

function getErrorHint(errorType: string): string | null {
  switch (errorType) {
    case 'auth':
      return 'Use /login to authenticate with a provider';
    case 'model_not_found':
      return 'Use /models to select a different model';
    case 'context_length':
      return 'Use /new to start a fresh conversation';
    case 'rate_limit':
      return 'Wait a moment and try again';
    case 'network':
      return 'Check your internet connection';
    default:
      return null;
  }
}

export function notify(state: TUIState, reason: NotificationReason, message?: string): void {
  const mode = ((state.harness.getState() as any)?.notifications ?? 'off') as NotificationMode;
  sendNotification(reason, {
    mode,
    message,
    hookManager: state.hookManager,
  });
}
