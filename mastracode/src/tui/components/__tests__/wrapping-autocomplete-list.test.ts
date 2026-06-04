import { visibleWidth } from '@mariozechner/pi-tui';
import type { SelectItem, SelectListTheme } from '@mariozechner/pi-tui';
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

import { WrappingAutocompleteList } from '../wrapping-autocomplete-list.js';

const theme: SelectListTheme = {
  selectedPrefix: (s: string) => `[S]${s}`,
  selectedText: (s: string) => `[S]${s}`,
  description: (s: string) => `[D]${s}`,
  scrollInfo: (s: string) => `[I]${s}`,
  noMatch: (s: string) => `[N]${s}`,
};

// Passthrough theme: production themes wrap with invisible ANSI escapes, so
// width assertions use this shape rather than the visible `[S]`/`[D]` markers.
const passthrough: SelectListTheme = {
  selectedPrefix: s => s,
  selectedText: s => s,
  description: s => s,
  scrollInfo: s => s,
  noMatch: s => s,
};

const item = (value: string, description?: string): SelectItem => ({ value, label: value, description });

describe('WrappingAutocompleteList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('keeps a short description on a single row', () => {
      const list = new WrappingAutocompleteList([item('new', 'Start a new thread')], 5, theme);
      const lines = list.render(80);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('new');
      expect(lines[0]).toContain('Start a new thread');
    });

    it('wraps a long description across multiple rows instead of truncating it', () => {
      const longDescription =
        'Activate a skill that does many useful things and has a very long description that cannot possibly fit on a single line';
      const list = new WrappingAutocompleteList([item('skill/example', longDescription)], 5, passthrough);
      list.setSelectedIndex(0);

      const lines = list.render(50);

      // More than one row means the description wrapped rather than being clipped.
      expect(lines.length).toBeGreaterThan(1);

      // Every rendered row fits within the requested width.
      lines.forEach(row => expect(visibleWidth(row)).toBeLessThanOrEqual(50));

      // The tail of the description (which truncation would have dropped) is present.
      const combined = lines.join(' ').replace(/\s+/g, ' ');
      expect(combined).toContain('single line');
    });

    it('indents continuation rows under the description column', () => {
      const longDescription = 'word '.repeat(40).trim();
      const list = new WrappingAutocompleteList([item('cmd', longDescription)], 5, passthrough);

      const lines = list.render(50);
      expect(lines.length).toBeGreaterThan(1);

      // Continuation rows start with leading whitespace (aligned under the description column).
      for (let i = 1; i < lines.length; i++) {
        expect(lines[i]).toMatch(/^\s+\S/);
      }
    });

    it('renders an item without a description as a single row', () => {
      const list = new WrappingAutocompleteList([item('exit')], 5, theme);
      const lines = list.render(80);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('exit');
    });

    it('does not split the description column when the width is narrow', () => {
      // At width <= 40, SelectList renders only the primary column; we mirror
      // that so narrow terminals keep the existing single-column behaviour.
      const list = new WrappingAutocompleteList([item('cmd', 'a description here')], 5, passthrough);
      const lines = list.render(30);
      lines.forEach(row => expect(visibleWidth(row)).toBeLessThanOrEqual(30));
    });

    it('shows the noMatch message when the filter eliminates every item', () => {
      const list = new WrappingAutocompleteList([item('alpha'), item('beta')], 5, theme);
      list.setFilter('zzz');
      const lines = list.render(40);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain('[N]');
    });

    it('emits a scroll indicator when items exceed maxVisible', () => {
      const list = new WrappingAutocompleteList([item('a'), item('b'), item('c'), item('d'), item('e')], 2, theme);
      const lines = list.render(40);
      expect(lines.some(line => line.includes('[I]') && line.includes('1/5'))).toBe(true);
    });
  });

  describe('navigation', () => {
    it('advances the selected item by one on down arrow, regardless of description height', () => {
      const longDescription = 'word '.repeat(40).trim();
      const list = new WrappingAutocompleteList([item('first', longDescription), item('second')], 5, theme);
      expect(list.getSelectedItem()?.value).toBe('first');

      list.handleInput('__tui.select.down__');
      expect(list.getSelectedItem()?.value).toBe('second');
    });

    it('wraps selection from last to first on down arrow', () => {
      const list = new WrappingAutocompleteList([item('a'), item('b')], 5, theme);
      list.setSelectedIndex(1);
      list.handleInput('__tui.select.down__');
      expect(list.getSelectedItem()?.value).toBe('a');
    });

    it('invokes onSelect with the highlighted item on confirm', () => {
      const list = new WrappingAutocompleteList([item('a'), item('b')], 5, theme);
      const onSelect = vi.fn();
      list.onSelect = onSelect;
      list.setSelectedIndex(1);
      list.handleInput('__tui.select.confirm__');
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ value: 'b' }));
    });

    it('invokes onCancel on cancel', () => {
      const list = new WrappingAutocompleteList([item('a')], 5, theme);
      const onCancel = vi.fn();
      list.onCancel = onCancel;
      list.handleInput('__tui.select.cancel__');
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
