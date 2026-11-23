// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Kbd } from './kbd';
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

  it('keeps the space between a label and an element visible', () => {
    const { container } = render(
      <CommandShortcut>
        ⌘K <Kbd>↵</Kbd> <Kbd>Esc</Kbd> K
      </CommandShortcut>,
    );
    const hidden = Array.from(
      container.querySelectorAll<HTMLElement>('[style*="font-size: 0"]'),
      node => node.textContent,
    );

    expect(container.textContent).toBe('⌘K ↵ Esc K');
    expect(hidden).toEqual(['⌘', '↵']);
  });

  it('draws every known symbol', () => {
    const symbols = Object.keys(keySymbols);
    const { container } = render(<Kbd>{symbols.join('')}</Kbd>);

    expect(drawn(container)).toEqual(symbols.map(symbol => keySymbols[symbol]?.name));
  });
});
