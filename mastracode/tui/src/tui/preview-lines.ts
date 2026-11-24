import { reconcileChatBoundarySpacers } from './chat-boundary-reconciliation.js';
import { NotificationComponent } from './components/notification.js';
import type { TUIState } from './state.js';

/**
 * Pushes a new preview line limit into every already-rendered tool and notification
 * so a `/settings` change applies without re-rendering the conversation. It never
 * changes a component's display mode.
 */
export function applyPreviewLinesToRenderedComponents(
  state: Pick<TUIState, 'allToolComponents'> & Partial<Pick<TUIState, 'messageComponentsById' | 'chatContainer'>>,
  previewLineLimit: number,
  modeColor: string | undefined,
): void {
  for (const tool of state.allToolComponents) {
    tool.setCompactToolModeColor?.(modeColor);
    tool.setPreviewLineLimit?.(previewLineLimit);
  }
  for (const component of state.messageComponentsById?.values() ?? []) {
    if (component instanceof NotificationComponent) component.setPreviewLineLimit(previewLineLimit);
  }
  if (!state.chatContainer) return;
  // Preview height changes can change chat spacing, so re-measure it.
  reconcileChatBoundarySpacers(state.chatContainer);
}
