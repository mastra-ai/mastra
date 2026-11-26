import { Container, visibleWidth } from '@earendil-works/pi-tui';
import type { Component, Terminal } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MenuList } from '../components/menu-list.js';
import { SettingsMenu } from '../components/settings-menu.js';
import { TextInput } from '../components/text-input.js';
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

/** A menu command whose menu opens once `load()` is called, like /models waiting on its list. */
function slowMenuCommand(slot: PromptSlot, name: string, menu: Component, chrome?: { title?: string }) {
  let loaded!: () => void;
  const data = new Promise<void>(resolve => (loaded = resolve));
  void slot.runMenuCommand(name, async () => {
    await data;
    slot.open(menu, chrome);
    await new Promise(() => {});
  });
  return {
    load: async () => {
      loaded();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    },
  };
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

  it('keeps control characters of a paste out of the search', () => {
    const { slot, mounted } = setup();
    slot.open(list(['ab c de', 'other']));
    const frame = mounted();
    frame.handleInput!('\x1b[200~a\x1b[31mb\tc\nd\x07e\x1b[0m\x1b[201~');
    expect(frame.render(60).join('\n')).not.toMatch(/\x1b\[31m|\x07\w/);
    expect(plain(frame.render(60)).some(row => row.includes('→ ab c de'))).toBe(true);
  });

  it('keeps every row inside the terminal when colored text is pasted into a field and edited', () => {
    const { slot, mounted } = setup();
    const input = new TextInput();
    slot.open(input, { title: 'Name this custom pack' });
    const frame = mounted();
    frame.handleInput!('\x1b[200~\x1b[31mred\x1b[0m\x1b[201~');
    for (const key of ['\x7f', 'é', '\x1b[200~' + 'x'.repeat(300) + '\x1b[201~']) {
      frame.handleInput!(key);
      for (const row of frame.render(40)) expect(visibleWidth(row)).toBeLessThanOrEqual(40);
    }
    expect(input.getValue()).toBe('reé' + 'x'.repeat(300));
  });

  it('deletes a whole emoji, a word, or the whole search', () => {
    const { slot, mounted } = setup();
    slot.open(list(['One']));
    const frame = mounted();
    const search = () => plain(frame.render(60))[1]!.trim();
    for (const key of ['a', '👩‍👩‍👧']) frame.handleInput!(key);
    frame.handleInput!('\x7f');
    expect(search()).toBe('› a');
    for (const key of ' big query') frame.handleInput!(key);
    frame.handleInput!('\x17');
    expect(search()).toBe('› a big');
    frame.handleInput!('\x15');
    expect(search()).toBe('›  search');
  });

  it('shows the end of a search longer than the row, with the text cursor', () => {
    const { slot, mounted } = setup();
    slot.open(list(['One']));
    const frame = mounted();
    frame.handleInput!('\x1b[200~' + 'long-'.repeat(30) + 'end\x1b[201~');
    const row = frame.render(40)[1]!;
    expect(plain([row])[0]).toMatch(/^ › ….*-end$/);
    expect(row).toContain('\x1b[7m');
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

  it('hands keys typed while a menu loads to the menu once it opens', async () => {
    vi.useFakeTimers();
    const { slot, mounted } = setup();
    const onSelect = vi.fn();
    const menu = list(['Low', 'High', 'Extra high']);
    menu.onSelect = onSelect;
    const command = slowMenuCommand(slot, 'think', menu, { title: 'Thinking level' });
    vi.advanceTimersByTime(150);
    for (const ch of 'xh') mounted().handleInput!(ch);
    await command.load();
    expect(plain(mounted().render(60)).some(row => row.includes('→ Extra high'))).toBe(true);
    mounted().handleInput!('\r');
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'Extra high' }));
  });

  it('stops replaying typed-ahead keys once one of them opened another menu', async () => {
    vi.useFakeTimers();
    const { slot, mounted } = setup();
    const providers = list(['One', 'Two']);
    const opened = vi.fn();
    providers.onSelect = item => {
      opened(item.value);
      slot.open(list(['Dialog']), { title: 'API key' });
    };
    const command = slowMenuCommand(slot, 'api-keys', providers);
    vi.advanceTimersByTime(150);
    mounted().handleInput!('\r');
    mounted().handleInput!('\r');
    await command.load();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(plain(mounted().render(60)).some(row => row.includes('API key'))).toBe(true);
  });

  it('Ctrl+C on the loading row stops waiting and goes to the prompt', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    const typed = vi.fn();
    editor.handleInput = typed;
    void slot.runMenuCommand('models', () => new Promise(() => {}));
    vi.advanceTimersByTime(150);
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
    const command = slowMenuCommand(slot, 'models', list(['Custom']), { title: 'Switch model pack' });
    expect(mounted()).toBe(editor);
    vi.advanceTimersByTime(150);
    expect(plain(mounted().render(60)).some(row => row.includes('loading models…'))).toBe(true);

    await command.load();
    expect(plain(mounted().render(60)).some(row => row.includes('switch model pack'))).toBe(true);
    await vi.runAllTimersAsync();
    expect(plain(mounted().render(60)).some(row => row.includes('switch model pack'))).toBe(true);
  });

  it('cancels a menu that opens after Esc dismissed its loading row', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    const onCancel = vi.fn();
    const menu = list(['Observer model']);
    menu.onCancel = () => {
      onCancel();
      slot.closeTop();
    };
    const command = slowMenuCommand(slot, 'om', menu, { title: 'Observational memory settings' });
    vi.advanceTimersByTime(150);
    mounted().handleInput!('\x1b');
    expect(mounted()).toBe(editor);

    await command.load();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mounted()).toBe(editor);
  });

  it('cancels only the menu of the command whose loading row Esc dismissed, not the next one opened', async () => {
    vi.useFakeTimers();
    const { slot, mounted } = setup();
    const packs = list(['Custom']);
    packs.onCancel = vi.fn(() => void slot.closeTop());
    const models = slowMenuCommand(slot, 'models', packs);
    vi.advanceTimersByTime(150);
    mounted().handleInput!('\x1b');

    const onSettingsCancel = vi.fn();
    await slot.runMenuCommand('settings', async () => {
      slot.open(list(['Notifications'], onSettingsCancel), { title: 'Settings' });
    });
    const settings = mounted();
    await vi.advanceTimersByTimeAsync(10);
    expect(onSettingsCancel).not.toHaveBeenCalled();
    expect(mounted()).toBe(settings);

    // The models list arrives later: its menu is cancelled and settings stays open.
    await models.load();
    expect(packs.onCancel).toHaveBeenCalledTimes(1);
    expect(onSettingsCancel).not.toHaveBeenCalled();
    expect(mounted()).toBe(settings);
  });

  it('keeps keys typed on a loading row away from a menu something else opens', async () => {
    vi.useFakeTimers();
    const { slot, mounted } = setup();
    const command = slowMenuCommand(slot, 'models', list(['Custom', 'OpenAI']));
    vi.advanceTimersByTime(150);
    mounted().handleInput!('\r');

    const approve = vi.fn();
    const question = list(['Yes', 'No']);
    question.onSelect = approve;
    slot.open(question, { title: 'Allow this?' });
    await vi.advanceTimersByTimeAsync(10);
    expect(approve).not.toHaveBeenCalled();
    slot.closeTop();
    await command.load();
    expect(plain(mounted().render(60)).some(row => row.includes('→ Custom'))).toBe(true);
  });

  it('removes the loading row when the command fails, without an unhandled rejection', async () => {
    vi.useFakeTimers();
    const { slot, mounted, editor } = setup();
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    try {
      let fail!: (error: Error) => void;
      const pending = new Promise<void>((_, reject) => (fail = reject));
      slot.runMenuCommand('models', () => pending).catch(() => {});
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
    void slot.runMenuCommand('think', () => Promise.resolve());
    await vi.runAllTimersAsync();
    expect(mounted()).toBe(editor);
  });
});
