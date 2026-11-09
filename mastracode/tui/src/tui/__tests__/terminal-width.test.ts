import { Container, Text, TUI } from '@earendil-works/pi-tui';
import type { Terminal } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomEditor } from '../components/custom-editor.js';
import { SystemReminderComponent } from '../components/system-reminder.js';
import { getEditorTheme, getTermWidth, MIN_TERM_WIDTH } from '../theme.js';

const originalColumns = process.stdout.columns;

function setReportedColumns(columns: number | undefined) {
  Object.defineProperty(process.stdout, 'columns', { value: columns, writable: true, configurable: true });
}

describe('terminal width', () => {
  afterEach(() => {
    setReportedColumns(originalColumns);
  });

  it('uses the reported width at normal sizes', () => {
    setReportedColumns(80);
    expect(getTermWidth()).toBe(80);
  });

  it('renders the real layout when the terminal briefly reports two columns', () => {
    setReportedColumns(120);
    const terminal = {
      start() {},
      stop() {},
      async drainInput() {},
      write() {},
      get columns() {
        return getTermWidth();
      },
      rows: 40,
      kittyProtocolActive: false,
      moveBy() {},
      hideCursor() {},
      showCursor() {},
      clearLine() {},
      clearFromCursor() {},
      clearScreen() {},
      setTitle() {},
      setProgress() {},
    } satisfies Terminal;

    const ui = new TUI(terminal);
    const chat = new Container();
    const editor = new CustomEditor(ui, getEditorTheme());
    ui.addChild(new Text('mastra code', 1, 0));
    ui.addChild(chat);
    ui.addChild(editor);
    ui.addChild(new Text('status', 0, 0));
    const doRender = () => (ui as unknown as { doRender(): void }).doRender();

    chat.addChild(new SystemReminderComponent({ message: 'first reminder' }));
    doRender();

    setReportedColumns(2);
    expect(terminal.columns).toBe(MIN_TERM_WIDTH);
    expect(doRender).not.toThrow();

    chat.addChild(new SystemReminderComponent({ message: 'second reminder while narrow' }));
    editor.setText('typed while narrow');
    expect(doRender).not.toThrow();
  });
});
