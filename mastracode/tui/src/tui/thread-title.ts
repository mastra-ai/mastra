import type { TUIState } from './state.js';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

export function setCurrentThreadTitle(state: TUIState, title: string | undefined): void {
  const safeTitle = title?.replace(CONTROL_CHARACTER_PATTERN, ' ').trim() || undefined;
  state.currentThreadTitle = safeTitle;

  const appName = state.options.appName || 'Mastra Code';
  const cwd = process.cwd().split('/').pop() || '';
  state.ui.terminal.setTitle(`${appName} - ${safeTitle || cwd}`.replace(CONTROL_CHARACTER_PATTERN, ' '));
}
