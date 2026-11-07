import { Box, SelectList, Text, TUI } from '@earendil-works/pi-tui';
import type { SelectItem, Terminal } from '@earendil-works/pi-tui';
import xterm from '@xterm/headless';
import { afterEach, describe, expect, it } from 'vitest';

import { CustomEditor } from '../components/custom-editor.js';
import { showModalOverlay } from '../overlay.js';
import { getEditorTheme, getSelectListTheme } from '../theme.js';
import { MouseController } from './controller.js';

const ROWS = 30;
const COLS = 100;

/** Real pi-tui renderer writing into a headless xterm, with input injected as raw terminal bytes. */
function createHarness() {
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
  const click = (row: number, col: number) => onInput?.(`\x1b[<0;${col};${row}M`);

  return { screen, ui, controller, render, find, click, send: (data: string) => onInput?.(data) };
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
    expect(harness.screen.modes.mouseTrackingMode).toBe('vt200');

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
    harness.click(target.row, target.col);
    expect(selected).toEqual(['item-9']);
  });

  it('ignores clicks outside the modal', async () => {
    harness = createHarness();
    const { selected } = modalWithList(harness.ui, 3);
    await harness.render();

    const target = harness.find('item-1');
    harness.click(target.row, 1);
    harness.click(1, target.col);
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
    expect(harness.screen.modes.mouseTrackingMode).toBe('vt200');

    harness.ui.stop();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(harness.screen.modes.mouseTrackingMode).toBe('none');
  });
});
