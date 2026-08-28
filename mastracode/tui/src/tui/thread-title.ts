import type { TUIState } from './state.js';

export function setCurrentThreadTitle(state: TUIState, title: string | undefined): void {
  state.currentThreadTitle = title;

  const appName = state.options.appName || 'Mastra Code';
  const cwd = process.cwd().split('/').pop() || '';
  state.ui.terminal.setTitle(`${appName} - ${title?.trim() || cwd}`);
}
