import { basename } from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import type { TUIState } from './state.js';

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

export function setCurrentThreadTitle(state: TUIState, title: string | undefined): void {
  const safeTitle = title ? stripVTControlCharacters(title).replace(CONTROL_CHARACTER_PATTERN, ' ').trim() : undefined;
  state.currentThreadTitle = safeTitle;

  const appName = state.options.appName || 'Mastra Code';
  const cwd = basename(process.cwd());
  state.ui.terminal.setTitle(`${appName} - ${safeTitle || cwd}`.replace(CONTROL_CHARACTER_PATTERN, ' '));
}
