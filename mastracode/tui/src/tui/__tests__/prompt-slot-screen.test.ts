import { Container, Text } from '@earendil-works/pi-tui';
import type { Terminal } from '@earendil-works/pi-tui';
import xterm from '@xterm/headless';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomEditor } from '../components/custom-editor.js';
import { MenuList } from '../components/menu-list.js';
import { SettingsMenu } from '../components/settings-menu.js';
import { MouseController } from '../mouse/controller.js';
import { showModalOverlay } from '../overlay.js';
import { MastraTUI, PromptSlot } from '../prompt-slot.js';
import { getEditorTheme } from '../theme.js';

/** The app's layout (chat, prompt slot, status line) drawn by the real renderer into a headless terminal. */
function createApp({ cols = 80, rows = 24, chatLines = 60 } = {}) {
  const screen = new xterm.Terminal({ cols, rows, scrollback: 1000, allowProposedApi: true });
  let onInput: ((data: string) => void) | undefined;
  let output = Promise.resolve();
  const terminal = {
    start: (input: (data: string) => void) => void (onInput = input),
    stop() {},
    async drainInput() {},
    write: (data: string) => {
      output = output.then(() => new Promise<void>(resolve => screen.write(data, resolve)));
      if (!data.includes('\x1b[6n')) return;
      output = output.then(() => onInput?.(`\x1b[${screen.buffer.active.cursorY + 1};1R`));
    },
    columns: cols,
    rows,
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

  const ui = new MastraTUI(terminal);
  const editor = new CustomEditor(ui, getEditorTheme());
  const chat = new Container();
  const slotContainer = new Container();
  slotContainer.addChild(editor);
  ui.addChild(chat);
  ui.addChild(slotContainer);
  ui.addChild(new Text('status line', 0, 0));
  ui.promptSlot = new PromptSlot(ui, slotContainer, editor);
  const controller = new MouseController(ui, editor, { dialogMouseEnabled: true });
  const say = (from: number, to: number) => {
    for (let i = from; i <= to; i++) chat.addChild(new Text(`chat ${i}`, 0, 0));
  };
  say(1, chatLines);
  ui.setFocus(editor);
  ui.start();

  const line = (row: number) => screen.buffer.active.getLine(row)?.translateToString(true).trimEnd() ?? '';
  return {
    ui,
    editor,
    say,
    render: async () => {
      (ui as unknown as { doRender(): void }).doRender();
      await output;
    },
    resize: (newCols: number, newRows: number) => {
      terminal.columns = newCols;
      terminal.rows = newRows;
      screen.resize(newCols, newRows);
    },
    send: (data: string) => onInput?.(data),
    screen: () => Array.from({ length: terminal.rows }, (_, row) => line(screen.buffer.active.baseY + row)),
    scrollback: () => Array.from({ length: screen.buffer.active.baseY }, (_, row) => line(row)),
    pointer: async (code: number, row: number) => {
      onInput?.(`\x1b[<${code};10;${row + 1}M`);
      await output;
    },
    stop: () => {
      controller.dispose();
      ui.stop();
    },
  };
}

let app: ReturnType<typeof createApp> | undefined;
afterEach(() => {
  app?.stop();
  app = undefined;
});

function openList(ui: MastraTUI, count: number) {
  const list = new MenuList(
    Array.from({ length: count }, (_, i) => ({ value: `item-${i}`, label: `item-${i}` })),
    count,
  );
  const selected: string[] = [];
  list.onSelect = item => selected.push(item.value);
  list.onCancel = () => ui.hideOverlay();
  showModalOverlay(ui, list, { title: 'Pick one', hints: [{ key: 'tab', label: 'clone' }] });
  return { list, selected };
}

const rowWith = (rows: string[], text: string) => rows.findIndex(row => row.includes(text));

describe('menus in the prompt slot on screen', () => {
  it('fits a short terminal: the search row, the selected row, the hints and the status line stay visible', async () => {
    app = createApp({ rows: 14 });
    await app.render();
    openList(app.ui, 30);
    for (const key of ['', '\x1b[A', '\x1b[B']) {
      if (key) app.send(key);
      await app.render();
      const rows = app.screen();
      expect(rowWith(rows, 'pick one')).toBeGreaterThanOrEqual(0);
      expect(rowWith(rows, '→ item-')).toBeGreaterThan(rowWith(rows, 'pick one'));
      expect(rowWith(rows, '/30)')).toBeGreaterThan(0);
      expect(rowWith(rows, 'clone')).toBeGreaterThan(0);
      expect(rows.at(-1)).toContain('status line');
    }
  });

  it('keeps the selected setting visible when the description takes rows too', async () => {
    app = createApp({ rows: 14 });
    await app.render();
    const settings = new SettingsMenu(
      Array.from({ length: 16 }, (_, i) => ({
        id: `s${i}`,
        label: `Setting ${i}`,
        currentValue: 'On',
        description: 'A long explanation of what this setting does. '.repeat(1 + (i % 4)),
      })),
      10,
      () => {},
      () => {},
    );
    showModalOverlay(app.ui, settings, { title: 'Settings' });
    for (let i = 0; i < 18; i++) {
      await app.render();
      const rows = app.screen();
      expect(rowWith(rows, `→ Setting ${i % 16}`)).toBeGreaterThan(rowWith(rows, 'settings'));
      expect(rowWith(rows, 'settings')).toBeGreaterThanOrEqual(0);
      expect(rows.at(-1)).toContain('status line');
      app.send('\x1b[B');
    }
  });

  it('stays responsive when the terminal shrinks while nothing matches the search', async () => {
    app = createApp({ rows: 40 });
    await app.render();
    const list = new MenuList(
      Array.from({ length: 30 }, (_, i) => ({ value: `item-${i}`, label: `item-${i}` })),
      12,
    );
    const menu = Object.assign(new Container(), { handleInput: (data: string) => list.handleInput(data) });
    menu.addChild(list);
    menu.addChild(new Text('A note under the list that wraps to several rows. '.repeat(16), 0, 0));
    showModalOverlay(app.ui, menu, { title: 'API keys' });
    await app.render();
    app.send('zzzz');
    await app.render();
    app.resize(80, 14);
    await app.render();
    expect(rowWith(app.screen(), 'zzzz')).toBeGreaterThanOrEqual(0);
    expect(rowWith(app.screen(), 'no matches')).toBeGreaterThan(0);
    expect(app.screen().at(-1)).toContain('status line');

    for (let i = 0; i < 4; i++) app.send('\x7f');
    await app.render();
    expect(rowWith(app.screen(), '→ item-0')).toBeGreaterThan(0);
  });

  it('leaves the status line at the bottom and the scrollback alone while filtering and after closing', async () => {
    app = createApp();
    await app.render();
    const before = { screen: app.screen(), scrollback: app.scrollback() };
    openList(app.ui, 12);
    await app.render();
    const search = rowWith(app.screen(), 'pick one');
    // The newest chat stays right above the menu.
    expect(app.screen()[search - 2]).toContain('chat 60');

    app.send('z');
    await app.render();
    expect(rowWith(app.screen(), 'no matches')).toBeGreaterThan(0);
    expect(app.screen()[search]).toContain('z');
    expect(app.screen().at(-1)).toContain('status line');

    app.send('\x1b');
    await app.render();
    expect(app.screen()).toEqual(before.screen);
    expect(app.scrollback()).toEqual(before.scrollback);
  });

  it('keeps the whole conversation in order in the scrollback when the chat grows under an open menu', async () => {
    app = createApp();
    await app.render();
    openList(app.ui, 12);
    await app.render();
    for (let i = 61; i <= 90; i += 3) {
      app.say(i, i + 2);
      await app.render();
      expect(app.screen().at(-1)).toContain('status line');
    }
    app.send('\x1b');
    await app.render();
    const chat = [...app.scrollback(), ...app.screen()].filter(row => row.startsWith('chat '));
    expect(chat).toEqual(Array.from({ length: 90 }, (_, i) => `chat ${i + 1}`));
  });

  it('refits when the terminal is resized while it is open', async () => {
    app = createApp();
    await app.render();
    openList(app.ui, 30);
    await app.render();
    for (const [cols, rows] of [
      [60, 12],
      [100, 40],
      [60, 24],
    ] as const) {
      app.resize(cols, rows);
      await app.render();
      expect(rowWith(app.screen(), 'pick one')).toBeGreaterThanOrEqual(0);
      expect(rowWith(app.screen(), '→ item-0')).toBeGreaterThan(0);
      expect(rowWith(app.screen(), 'status line')).toBe(rows - 1);
    }
    app.send('\x1b');
    await app.render();
    expect(app.screen().at(-1)).toContain('status line');
    expect(
      app
        .screen()
        .filter(row => row.startsWith('chat '))
        .at(-1),
    ).toBe('chat 60');
  });

  it.each([60, 3])('picks the row under a click and marks the hovered one (%i chat lines)', async chatLines => {
    app = createApp({ chatLines });
    await app.render();
    const { selected } = openList(app.ui, 30);
    app.send('\x1b[A');
    await app.render();
    const row = rowWith(app.screen(), 'item-27');
    await app.pointer(35, row);
    await app.render();
    expect(app.screen().filter(line => line.startsWith('▌'))).toEqual([expect.stringContaining('item-27')]);
    await app.pointer(0, row);
    expect(selected).toEqual(['item-27']);
  });
});

describe('command suggestions on screen', () => {
  const type = async (text: string) => {
    for (const char of text) app!.send(char);
    await new Promise(resolve => setTimeout(resolve, 50));
    await app!.render();
  };

  const suggest = () =>
    app!.editor.setAutocompleteProvider({
      getSuggestions: async (lines: string[]) => ({
        prefix: lines[0]!,
        items: Array.from({ length: lines[0]!.length > 1 ? 2 : 5 }, (_, i) => ({ value: `c${i}`, label: `c${i}` })),
      }),
      applyCompletion: (lines, cursorLine, cursorCol) => ({ lines, cursorLine, cursorCol }),
    });

  it('leave the screen and the scrollback as they were when they shrink and close', async () => {
    app = createApp();
    suggest();
    await app.render();
    const before = { screen: app.screen(), scrollback: app.scrollback() };
    await type('/');
    expect(rowWith(app.screen(), 'c4')).toBeGreaterThan(0);
    expect(app.screen().at(-1)).toContain('status line');

    await type('c');
    expect(rowWith(app.screen(), 'c4')).toBe(-1);
    expect(app.screen().at(-1)).toContain('status line');

    app.editor.setText('');
    await app.render();
    expect(app.screen()).toEqual(before.screen);
    expect(app.scrollback()).toEqual(before.scrollback);
  });

  it('leave no blank rows under the status line once the menu they opened closes', async () => {
    app = createApp();
    suggest();
    await app.render();
    const before = app.screen();
    await type('/c');
    app.editor.setText('');
    openList(app.ui, 12);
    await app.render();
    app.send('\x1b');
    await app.render();
    expect(app.screen()).toEqual(before);
  });
});
