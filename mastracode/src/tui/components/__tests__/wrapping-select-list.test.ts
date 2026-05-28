import { visibleWidth } from '@mariozechner/pi-tui';
import type { SelectListTheme } from '@mariozechner/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the keybindings helper so handleInput tests can simulate up/down/enter/esc
// without depending on the real config. The mock recognises a small set of
// sentinel strings the tests pass in directly.
vi.mock('@mariozechner/pi-tui', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getKeybindings: () => ({
      matches: (data: string, key: string) => data === `__${key}__`,
    }),
  };
});

import { WrappingSelectList } from '../wrapping-select-list.js';

const theme: SelectListTheme = {
  selectedPrefix: (s: string) => `[S]${s}`,
  selectedText: (s: string) => `[S]${s}`,
  description: (s: string) => `[D]${s}`,
  scrollInfo: (s: string) => `[I]${s}`,
  noMatch: (s: string) => `[N]${s}`,
};

const items = (...labels: string[]) => labels.map(label => ({ value: label, label }));

describe('WrappingSelectList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders short labels as one row each with the correct prefix', () => {
      const list = new WrappingSelectList(items('Alpha', 'Beta'), 5, theme);
      const lines = list.render(40);
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('[S]→ Alpha'); // first item is selected by default
      expect(lines[1]).toContain('  Beta');
      expect(lines[1]).not.toContain('[S]'); // unselected items are not themed
    });

    it('wraps long labels onto multiple rows with the ↳ continuation marker', () => {
      const longLabel = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor';
      const list = new WrappingSelectList(items(longLabel), 5, theme);
      list.setSelectedIndex(0);
      const lines = list.render(20);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain('→ ');
      lines.slice(1).forEach(row => expect(row).toContain('↳ '));
    });

    it('keeps every rendered row within the requested width', () => {
      // Use a passthrough theme — the styled `theme` mock wraps with visible
      // `[S]` chars to make styling observable, but production themes wrap
      // with invisible ANSI escapes. Width checks need the production shape.
      const passthrough: SelectListTheme = {
        selectedPrefix: s => s,
        selectedText: s => s,
        description: s => s,
        scrollInfo: s => s,
        noMatch: s => s,
      };
      const longLabel = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor';
      const list = new WrappingSelectList(items(longLabel, 'Short'), 5, passthrough);
      const lines = list.render(24);
      lines.forEach(row => expect(visibleWidth(row)).toBeLessThanOrEqual(24));
    });

    it('themes every row of the selected item — including continuation rows', () => {
      const longLabel = 'Lorem ipsum dolor sit amet consectetur adipiscing elit';
      const list = new WrappingSelectList(items(longLabel), 5, theme);
      list.setSelectedIndex(0);
      const lines = list.render(20);
      lines.forEach(row => expect(row).toContain('[S]'));
    });

    it('shows the noMatch message when filter eliminates every item', () => {
      const list = new WrappingSelectList(items('Alpha', 'Beta'), 5, theme);
      list.setFilter('zzz');
      const lines = list.render(30);
      expect(lines).toEqual([expect.stringContaining('[N]')]);
    });

    it('emits the scroll indicator when items exceed maxVisible', () => {
      const list = new WrappingSelectList(items('a', 'b', 'c', 'd', 'e'), 2, theme);
      const lines = list.render(20);
      expect(lines.some(line => line.includes('[I]') && line.includes('1/5'))).toBe(true);
    });
  });

  describe('navigation — arrow keys move item-to-item, not row-to-row', () => {
    it('advances selectedIndex by one item on down arrow, regardless of label height', () => {
      const longLabel = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor';
      const list = new WrappingSelectList(items(longLabel, 'Short'), 5, theme);
      expect(list.getSelectedItem()?.value).toBe(longLabel);
      list.handleInput('__tui.select.down__');
      expect(list.getSelectedItem()?.value).toBe('Short');
    });

    it('wraps to the last item when up arrow is pressed at the first item', () => {
      const list = new WrappingSelectList(items('a', 'b', 'c'), 5, theme);
      list.handleInput('__tui.select.up__');
      expect(list.getSelectedItem()?.value).toBe('c');
    });

    it('wraps to the first item when down arrow is pressed at the last item', () => {
      const list = new WrappingSelectList(items('a', 'b'), 5, theme);
      list.setSelectedIndex(1);
      list.handleInput('__tui.select.down__');
      expect(list.getSelectedItem()?.value).toBe('a');
    });

    it('fires onSelect with the highlighted item on enter', () => {
      const list = new WrappingSelectList(items('a', 'b'), 5, theme);
      list.setSelectedIndex(1);
      const onSelect = vi.fn();
      list.onSelect = onSelect;
      list.handleInput('__tui.select.confirm__');
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'b' }));
    });

    it('fires onCancel on escape', () => {
      const list = new WrappingSelectList(items('a'), 5, theme);
      const onCancel = vi.fn();
      list.onCancel = onCancel;
      list.handleInput('__tui.select.cancel__');
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('fires onSelectionChange after up/down navigation', () => {
      const list = new WrappingSelectList(items('a', 'b'), 5, theme);
      const onSelectionChange = vi.fn();
      list.onSelectionChange = onSelectionChange;
      list.handleInput('__tui.select.down__');
      expect(onSelectionChange).toHaveBeenCalledWith(expect.objectContaining({ value: 'b' }));
    });
  });
});
