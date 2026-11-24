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
    ['⌘K', ['Command'], '⌘ K'],
    ['⌘ K', ['Command'], '⌘ K'],
    ['⇧⌘P', ['Shift', 'Command'], '⇧ ⌘ P'],
    ['⇧ ⌘ P', ['Shift', 'Command'], '⇧ ⌘ P'],
    ['⌘↵', ['Command', 'Enter'], '⌘ ↵'],
    ['Ctrl ↵', ['Enter'], 'Ctrl ↵'],
    ['↑', ['Up arrow'], '↑'],
  ])('draws the symbols in %s, one space apart', (shortcut, names, text) => {
    const { container } = render(<Kbd>{shortcut}</Kbd>);

    expect(drawn(container)).toEqual(names);
    expect(container.textContent).toBe(text);
  });

  it.each(['K', 'Ctrl K', 'Ctrl+P', 'Esc', 'Enter', '[', '{', '/', '?'])('leaves %s as plain text', shortcut => {
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

    expect(screen.getByRole('button', { name: /Apply\s+Command\s+Enter/ })).toBeTruthy();
  });

  it('spaces a label split by a JSX expression the same', () => {
    const key = 'K';
    const { container } = render(
      <CommandShortcut>
        ⌘{key} <Kbd>⌘{key}</Kbd>
      </CommandShortcut>,
    );

    expect(container.textContent).toBe('⌘ K ⌘ K');
  });

  it('draws symbols next to elements, keeping the space between them', () => {
    const { container } = render(
      <CommandShortcut>
        ⌘K <Kbd>↵</Kbd> <Kbd>Esc</Kbd>
      </CommandShortcut>,
    );

    expect(drawn(container)).toEqual(['Command', 'Enter']);
    expect(container.textContent).toBe('⌘ K ↵ Esc');
  });

  it('draws every known symbol', () => {
    const symbols = Object.keys(keySymbols);
    const { container } = render(<Kbd>{symbols.join('')}</Kbd>);

    expect(drawn(container)).toEqual(symbols.map(symbol => keySymbols[symbol]?.name));
  });
});
