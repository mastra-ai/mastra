// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Kbd } from './kbd';
import { keyBearings } from './key-bearings';
import { KeyLabel } from './key-label';
import type { KeyFace } from './key-label';
import { keySymbols } from './key-symbols';
import { CommandShortcut } from '@/ds/components/Command';

afterEach(cleanup);

const drawn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[role="img"]'), element => element.getAttribute('aria-label'));

describe('shortcut key symbols', () => {
  it.each([
    ['⌘K', ['Command'], '⌘K'],
    ['⌘ K', ['Command'], '⌘ K'],
    ['⇧⌘P', ['Shift', 'Command'], '⇧⌘P'],
    ['⇧ ⌘ P', ['Shift', 'Command'], '⇧ ⌘ P'],
    ['⌘↵', ['Command', 'Enter'], '⌘↵'],
    ['Ctrl ↵', ['Enter'], 'Ctrl ↵'],
    ['↑', ['Up arrow'], '↑'],
  ])('draws the symbols in %s and keeps its text', (shortcut, names, text) => {
    const { container } = render(<Kbd>{shortcut}</Kbd>);

    expect(drawn(container)).toEqual(names);
    expect(container.textContent).toBe(text);
  });

  // jsdom has no layout: the space between two keys is the first one's trailing side bearing and the second one's margin.
  const gaps = (label: string, face: KeyFace = 'mono') => {
    const { container } = render(<KeyLabel face={face}>{label}</KeyLabel>);
    const keys = Array.from(
      container.querySelectorAll<HTMLElement | SVGElement>('svg, span[style*="margin"]'),
      element => ({
        text: element.textContent ?? '',
        left: parseFloat(element.style.marginLeft) || 0,
        right: parseFloat(element.style.marginRight) || 0,
      }),
    );

    return keys.slice(1).map((key, index) => {
      const previous = keys[index];
      const inkRight = previous?.text
        ? keyBearings[face].right[previous.text.charCodeAt(previous.text.length - 1) - 33]
        : 0;
      const inkLeft = key.text ? keyBearings[face].left[key.text.charCodeAt(0) - 33] : 0;
      return Number(((previous?.right ?? 0) + (inkRight ?? 0) + key.left + (inkLeft ?? 0)).toFixed(3));
    });
  };

  it.each<KeyFace>(['mono', 'monoBold', 'body'])('puts the same gap between any two keys in %s', face => {
    const labels = [
      '⌘K',
      '⌘ K',
      '⌘[',
      '⇧⌘',
      '⌘↵',
      '⇧ ⌘ P',
      'G K',
      'L I',
      'W M',
      'Ctrl K',
      'Ctrl ↵',
      '⌘Enter',
      'Shift Enter',
    ];

    expect(new Set(labels.flatMap(label => gaps(label, face))).size).toBe(1);
    expect(gaps('⇧⌘P', face)).toHaveLength(2);
  });

  it('keeps words unbroken', () => {
    expect(gaps('Esc')).toEqual([]);
    expect(gaps('Ctrl+P')).toEqual([]);
  });

  it.each(['K', 'Ctrl+P', 'Esc', 'Enter', '[', '{', '/', '?'])('leaves %s as plain text', shortcut => {
    const { container } = render(<Kbd>{shortcut}</Kbd>);

    expect(drawn(container)).toEqual([]);
    expect(screen.getByText(shortcut)).toBeTruthy();
  });

  it('names the keys for a screen reader', () => {
    render(
      <button type="button">
        Apply <Kbd>⌘ ↵</Kbd>
      </button>,
    );

    expect(screen.getByRole('button').textContent).toBe('Apply ⌘ ↵');
    expect(screen.getByRole('button', { name: /Apply\s+Command\s*Enter/ })).toBeTruthy();
  });

  it('draws symbols next to elements and in a row without a keycap', () => {
    const { container } = render(
      <CommandShortcut>
        {'⌘'}
        {'K'} <Kbd>↵</Kbd>
      </CommandShortcut>,
    );

    expect(drawn(container)).toEqual(['Command', 'Enter']);
    expect(container.textContent).toBe('⌘K ↵');
  });

  it('draws every known symbol', () => {
    const symbols = Object.keys(keySymbols);
    const { container } = render(<Kbd>{symbols.join('')}</Kbd>);

    expect(drawn(container)).toEqual(symbols.map(symbol => keySymbols[symbol]?.name));
  });
});
