/**
 * Display helpers for the TUI: error messages, info messages, notifications.
 */
import { Container, Text } from '@earendil-works/pi-tui';

import { parseError } from '@mastra/code-sdk/utils/errors';
import { insertChatComponentWithBoundarySpacing } from './chat-boundary-reconciliation.js';
import type { ChatSpacingKind } from './components/chat-spacing.js';
import type { NotificationMode, NotificationReason } from './notify.js';
import { sendNotification } from './notify.js';
import type { TUIState } from './state.js';
import { theme } from './theme.js';

class InfoMessageComponent extends Container {
  constructor(lines: Text[]) {
    super();
    for (const line of lines) {
      this.addChild(line);
    }
  }

  getChatSpacingKind(): ChatSpacingKind {
    return 'system';
  }
}

export function showError(state: TUIState, message: string): void {
  const component = new InfoMessageComponent([new Text(theme.fg('error', `Error: ${message}`), 1, 0)]);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component);
  state.ui.requestRender();
}

export function showInfo(state: TUIState, message: string): void {
  const component = new InfoMessageComponent([new Text(theme.fg('muted', message), 1, 0)]);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component);
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
        retryAttempt?: number;
        maxRetries?: number;
      }
    | Error,
): void {
  const error = 'error' in event ? event.error : event;
  const parsed = parseError(error);

  // Show the main error message
  let errorText = `Error: ${parsed.message}`;
  if (parsed.detail && parsed.detail !== parsed.message) {
    errorText += theme.fg('muted', ` (${parsed.detail})`);
  }
  if (parsed.requestUrl) {
    errorText += theme.fg('muted', ` [url: ${parsed.requestUrl}]`);
  }

  // Add retry info if applicable
  const retryable = 'retryable' in event ? event.retryable : parsed.retryable;
  const retryDelay = 'retryDelay' in event ? event.retryDelay : parsed.retryDelay;
  if (retryable && retryDelay) {
    const seconds = retryDelay / 1000;
    const retryAttempt = 'retryAttempt' in event ? event.retryAttempt : undefined;
    const maxRetries = 'maxRetries' in event ? event.maxRetries : undefined;
    const retryProgress = retryAttempt && maxRetries ? ` ${retryAttempt}/${maxRetries}` : '';
    errorText += theme.fg('muted', ` (retry${retryProgress} in ${seconds}s)`);
  }

  const lines: Text[] = [new Text(theme.fg('error', errorText), 1, 0)];

  // Add helpful hints based on error type
  const hint = getErrorHint(parsed.type);
  if (hint) {
    lines.push(new Text(theme.fg('muted', `  Hint: ${hint}`), 1, 0));
  }

  const component = new InfoMessageComponent(lines);
  insertChatComponentWithBoundarySpacing(state.chatContainer, component);
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
  const mode = ((state.session.state.get() as any)?.notifications ?? 'off') as NotificationMode;
  sendNotification(reason, {
    mode,
    message,
    hookManager: state.hookManager,
  });
}
