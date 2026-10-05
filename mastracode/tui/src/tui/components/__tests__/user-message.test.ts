import { describe, expect, it } from 'vitest';

import { applyThemeMode, getThemeMode } from '../../theme.js';
import { BorderedBox, UserMessageComponent } from '../user-message.js';

/** Child that counts how many times it is rendered. */
function countingChild(lines: string[]) {
  let renders = 0;
  return {
    child: {
      render(_width: number): string[] {
        renders++;
        return lines;
      },
    },
    getRenders: () => renders,
  };
}

describe('BorderedBox render caching', () => {
  it('does not re-render the child on repeated renders at the same width', () => {
    const { child, getRenders } = countingChild(['hello world']);
    const box = new BorderedBox(child);
    const first = box.render(80);
    const second = box.render(80);
    expect(second).toBe(first);
    expect(getRenders()).toBe(1);
  });

  it('recomputes when the width changes and re-caches at the new width', () => {
    const { child, getRenders } = countingChild(['hello world']);
    const box = new BorderedBox(child);
    const wide = box.render(80);
    const narrow = box.render(40);
    expect(narrow).not.toBe(wide);
    expect(getRenders()).toBe(2);
    expect(box.render(40)).toBe(narrow);
    expect(getRenders()).toBe(2);
  });

  it('recomputes after invalidate()', () => {
    const { child, getRenders } = countingChild(['hello world']);
    const box = new BorderedBox(child);
    const first = box.render(80);
    box.invalidate();
    const second = box.render(80);
    expect(second).not.toBe(first);
    expect(second).toEqual(first);
    expect(getRenders()).toBe(2);
  });

  it('recomputes when the theme changes', () => {
    const originalMode = getThemeMode();
    const { child } = countingChild(['hello world']);
    const box = new BorderedBox(child);
    const first = box.render(80);
    try {
      applyThemeMode(originalMode === 'dark' ? 'light' : 'dark');
      const second = box.render(80);
      expect(second).not.toBe(first);
    } finally {
      applyThemeMode(originalMode);
    }
  });
});

describe('UserMessageComponent', () => {
  it('renders the message on a half-block panel with the → marker', () => {
    const component = new UserMessageComponent('fix the bug please');
    const rendered = component.render(80).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(rendered[0]).toBe('▄'.repeat(80));
    expect(rendered[1]).toBe(' → fix the bug please'.padEnd(80));
    expect(rendered[2]).toBe('▀'.repeat(80));
    expect(rendered.join('\n')).not.toContain('╭');
  });

  it('shows a label before the text', () => {
    const component = new UserMessageComponent('also check the docs', undefined, { label: 'steer' });
    const rendered = component.render(80).map(line => line.replace(/\x1b\[[0-9;]*m/g, ''));
    expect(rendered[1]).toContain(' → steer · also check the docs');
  });
});
