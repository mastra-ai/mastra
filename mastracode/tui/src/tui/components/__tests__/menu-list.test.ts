import { describe, expect, it, vi } from 'vitest';

import { ListWindow } from '../list-window.js';
import { lowerFirst } from '../menu-chrome.js';
import { MenuList } from '../menu-list.js';

const plain = (lines: string[]) => lines.map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
const DOWN = '\x1b[B';
const UP = '\x1b[A';

describe('ListWindow', () => {
  it('keeps the window still and scrolls only when the cursor reaches an edge', () => {
    const window = new ListWindow();
    expect(window.range(0, 20, 5)).toEqual({ startIndex: 0, endIndex: 5 });
    expect(window.range(4, 20, 5)).toEqual({ startIndex: 0, endIndex: 5 });
    expect(window.range(5, 20, 5)).toEqual({ startIndex: 1, endIndex: 6 });
    expect(window.range(3, 20, 5)).toEqual({ startIndex: 1, endIndex: 6 });
    expect(window.range(0, 20, 5)).toEqual({ startIndex: 0, endIndex: 5 });
    expect(window.range(19, 20, 5)).toEqual({ startIndex: 15, endIndex: 20 });
  });
});

describe('MenuList', () => {
  it('puts descriptions in one column sized to the longest label', () => {
    const list = new MenuList([
      { value: 'a', label: 'Anthropic (Claude Pro/Max)', description: 'unconfigured' },
      { value: 'x', label: 'xAI (Grok)', description: 'unconfigured' },
    ]);
    const rows = plain(list.render(80));
    expect(rows[0]!.indexOf('unconfigured')).toBe(rows[1]!.indexOf('unconfigured'));
    expect(rows[0]).toMatch(/^→ Anthropic/);
    expect(rows[1]).toMatch(/^ {2}xAI/);
  });

  it('wraps around at both ends', () => {
    const onSelect = vi.fn();
    const list = new MenuList(['One', 'Two', 'Three'].map(label => ({ value: label, label })));
    list.onSelect = onSelect;
    list.handleInput(UP);
    list.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'Three' }));
    list.handleInput(DOWN);
    list.handleInput('\r');
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ value: 'One' }));
  });

  it('moves the cursor within a still window and shows the position under it', () => {
    const list = new MenuList(
      Array.from({ length: 10 }, (_, i) => ({ value: String(i), label: `Item ${i}` })),
      4,
    );
    list.handleInput(DOWN);
    list.handleInput(DOWN);
    let rows = plain(list.render(40));
    expect(rows.slice(0, 4)).toEqual(['  Item 0', '  Item 1', '→ Item 2', '  Item 3']);
    expect(rows[4]).toBe('  (3/10)');
    list.handleInput(DOWN);
    list.handleInput(DOWN);
    rows = plain(list.render(40));
    expect(rows.slice(0, 4)).toEqual(['  Item 1', '  Item 2', '  Item 3', '→ Item 4']);
  });

  it('filters by label (fuzzy) and says when nothing matches', () => {
    const list = new MenuList(['none', 'low', 'medium', 'high', 'xhigh'].map(label => ({ value: label, label })));
    list.setFilter('xh');
    expect(plain(list.render(40))).toEqual(['→ xhigh']);
    list.setFilter('zzz');
    expect(plain(list.render(40))).toEqual(['  no matches']);
    list.setFilter('');
    expect(plain(list.render(40))).toHaveLength(5);
  });
});

describe('lowerFirst', () => {
  it('lowercases a sentence-case title but keeps acronyms and names', () => {
    expect(lowerFirst('Select thread')).toBe('select thread');
    expect(lowerFirst('Login to Anthropic (Claude Pro/Max)')).toBe('login to Anthropic (Claude Pro/Max)');
    expect(lowerFirst('API keys')).toBe('API keys');
    expect(lowerFirst('GitHub signals')).toBe('GitHub signals');
  });
});
