// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command';

if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver;
}

if (typeof globalThis.Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

afterEach(() => {
  cleanup();
});

describe('Command', () => {
  it('closes CommandDialog when Escape is pressed inside the input', async () => {
    const onOpenChange = vi.fn();

    render(
      <CommandDialog open onOpenChange={onOpenChange}>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandGroup heading="Navigation">
            <CommandItem value="settings">Settings</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>,
    );

    fireEvent.keyDown(screen.getByPlaceholderText('Search commands'), {
      key: 'Escape',
      code: 'Escape',
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false, expect.anything());
    });
  });

  it('stops non-Escape key events from leaving CommandDialog', () => {
    const onParentKeyDown = vi.fn();

    render(
      <div onKeyDown={onParentKeyDown}>
        <CommandDialog open onOpenChange={() => {}}>
          <CommandInput placeholder="Search commands" />
          <CommandList>
            <CommandGroup heading="Navigation">
              <CommandItem value="settings">Settings</CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </div>,
    );

    fireEvent.keyDown(screen.getByPlaceholderText('Search commands'), {
      key: 'ArrowDown',
      code: 'ArrowDown',
    });

    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it('renders CommandInput rightSlot without replacing the input', () => {
    render(
      <Command>
        <CommandInput placeholder="Search commands" rightSlot={<span>Esc</span>} />
      </Command>,
    );

    expect(screen.getByPlaceholderText('Search commands')).toBeDefined();
    expect(screen.getByText('Esc')).toBeDefined();
  });

  it('preserves DOM order while filtering matching items', async () => {
    render(
      <CommandDialog open onOpenChange={() => {}}>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            <CommandItem value="beta weather agent">Beta Weather</CommandItem>
            <CommandItem value="alpha weather agent">Alpha Weather</CommandItem>
            <CommandItem value="weather workflow">Weather Workflow</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>,
    );

    fireEvent.change(screen.getByPlaceholderText('Search commands'), {
      target: { value: 'weather agent' },
    });

    const beta = screen.getByText('Beta Weather').closest('[cmdk-item]');
    const alpha = screen.getByText('Alpha Weather').closest('[cmdk-item]');

    await waitFor(() => {
      expect(beta?.hasAttribute('hidden')).toBe(false);
      expect(alpha?.hasAttribute('hidden')).toBe(false);
      expect(screen.queryByText('Weather Workflow')).toBeNull();
    });

    expect(Boolean(beta?.compareDocumentPosition(alpha!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
