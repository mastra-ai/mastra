import { NotificationSummaryComponent } from './components/notification-summary.js';
import { NotificationComponent } from './components/notification.js';
import type { IToolExecutionComponent } from './components/tool-execution-interface.js';
import type { TUIState } from './state.js';

/**
 * Pushes the current quiet-mode preference into every already-rendered component
 * that renders differently in quiet mode: tool executions, notifications, and
 * notification summaries. Both the onboarding prompt and the `/settings` overlay
 * route through here so the two paths cannot drift.
 */
export function applyQuietModeToRenderedComponents(
  state: Pick<TUIState, 'allToolComponents'> & Partial<Pick<TUIState, 'messageComponentsById'>>,
  enabled: boolean,
  previewLineLimit: number,
  modeColor: string | undefined,
): void {
  const mode = enabled ? 'quiet' : 'normal';
  const tools = state.allToolComponents.filter(
    (tool): tool is IToolExecutionComponent => typeof tool.setQuietModeDisplay === 'function',
  );
  for (const tool of tools) {
    tool.setCompactToolModeColor?.(modeColor);
    tool.setQuietModeDisplay?.(mode);
    tool.setQuietPreviewLineLimit?.(previewLineLimit);
  }
  for (const component of state.messageComponentsById?.values() ?? []) {
    if (component instanceof NotificationComponent) {
      component.setQuietModeDisplay(mode);
      component.setQuietPreviewLineLimit(previewLineLimit);
    } else if (component instanceof NotificationSummaryComponent) {
      component.setQuietModeDisplay(mode);
    }
  }
}
