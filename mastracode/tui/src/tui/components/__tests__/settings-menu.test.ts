import type { SettingItem } from '@earendil-works/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { MenuList } from '../menu-list.js';
import { SettingsMenu } from '../settings-menu.js';

const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));

function items(): SettingItem[] {
  return [
    { id: 'yolo', label: 'YOLO mode', currentValue: 'On', values: ['On', 'Off'], description: 'Auto-approve tools' },
    { id: 'long', label: 'Experimental cross-agent communication', currentValue: 'Off', values: ['On', 'Off'] },
    {
      id: 'notifications',
      label: 'Notifications',
      currentValue: 'Off',
      submenu: (_value, done) => {
        const list = new MenuList(['Off', 'Bell'].map(label => ({ value: label, label })));
        list.onSelect = item => done(item.value);
        list.onCancel = () => done();
        return list;
      },
    },
  ];
}

describe('SettingsMenu', () => {
  it('lines up every value in one column, even after a long label', () => {
    const rows = plain(
      new SettingsMenu(
        items(),
        10,
        () => {},
        () => {},
      ).render(100),
    );
    const valueColumn = (row: string) => row.search(/(On|Off)$/);
    expect(new Set(rows.slice(0, 3).map(valueColumn)).size).toBe(1);
    expect(rows).toContain('  Auto-approve tools');
  });

  it('changes a value with Enter or Space', () => {
    const onChange = vi.fn();
    const menu = new SettingsMenu(items(), 10, onChange, () => {});
    menu.handleInput(' ');
    expect(onChange).toHaveBeenCalledWith('yolo', 'Off');
    menu.handleInput('\r');
    expect(onChange).toHaveBeenLastCalledWith('yolo', 'On');
  });

  it('opens a submenu, names it, and points typing at its list', () => {
    const onChange = vi.fn();
    const menu = new SettingsMenu(items(), 10, onChange, () => {});
    menu.handleInput('\x1b[A');
    menu.handleInput('\r');
    expect(menu.openSubmenuLabel()).toBe('Notifications');
    expect(menu.menuFilterTarget()).toBeInstanceOf(MenuList);

    menu.handleInput('\x1b[B');
    menu.handleInput('\r');
    expect(onChange).toHaveBeenCalledWith('notifications', 'Bell');
    expect(menu.openSubmenuLabel()).toBeUndefined();
    expect(menu.menuFilterTarget()).toBe(menu);
    expect(plain(menu.render(100))[2]).toMatch(/^→ Notifications\s+Bell$/);
  });

  it('filters settings by label', () => {
    const menu = new SettingsMenu(
      items(),
      10,
      () => {},
      () => {},
    );
    menu.setFilter('notif');
    expect(plain(menu.render(100))[0]).toMatch(/^→ Notifications/);
    expect(plain(menu.render(100))).toHaveLength(1);
  });
});
