import type { SelectItem, SelectListTheme } from '@mariozechner/pi-tui';
import { describe, expect, it, vi } from 'vitest';

import { MultiSelectList } from '../multi-select-list.js';

function makeTheme(): SelectListTheme {
  const identity = (s: string) => s;
  return {
    selectedPrefix: identity,
    selectedText: identity,
    description: identity,
    scrollInfo: identity,
    noMatch: identity,
  };
}

function items(...values: string[]): SelectItem[] {
  return values.map(v => ({ value: v, label: v }));
}

describe('MultiSelectList', () => {
  it('starts with no values toggled', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    expect(list.getToggled()).toEqual([]);
  });

  it('toggles the value under the cursor on Space', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    list.handleInput(' ');
    expect(list.getToggled()).toEqual(['a']);
    list.handleInput(' ');
    expect(list.getToggled()).toEqual([]);
  });

  it('navigates with arrow keys and toggles independently', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    list.handleInput(' ');
    list.handleInput('\x1b[B');
    list.handleInput(' ');
    list.handleInput('\x1b[B');
    list.handleInput(' ');
    expect(list.getToggled()).toEqual(['a', 'b', 'c']);
  });

  it('returns values in items order regardless of selection order', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    list.handleInput('\x1b[B');
    list.handleInput('\x1b[B');
    list.handleInput(' ');
    list.handleInput('\x1b[A');
    list.handleInput(' ');
    list.handleInput('\x1b[A');
    list.handleInput(' ');
    expect(list.getToggled()).toEqual(['a', 'b', 'c']);
  });

  it('submits the toggled values on Enter via onSubmit', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    const onSubmit = vi.fn();
    list.onSubmit = onSubmit;
    list.handleInput(' ');
    list.handleInput('\x1b[B');
    list.handleInput('\x1b[B');
    list.handleInput(' ');
    list.handleInput('\r');
    expect(onSubmit).toHaveBeenCalledWith(['a', 'c']);
  });

  it('submits an empty array when nothing is toggled', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    const onSubmit = vi.fn();
    list.onSubmit = onSubmit;
    list.handleInput('\r');
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it('fires onCancel on Esc', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    const onCancel = vi.fn();
    list.onCancel = onCancel;
    list.handleInput('\x1b');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders empty items with the no-match theme', () => {
    const list = new MultiSelectList([], 5, makeTheme());
    expect(list.render(40)).toEqual(['  No options']);
  });

  it('renders cursor and checkbox markers', () => {
    const list = new MultiSelectList(items('Alpha', 'Beta'), 5, makeTheme());
    list.handleInput(' ');
    const lines = list.render(40);
    expect(lines[0]).toContain('[x] Alpha');
    expect(lines[1]).toContain('[ ] Beta');
    expect(lines[0]).toContain('→ ');
  });

  it('seeds initial toggled values via setToggled', () => {
    const list = new MultiSelectList(items('a', 'b', 'c'), 5, makeTheme());
    list.setToggled(['c']);
    expect(list.getToggled()).toEqual(['c']);
  });
});
