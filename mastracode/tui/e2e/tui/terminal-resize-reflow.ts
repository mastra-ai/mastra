import { expect } from './expect.js';
import type { McE2eScenario, McE2eTerminal } from './types.js';

const WIDE_COLUMNS = 120;
const NARROW_COLUMNS = 52;
const ROWS = 36;
const TASK_PREFIX = 'Rendering terminal resize historical content';
const TASK_TAIL = 'unique-restored-tail';
const EDITOR_TEXT = '/resize-editor-boundary-' + 'x'.repeat(90);

function linesContaining(view: string, text: string): string[] {
  return view.split('\n').filter(line => line.includes(text));
}

function expectEditorBordersAligned(terminal: McE2eTerminal, columns: number): void {
  const lines = terminal.serialize().view.split('\n');
  const topBorder = lines.findLastIndex(line => /^╭─+╮$/.test(line));
  const bottomBorder = lines.findIndex((line, index) => index > topBorder && /^╰─+╯$/.test(line));
  const editorRows = lines.slice(topBorder + 1, bottomBorder);
  expect(editorRows.length).toBeGreaterThan(0);
  expect(editorRows.join('\n')).toContain('resize-editor-boundary-');
  for (const line of editorRows) {
    if (line.length !== columns || !line.endsWith('│')) {
      throw new Error(`Expected ${columns}-column editor row with aligned right border, got ${JSON.stringify(line)}`);
    }
  }
}

export const terminalResizeReflowScenario: McE2eScenario = {
  name: 'terminal-resize-reflow',
  description:
    'Resize the real xterm-backed TUI and verify historical custom content and active editor alignment reflow.',
  testName: 'reflows historical custom content and the active slash editor across terminal resizes',
  useOpenAIModel: true,
  aimockFixture: 'terminal-resize-reflow.json',
  async run({ terminal, runtime }) {
    runtime.startLiveOutput(terminal);
    terminal.resize(WIDE_COLUMNS, ROWS);

    await (expect(terminal.getByText(/Project:|Resource ID:|>/gi, { full: true, strict: false })) as any).toBeVisible();
    terminal.submit('Create the terminal resize regression task.');
    await runtime.waitForScreenText(/Terminal resize fixture complete\./i, terminal, 8_000);
    await runtime.waitForScreenText(/unique-restored-tail/i, terminal, 8_000);

    terminal.write(EDITOR_TEXT);
    await terminal.flushInput?.();

    const wide = terminal.serialize().view;
    expect(linesContaining(wide, TASK_PREFIX).join('\n')).toContain(TASK_TAIL);
    expectEditorBordersAligned(terminal, WIDE_COLUMNS);
    runtime.printScreen('wide terminal', terminal);

    terminal.resize(NARROW_COLUMNS, ROWS);
    await runtime.sleep(100);
    await terminal.flushInput?.();

    const narrow = terminal.serialize().view;
    expect(narrow).toContain(TASK_PREFIX);
    expect(narrow).toContain(TASK_TAIL);
    expect(linesContaining(narrow, TASK_PREFIX).join('\n')).not.toContain(TASK_TAIL);
    expectEditorBordersAligned(terminal, NARROW_COLUMNS);
    runtime.printScreen('narrow terminal', terminal);

    terminal.resize(WIDE_COLUMNS, ROWS);
    await runtime.sleep(100);
    await terminal.flushInput?.();

    const restored = terminal.serialize().view;
    expect(linesContaining(restored, TASK_PREFIX).join('\n')).toContain(TASK_TAIL);
    expectEditorBordersAligned(terminal, WIDE_COLUMNS);
    runtime.printScreen('restored wide terminal', terminal);

    terminal.keyCtrlC();
  },
};
