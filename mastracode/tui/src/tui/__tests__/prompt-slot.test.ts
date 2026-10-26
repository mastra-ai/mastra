import { Container } from '@earendil-works/pi-tui';
import type { Component, Terminal } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MenuList } from '../components/menu-list.js';
import { SettingsMenu } from '../components/settings-menu.js';
import { MastraTUI, PromptSlot } from '../prompt-slot.js';

const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;:]*m|\x1b_[^\x07]*\x07/g, '').trimEnd());

function setup() {
  const terminal = { columns: 80, rows: 30, write: vi.fn(), start: vi.fn(), stop: vi.fn() } as unknown as Terminal;
  const ui = new MastraTUI(terminal);
  vi.spyOn(ui, 'requestRender').mockImplementation(() => {});
  const editor: Component = { render: () => ['prompt'], invalidate: () => {} };
  const container = new Container();
  container.addChild(editor);
  const slot = new PromptSlot(ui, container, editor);
  ui.promptSlot = slot;
  const mounted = () => container.children[container.children.length - 1]!;
  return { ui, slot, editor, container, mounted };
}

function list(labels: string[], onCancel = vi.fn()) {
  const menu = new MenuList(labels.map(label => ({ value: label, label })));
  menu.onCancel = onCancel;
  return menu;
}

afterEach(() => vi.useRealTimers());

