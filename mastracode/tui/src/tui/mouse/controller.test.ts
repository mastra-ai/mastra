import { Box, SelectList, SettingsList, Text, TUI } from '@earendil-works/pi-tui';
import type { Component, SelectItem, SettingItem, Terminal } from '@earendil-works/pi-tui';
import type { AgentControllerThread } from '@mastra/core/agent-controller';
import xterm from '@xterm/headless';

import { afterEach, describe, expect, it } from 'vitest';

import { CustomEditor } from '../components/custom-editor.js';
import { GithubPRPickerDialog } from '../components/github-pr-picker.js';
import { LoginAccountManagerComponent } from '../components/login-account-manager.js';
import { LoginModeSelectorComponent } from '../components/login-mode-selector.js';
import { McpSelectorComponent } from '../components/mcp-selector.js';
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
  const written: string[] = [];
  const terminal = {
    start(input: (data: string) => void) {
      onInput = input;
    },
    stop() {},
    async drainInput() {},
    write: (data: string) => {
      written.push(data);
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
  // Left button held while moving (32 motion + 0), then the SGR release report.
  const drag = (row: number, col: number) => pointer(32, row, col);
  const release = async (row: number, col: number) => {
    onInput?.(`\x1b[<0;${col};${row + rowOffset}m`);
    await output;
  };
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
    drag,
    release,
    hover,
    editor,
    written,
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

describe('hand-drawn pickers on PickerList', () => {
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

  it('PR picker: a click does what Enter does, confirming the toggled PRs when any are toggled', async () => {
    harness = createHarness();
    const pullRequests = [101, 102, 103].map(number => ({ owner: 'o', repo: 'r', number, title: `pr-${number}` }));
    const confirmed: string[][] = [];
    const picker = new GithubPRPickerDialog({
      tui: harness.ui,
      pullRequests,
      onConfirm: prs => confirmed.push(prs.map(pr => `#${pr.number}`)),
      onCancel: () => {},
    });
    showModalOverlay(harness.ui, picker);
    await harness.render();

    const pr102 = harness.find('pr-102');
    await harness.click(pr102.row, pr102.col);
    expect(confirmed).toEqual([['#102']]);

    // Space toggles the highlighted PR; Enter (and so a click) then confirms the toggled set.
    harness.send(' ');
    await harness.render();
    const pr101 = harness.find('pr-101');
    await harness.click(pr101.row, pr101.col);
    expect(confirmed).toEqual([['#102'], ['#102']]);
  });

  it('login mode selector: clicking a mode description picks that mode, like Enter', async () => {
    harness = createHarness();
    const picked: string[] = [];
    const modes = [
      { id: 'oauth', name: 'OAuth', description: 'Sign in with the browser' },
      { id: 'key', name: 'API key', description: 'Paste a key you already have' },
    ];
    showModalOverlay(
      harness.ui,
      new LoginModeSelectorComponent(
        'Acme',
        modes as never,
        id => picked.push(id),
        () => {},
      ),
    );
    await harness.render();

    const description = harness.find('Paste a key you already have');
    await harness.hover(description.row, description.col);
    await harness.render();
    expect(harness.markedRows()).toContain(harness.find('API key').row);

    await harness.click(description.row, description.col);
    expect(picked).toEqual(['key']);
  });

  it('login account manager: clicks walk into an account and run its action, like Enter', async () => {
    harness = createHarness();
    const activated: string[] = [];
    const manager = new LoginAccountManagerComponent(
      'Acme',
      [
        { id: 'a', label: 'first@acme.dev', active: true },
        { id: 'b', label: 'second@acme.dev', active: false },
      ],
      {
        onAddAnother() {},
        onReauthenticate() {},
        onRemove() {},
        onActivate: id => activated.push(id),
        onBack() {},
      },
    );
    showModalOverlay(harness.ui, manager);
    await harness.render();

    const second = harness.find('second@acme.dev');
    await harness.click(second.row, second.col);
    await harness.render();
    const activate = harness.find('Set as active');
    await harness.click(activate.row, activate.col);
    expect(activated).toEqual(['b']);
  });

  it('mcp selector: clicking another server closes the open action menu and opens its own, like Esc + Enter', async () => {
    harness = createHarness();
    const reconnected: string[] = [];
    const server = (name: string) =>
      ({
        name,
        transport: 'http',
        connected: true,
        connecting: false,
        needsAuth: false,
        toolCount: 1,
        toolNames: ['t'],
      }) as never;
    const noop = async () => ({ statuses: [], skipped: [] });
    const selector = new McpSelectorComponent({
      tui: harness.ui,
      statuses: [server('alpha'), server('beta')],
      skipped: [],
      configPaths: { project: '', global: '', claude: '' },
      getStatuses: () => ({ statuses: [], skipped: [] }),
      onReloadAll: noop,
      onReconnectServer: async name => {
        reconnected.push(name);
        return server(name);
      },
      onAuthenticateServer: async name => server(name),
      onCancelAuthenticateServer: async () => false,
      onSetServerDisabled: noop,
      onInheritServer: noop,
      getServerLogs: () => [],
      showInfo: () => {},
      onClose: () => {},
    });
    showModalOverlay(harness.ui, selector);
    await harness.render();

    const alpha = harness.find('alpha [http]');
    await harness.click(alpha.row, alpha.col);
    await harness.render();
    expect(harness.find('View tools').row).toBe(harness.find('alpha [http]').row + 1);

    const beta = harness.find('beta [http]');
    await harness.click(beta.row, beta.col);
    await harness.render();
    expect(harness.find('View tools').row).toBe(harness.find('beta [http]').row + 1);

    const reconnect = harness.find('Reconnect');
    await harness.hover(reconnect.row, reconnect.col);
    await harness.render();
    expect(harness.markedRows()).toEqual([reconnect.row]);
    await harness.click(reconnect.row, reconnect.col);
    expect(reconnected).toEqual(['beta']);
  });
});

describe('input box mouse mode (Alt+M)', () => {
  const ALT_M = '\x1bm';
  const UNDO = '\x1f';

  async function inputHarness(text: string) {
    harness = createHarness();
    harness.editor.setText(text);
    await harness.render();
    harness.send(ALT_M);
    await harness.render();
    return harness;
  }

  it('captures the mouse only while toggled on', async () => {
    const h = await inputHarness('hello');
    expect(h.screen.modes.mouseTrackingMode).toBe('any');
    expect(h.controller.isInputMouseMode()).toBe(true);
    h.send(ALT_M);
    await h.render();
    expect(h.screen.modes.mouseTrackingMode).toBe('none');
    expect(h.controller.isInputMouseMode()).toBe(false);
  });

  it('a click moves the cursor to the clicked character', async () => {
    const h = await inputHarness('hello world');
    const word = h.find('world');
    await h.click(word.row, word.col);
    await h.release(word.row, word.col);
    h.send('X');
    expect(h.editor.getText()).toBe('hello Xworld');
  });

  it('maps clicks through wrapped rows and wide characters', async () => {
    const h = await inputHarness(`${'a'.repeat(90)} tail 你好end`);
    const wide = h.find('你');
    // 你 takes two cells, so 好 starts two columns further right.
    await h.click(wide.row, wide.col + 2);
    await h.release(wide.row, wide.col + 2);
    h.send('X');
    expect(h.editor.getText()).toBe(`${'a'.repeat(90)} tail 你X好end`);
  });

  it('treats a paste marker as one character', async () => {
    harness = createHarness();
    const h = harness;
    h.send(`\x1b[200~${Array.from({ length: 20 }, (_, i) => `pasted ${i}`).join('\n')}\x1b[201~`);
    await h.render();
    h.send(ALT_M);
    await h.render();
    const marker = h.find('[paste #1');
    // Inside the left half of the marker: the cursor lands before it, never inside.
    await h.click(marker.row, marker.col + 2);
    await h.release(marker.row, marker.col + 2);
    h.send('X');
    expect(h.editor.getText()).toMatch(/^X\[paste #1 [^\]]+\]$/);
  });

  it('maps clicks in a scrolled input box', async () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line-${String(i).padStart(2, '0')}`);
    const h = await inputHarness(lines.join('\n'));
    expect(() => h.find('line-00')).toThrow();
    const target = h.find('line-15');
    await h.click(target.row, target.col);
    await h.release(target.row, target.col);
    h.send('X');
    expect(h.editor.getText().split('\n')[15]).toBe('Xline-15');
  });

  it('a drag selects, copies through OSC 52, and typing replaces the selection', async () => {
    const h = await inputHarness('hello brave world');
    const word = h.find('brave');
    await h.click(word.row, word.col);
    await h.drag(word.row, word.col + 3);
    await h.release(word.row, word.col + 5);
    expect(h.written).toContain(`\x1b]52;c;${Buffer.from('brave').toString('base64')}\x07`);
    h.send('Z');
    expect(h.editor.getText()).toBe('hello Z world');
  });

  it('backspace removes the selection as one undoable edit', async () => {
    const h = await inputHarness('hello brave world');
    const word = h.find('brave');
    await h.click(word.row, word.col);
    await h.release(word.row, word.col + 6);
    h.send('\x7f');
    expect(h.editor.getText()).toBe('hello world');
    h.send(UNDO);
    expect(h.editor.getText()).toBe('hello brave world');
  });

  it('arrow keys clear the selection without editing', async () => {
    const h = await inputHarness('hello brave world');
    const word = h.find('brave');
    await h.click(word.row, word.col);
    await h.release(word.row, word.col + 5);
    // The cursor sits at the drag's end; → steps past the space, and Backspace edits normally.
    h.send('\x1b[C');
    h.send('\x7f');
    expect(h.editor.getText()).toBe('hello braveworld');
  });

  it('the wheel does nothing over the input box', async () => {
    const h = await inputHarness('one\ntwo\nthree');
    const before = h.editor.getCursor();
    const row = h.find('two').row;
    h.send(`\x1b[<64;10;${row}M`);
    h.send(`\x1b[<64;10;${row}M`);
    expect(h.editor.getCursor()).toEqual(before);
  });
});
