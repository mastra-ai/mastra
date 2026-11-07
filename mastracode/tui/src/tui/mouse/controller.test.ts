import { Box, SelectList, SettingsList, Text, TUI } from '@earendil-works/pi-tui';
import type { Component, SelectItem, SettingItem, Terminal } from '@earendil-works/pi-tui';
import type { AgentControllerThread } from '@mastra/core/agent-controller';
import xterm from '@xterm/headless';

import { afterEach, describe, expect, it } from 'vitest';

import { CustomEditor } from '../components/custom-editor.js';
import { ThreadSelectorComponent } from '../components/thread-selector.js';
import { WrappingSelectList } from '../components/wrapping-select-list.js';
import { showModalOverlay } from '../overlay.js';
import { getEditorTheme, getSelectListTheme, getSettingsListTheme } from '../theme.js';
import { MouseController } from './controller.js';

const ROWS = 30;
const COLS = 100;

/** Real pi-tui renderer writing into a headless xterm, with input injected as raw terminal bytes. */
/**
 * `rowOffset` simulates a terminal whose screen rows are offset from the rendered frame (as when the
 * frame no longer reaches the bottom of the screen): mouse reports and cursor position replies both
 * come back shifted by that many rows.
 */
function createHarness({ rowOffset = 0 }: { rowOffset?: number } = {}) {
  const screen = new xterm.Terminal({ cols: COLS, rows: ROWS, allowProposedApi: true });
  let onInput: ((data: string) => void) | undefined;
  let output = Promise.resolve();
  const terminal = {
    start(input: (data: string) => void) {
      onInput = input;
    },
    stop() {},
    async drainInput() {},
    write: (data: string) => {
      output = output.then(() => new Promise<void>(resolve => screen.write(data, resolve)));
      // Headless xterm has no stdin, so answer cursor position requests like a real terminal.
      if (data.includes('\x1b[6n')) {
        output = output.then(() => {
          const { cursorY, cursorX } = screen.buffer.active;
          onInput?.(`\x1b[${cursorY + 1 + rowOffset};${cursorX + 1}R`);
        });
      }
    },
    columns: COLS,
    rows: ROWS,
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
  const editor = new CustomEditor(ui, getEditorTheme());
  ui.addChild(editor);
  ui.setFocus(editor);
  const controller = new MouseController(ui, editor);
  ui.start();

  const render = async () => {
    (ui as unknown as { doRender(): void }).doRender();
    await output;
  };
  const find = (text: string) => {
    const buffer = screen.buffer.active;
    for (let row = 0; row < ROWS; row += 1) {
      const col =
        buffer
          .getLine(buffer.viewportY + row)
          ?.translateToString(true)
          .indexOf(text) ?? -1;
      if (col >= 0) return { row: row + 1, col: col + 1 };
    }
    throw new Error(`"${text}" not on screen`);
  };
  // Pointer events wait for the cursor position round trip before they take effect.
  const pointer = async (code: number, row: number, col: number) => {
    onInput?.(`\x1b[<${code};${col};${row + rowOffset}M`);
    await output;
  };
  const click = (row: number, col: number) => pointer(0, row, col);
  // SGR motion with no button held: button code 35 (32 motion + 3 none).
  const hover = (row: number, col: number) => pointer(35, row, col);

  const lineAt = (row: number) =>
    screen.buffer.active.getLine(screen.buffer.active.viewportY + row - 1)?.translateToString(true) ?? '';
  const markedRows = () =>
    Array.from({ length: ROWS }, (_, index) => index + 1).filter(row => lineAt(row).includes('▌'));

  return {
    screen,
    ui,
    controller,
    render,
    find,
    lineAt,
    markedRows,
    click,
    hover,
    send: (data: string) => onInput?.(data),
  };
}

function modalWithList(ui: TUI, count: number) {
  const items: SelectItem[] = Array.from({ length: count }, (_, index) => ({
    value: `item-${index}`,
    label: `item-${index}`,
  }));
  const list = new SelectList(items, 5, getSelectListTheme());
  const selected: string[] = [];
  list.onSelect = item => selected.push(item.value);
  // Like the real selectors: a padded Box that forwards keys to its list.
  const box = Object.assign(new Box(4, 2), { handleInput: (data: string) => list.handleInput(data) });
  box.addChild(new Text('Pick one', 0, 0));
  box.addChild(list);
  const handle = showModalOverlay(ui, box);
  return { list, selected, handle };
}

function modalWith(ui: TUI, list: Component & { handleInput(data: string): void }) {
  const box = Object.assign(new Box(4, 2), { handleInput: (data: string) => list.handleInput(data) });
  box.addChild(new Text('Pick one', 0, 0));
  box.addChild(list);
  showModalOverlay(ui, box);
}

let harness: ReturnType<typeof createHarness> | undefined;
afterEach(() => {
  harness?.controller.dispose();
  harness?.ui.stop();
  harness = undefined;
});

describe('MouseController on the real pi-tui renderer', () => {
  it('only tracks the mouse while a modal is open, so the transcript keeps native scroll and selection', async () => {
    harness = createHarness();
    await harness.render();
    expect(harness.screen.modes.mouseTrackingMode).toBe('none');

    const { handle } = modalWithList(harness.ui, 3);
    await harness.render();
    expect(harness.screen.modes.mouseTrackingMode).toBe('any');

    handle.hide();
    await harness.render();
    expect(harness.screen.modes.mouseTrackingMode).toBe('none');
  });

  it('selects the item under the click, including in a scrolled list', async () => {
    harness = createHarness();
    const { list, selected } = modalWithList(harness.ui, 12);
    list.setSelectedIndex(8);
    await harness.render();

    const target = harness.find('item-9');
    await harness.click(target.row, target.col);
    expect(selected).toEqual(['item-9']);
  });

  it('hover marks the row a click would pick, without changing the selection', async () => {
    harness = createHarness();
    const { list, selected } = modalWithList(harness.ui, 12);
    const changes: string[] = [];
    list.onSelectionChange = item => changes.push(item.value);
    list.setSelectedIndex(8);
    await harness.render();

    const target = harness.find('item-9');
    await harness.hover(target.row, target.col);
    await harness.render();
    expect(harness.lineAt(target.row)).toMatch(/^\s*▌\s+item-9/);
    expect(harness.markedRows()).toEqual([target.row]);
    expect(list.getSelectedItem()?.value).toBe('item-8');
    expect(changes).toEqual([]);
    expect(selected).toEqual([]);

    // The list scrolls under a still pointer: the marker stays on that screen row and a click
    // there picks whatever item is drawn there now.
    harness.send('\x1b[B');
    await harness.render();
    expect(harness.markedRows()).toEqual([target.row]);
    const drawn = /item-\d+/.exec(harness.lineAt(target.row))?.[0];
    await harness.click(target.row, target.col);
    expect(selected).toEqual([drawn]);
  });

  it('maps pointer rows through the cursor position when the screen is offset from the rendered frame', async () => {
    harness = createHarness({ rowOffset: 3 });
    const { list, selected } = modalWithList(harness.ui, 12);
    list.setSelectedIndex(8);
    await harness.render();

    const target = harness.find('item-9');
    await harness.hover(target.row, target.col);
    await harness.render();
    expect(harness.markedRows()).toEqual([target.row]);

    await harness.click(target.row, target.col);
    expect(selected).toEqual(['item-9']);
  });

  it('ignores clicks outside the modal', async () => {
    harness = createHarness();
    const { selected } = modalWithList(harness.ui, 3);
    await harness.render();

    const target = harness.find('item-1');
    await harness.click(target.row, 1);
    await harness.click(1, target.col);
    expect(selected).toEqual([]);
  });

  it('turns wheel events into arrow keys for the focused list', async () => {
    harness = createHarness();
    const { list } = modalWithList(harness.ui, 5);
    await harness.render();

    harness.send('\x1b[<65;50;10M');
    harness.send('\x1b[<65;50;10M');
    expect(list.getSelectedItem()?.value).toBe('item-2');
  });

  it('turns tracking off when the TUI stops (shutdown or Ctrl+Z) so the shell never receives mouse reports', async () => {
    harness = createHarness();
    modalWithList(harness.ui, 3);
    await harness.render();
    expect(harness.screen.modes.mouseTrackingMode).toBe('any');

    harness.ui.stop();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(harness.screen.modes.mouseTrackingMode).toBe('none');
  });
});

describe('shared list components', () => {
  it('a wrapped WrappingSelectList item is picked from any of its rows', async () => {
    harness = createHarness();
    const items: SelectItem[] = [
      { value: 'short', label: 'short' },
      { value: 'long', label: `long ${'word '.repeat(40)}tail-marker` },
      { value: 'after', label: 'after' },
    ];
    const list = new WrappingSelectList(items, 5, getSelectListTheme());
    const selected: string[] = [];
    list.onSelect = item => selected.push(item.value);
    modalWith(harness.ui, list);
    await harness.render();

    const continuation = harness.find('tail-marker');
    await harness.hover(continuation.row, continuation.col);
    await harness.render();
    const first = harness.find('long word');
    expect(harness.markedRows()).toEqual(
      Array.from({ length: continuation.row - first.row + 1 }, (_, index) => first.row + index),
    );

    await harness.click(continuation.row, continuation.col);
    expect(selected).toEqual(['long']);

    const after = harness.find('after');
    await harness.click(after.row, after.col);
    expect(selected).toEqual(['long', 'after']);
  });

  it('clicking a multi-select WrappingSelectList row toggles its checkbox without confirming', async () => {
    harness = createHarness();
    const items: SelectItem[] = ['alpha', 'bravo', 'charlie'].map(value => ({ value, label: value }));
    const list = new WrappingSelectList(items, 5, getSelectListTheme(), true);
    const confirmed: string[][] = [];
    list.onConfirmMulti = checked => confirmed.push(checked.map(item => item.value));
    modalWith(harness.ui, list);
    await harness.render();

    const bravo = harness.find('bravo');
    await harness.click(bravo.row, bravo.col);
    await harness.render();
    expect(harness.lineAt(bravo.row)).toContain('[x] bravo');
    expect(confirmed).toEqual([]);

    await harness.click(bravo.row, bravo.col);
    await harness.render();
    expect(harness.lineAt(bravo.row)).toContain('[ ] bravo');

    const charlie = harness.find('charlie');
    await harness.click(charlie.row, charlie.col);
    harness.send('\r');
    expect(confirmed).toEqual([['charlie']]);
  });

  it('SettingsList rows cycle values or open submenus, and submenu rows are clickable', async () => {
    harness = createHarness();
    const changes: Array<[string, string]> = [];
    const items: SettingItem[] = [
      { id: 'mode', label: 'Mode', currentValue: 'on', values: ['on', 'off'] },
      {
        id: 'color',
        label: 'Color',
        currentValue: 'red',
        submenu: (_current, done) => {
          const submenu = new SelectList(
            ['red', 'green', 'blue'].map(value => ({ value, label: `shade-${value}` })),
            5,
            getSelectListTheme(),
          );
          submenu.onSelect = item => done(item.value);
          return submenu;
        },
      },
    ];
    const list = new SettingsList(
      items,
      10,
      getSettingsListTheme(),
      (id, value) => changes.push([id, value]),
      () => {},
      {
        enableSearch: true,
      },
    );
    modalWith(harness.ui, list);
    await harness.render();

    const mode = harness.find('Mode');
    await harness.click(mode.row, mode.col);
    expect(changes).toEqual([['mode', 'off']]);

    const color = harness.find('Color');
    await harness.click(color.row, color.col);
    await harness.render();
    const green = harness.find('shade-green');
    await harness.click(green.row, green.col);
    await harness.render();
    expect(changes).toEqual([
      ['mode', 'off'],
      ['color', 'green'],
    ]);
    expect(harness.find('Color').row).toBe(color.row);
  });
});

describe('thread selector on PickerList', () => {
  function thread(index: number, title: string): AgentControllerThread {
    const updatedAt = new Date(Date.now() - index * 60_000);
    return {
      id: `thread-${String(index).padStart(6, '0')}`,
      resourceId: 'res',
      title,
      createdAt: updatedAt,
      updatedAt,
      metadata: {},
      tokenUsage: { totalTokens: 0, promptTokens: 0, completionTokens: 0 },
    };
  }

  it('thread selector: clicking either row of a two-row thread picks it, like Enter', async () => {
    harness = createHarness();
    const threads = Array.from({ length: 20 }, (_, index) => thread(index, `title-${index}`));
    const picked: string[] = [];
    const selector = new ThreadSelectorComponent({
      tui: harness.ui,
      threads,
      currentThreadId: null,
      onSelect: t => picked.push(t.id),
      onCancel: () => {},
    });
    showModalOverlay(harness.ui, selector);
    await harness.render();

    // Scroll so the window no longer starts at the first thread.
    for (let i = 0; i < 10; i++) harness.send('\x1b[B');
    await harness.render();

    const title = harness.find('title-6');
    await harness.hover(title.row, title.col);
    await harness.render();
    expect(harness.markedRows()).toEqual([title.row - 1, title.row]);

    await harness.click(title.row, title.col);
    expect(picked).toEqual(['thread-000006']);
  });
});