describe('PromptSlot', () => {
  it('shows a menu in place of the prompt and brings the prompt back when it closes', () => {
    const { ui, slot, editor, mounted } = setup();
    slot.open(list(['Low', 'High']), { title: 'Thinking level' });

    expect(mounted()).not.toBe(editor);
    expect(ui.hasOverlay()).toBe(true);
    const rows = plain(mounted().render(60));
    expect(rows.some(row => row.includes('thinking level'))).toBe(true);
    expect(rows.some(row => row.includes('→ Low'))).toBe(true);

    ui.hideOverlay();
    expect(mounted()).toBe(editor);
    expect(ui.hasOverlay()).toBe(false);
  });

  it('stacks a menu opened from a menu and returns to the first one', () => {
    const { ui, slot, editor, mounted } = setup();
    slot.open(list(['One']), { title: 'First' });
    const first = mounted();
    slot.open(list(['Two']), { title: 'Second' });
    expect(plain(mounted().render(60)).some(row => row.includes('second'))).toBe(true);

    ui.hideOverlay();
    expect(mounted()).toBe(first);
    ui.hideOverlay();
    expect(mounted()).toBe(editor);
  });

  it('filters the list as you type, and Backspace on an empty search goes back', () => {
    const onCancel = vi.fn();
    const { slot, mounted } = setup();
    slot.open(list(['Low', 'Medium', 'High', 'Extra high'], onCancel), { title: 'Thinking level' });
    const frame = mounted();

    for (const ch of 'xh') frame.handleInput!(ch);
    let rows = plain(frame.render(60));
    expect(rows.some(row => row.includes('xh'))).toBe(true);
    expect(rows.some(row => row.includes('→ Extra high'))).toBe(true);
    expect(rows.some(row => row.includes('Medium'))).toBe(false);

    frame.handleInput!('\x7f');
    frame.handleInput!('\x7f');
    rows = plain(frame.render(60));
    expect(rows.some(row => row.includes('Medium'))).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();

    frame.handleInput!('\x7f');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('adds pasted text and spaces after text to the search', () => {
    const { slot, mounted } = setup();
    slot.open(list(['openai/gpt-5 mini', 'anthropic/claude']));
    const frame = mounted();
    frame.handleInput!(' ');
    frame.handleInput!('\x1b[200~openai/gpt\x1b[201~');
    frame.handleInput!(' ');
    frame.handleInput!('m');
    const rows = plain(frame.render(60));
    expect(rows.some(row => row.includes('openai/gpt m'))).toBe(true);
    expect(rows.some(row => row.includes('→ openai/gpt-5 mini'))).toBe(true);
    expect(rows.some(row => row.includes('anthropic'))).toBe(false);
  });

  it('lets a menu keep Backspace on an empty search instead of going back', () => {
    const { slot, mounted } = setup();
    const menu = list(['One']);
    const handleInput = vi.fn();
    const root = Object.assign(new Container(), { handleInput, menuKeepsBackspace: true });
    root.addChild(menu);
    slot.open(root);
    mounted().handleInput!('\x7f');
    expect(handleInput).toHaveBeenCalledWith('\x7f');
  });

  it('dismisses the loading row on any key and hands that key to the prompt', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    const typed = vi.fn();
    editor.handleInput = typed;
    slot.showLoadingWhile('models', new Promise(() => {}));
    vi.advanceTimersByTime(150);
    expect(mounted()).not.toBe(editor);
    mounted().handleInput!('\x03');
    expect(mounted()).toBe(editor);
    expect(typed).toHaveBeenCalledWith('\x03');
  });

  it('decodes Kitty keyboard printable keys when filtering', () => {
    const { slot, mounted } = setup();
    slot.open(list(['Low', 'High']));
    mounted().handleInput!('\x1b[104u');
    expect(plain(mounted().render(60)).some(row => row.includes('→ High'))).toBe(true);
  });

  it('leaves typing to menus that use letters as shortcuts', () => {
    const { slot, mounted } = setup();
    const handleInput = vi.fn();
    slot.open({
      render: () => ['row'],
      invalidate: () => {},
      handleInput,
      menuFilterTarget: () => undefined,
    } as Component);
    mounted().handleInput!('d');
    mounted().handleInput!('\x7f');
    expect(handleInput.mock.calls.map(call => call[0])).toEqual(['d', '\x7f']);
  });

  it('shows menu-specific key hints as keycaps under the menu', () => {
    const { slot, mounted } = setup();
    slot.open(list(['One']), { hints: [{ key: 'tab', label: 'clone active thread' }] });
    expect(plain(mounted().render(60)).some(row => /tab\s+clone active thread/.test(row))).toBe(true);
  });

  it('titles a settings submenu with a breadcrumb and filters the submenu list', () => {
    const { slot, mounted } = setup();
    const settings = new SettingsMenu(
      [
        {
          id: 'notifications',
          label: 'Notifications',
          currentValue: 'Off',
          submenu: (_value, done) => {
            const options = list(['Off', 'Bell', 'System']);
            options.onCancel = () => done();
            return options;
          },
        },
      ],
      10,
      () => {},
      () => {},
    );
    const root = Object.assign(new Container(), {
      menuTitle: () =>
        settings.openSubmenuLabel() ? `settings › ${settings.openSubmenuLabel()!.toLowerCase()}` : undefined,
      handleInput: (data: string) => settings.handleInput(data),
    });
    root.addChild(settings);
    slot.open(root);
    const frame = mounted();

    frame.handleInput!('\r');
    expect(plain(frame.render(60)).some(row => row.includes('settings › notifications'))).toBe(true);
    for (const ch of 'sys') frame.handleInput!(ch);
    expect(plain(frame.render(60)).some(row => row.includes('→ System'))).toBe(true);

    // Clearing the search and pressing Backspace again returns to the settings list.
    for (let i = 0; i < 4; i++) frame.handleInput!('\x7f');
    expect(settings.openSubmenuLabel()).toBeUndefined();
    expect(plain(frame.render(60)).some(row => row.includes('→ Notifications'))).toBe(true);
  });

  it('brings back the settings search after leaving a submenu', () => {
    const { slot, mounted } = setup();
    const settings = new SettingsMenu(
      [
        { id: 'yolo', label: 'YOLO mode', currentValue: 'On', values: ['On', 'Off'] },
        {
          id: 'notifications',
          label: 'Notifications',
          currentValue: 'Off',
          submenu: (_value, done) => Object.assign(list(['Off', 'Bell']), { onCancel: () => done() }),
        },
      ],
      10,
      () => {},
      () => {},
    );
    const root = Object.assign(new Container(), { handleInput: (data: string) => settings.handleInput(data) });
    root.addChild(settings);
    slot.open(root);
    const frame = mounted();

    for (const ch of 'notif') frame.handleInput!(ch);
    frame.handleInput!('\r');
    frame.handleInput!('\x1b');
    const rows = plain(frame.render(60));
    expect(rows.some(row => row.includes('notif'))).toBe(true);
    expect(rows.some(row => row.includes('YOLO'))).toBe(false);
    // The search still holds "notif", so Backspace edits it instead of closing settings.
    frame.handleInput!('\x7f');
    expect(plain(frame.render(60)).some(row => row.includes('noti'))).toBe(true);
  });

  it('shows a loading row while a slow menu command prepares, and the menu replaces it', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    let finish!: () => void;
    const pending = new Promise<void>(resolve => (finish = resolve));

    slot.showLoadingWhile('models', pending);
    expect(mounted()).toBe(editor);
    vi.advanceTimersByTime(150);
    expect(plain(mounted().render(60)).some(row => row.includes('loading models…'))).toBe(true);

    slot.open(list(['Custom']), { title: 'Switch model pack' });
    expect(plain(mounted().render(60)).some(row => row.includes('switch model pack'))).toBe(true);
    finish();
    await vi.runAllTimersAsync();
    expect(plain(mounted().render(60)).some(row => row.includes('switch model pack'))).toBe(true);
  });

  it('cancels a menu that opens after Esc dismissed its loading row', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    let finish!: () => void;
    const pending = new Promise<void>(resolve => (finish = resolve));
    slot.showLoadingWhile('om', pending);
    vi.advanceTimersByTime(150);
    mounted().handleInput!('\x1b');
    expect(mounted()).toBe(editor);

    const onCancel = vi.fn();
    const menu = list(['Observer model'], onCancel);
    menu.onCancel = () => {
      onCancel();
      slot.closeTop();
    };
    slot.open(menu, { title: 'Observational memory settings' });
    await Promise.resolve();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mounted()).toBe(editor);
    finish();
  });

  it('removes the loading row when the command fails, without an unhandled rejection', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      let fail!: (error: Error) => void;
      const pending = new Promise<void>((_, reject) => (fail = reject));
      pending.catch(() => {});
      slot.showLoadingWhile('models', pending);
      vi.advanceTimersByTime(150);
      expect(mounted()).not.toBe(editor);
      fail(new Error('offline'));
      await vi.runAllTimersAsync();
      vi.useRealTimers();
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mounted()).toBe(editor);
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
  });

  it('passes Space to menus that toggle with it, also while searching', () => {
    const { slot, mounted } = setup();
    const menu = list(['One', 'Two']);
    const handleInput = vi.fn();
    const root = Object.assign(new Container(), { handleInput, menuKeepsSpace: true });
    root.addChild(menu);
    slot.open(root);
    mounted().handleInput!('o');
    mounted().handleInput!(' ');
    expect(handleInput).toHaveBeenCalledWith(' ');
  });

  it('shows no loading row when the menu opens quickly', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    slot.showLoadingWhile('think', Promise.resolve());
    await vi.runAllTimersAsync();
    expect(mounted()).toBe(editor);
  });
});
