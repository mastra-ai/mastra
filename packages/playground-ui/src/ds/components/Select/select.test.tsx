// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select';

// Base UI's Select synthesizes PointerEvents on interaction, which jsdom does
// not implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (window.PointerEvent === undefined) {
    Object.defineProperty(window, 'PointerEvent', { value: window.MouseEvent, configurable: true });
  }
});

afterEach(() => {
  cleanup();
});

function renderSelect(props?: { onValueChange?: (value: string) => void; defaultValue?: string }) {
  return render(
    <Select onValueChange={props?.onValueChange} defaultValue={props?.defaultValue}>
      <SelectTrigger>
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
          <SelectItem value="cherry">Cherry</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>,
  );
}

describe('Select', () => {
  it('renders the trigger with the placeholder when no value is selected', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain('Pick one');
  });

  it('shows the selected value on the trigger for defaultValue', () => {
    renderSelect({ defaultValue: 'banana' });

    expect(screen.getByRole('combobox').textContent).toContain('Banana');
  });

  it('opens the popup and renders all items when the trigger is clicked', async () => {
    renderSelect();

    fireEvent.click(screen.getByRole('combobox'));

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Apple' })).toBeTruthy();
    });
    expect(screen.getByRole('option', { name: 'Banana' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Cherry' })).toBeTruthy();
  });

  it('accepts Base UI positioning props through SelectContent', async () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger
          alignOffset={4}
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          positionMethod="fixed"
          sticky
        >
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );

    fireEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByRole('option', { name: 'Apple' })).toBeTruthy();
  });

  it('selects an item and fires onValueChange with the selected value', async () => {
    const onValueChange = vi.fn();
    renderSelect({ onValueChange });

    fireEvent.click(screen.getByRole('combobox'));

    const banana = await screen.findByRole('option', { name: 'Banana' });
    // Base UI's Select item only commits a "real mouse" click that was
    // preceded by a pointerdown on the item itself.
    fireEvent.pointerDown(banana, { pointerType: 'mouse' });
    fireEvent.click(banana, { detail: 1 });

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
    expect(onValueChange.mock.calls[0][0]).toBe('banana');
    // The Base UI migration adds a second `eventDetails` argument — guard the contract.
    expect(onValueChange.mock.calls[0][1]).toBeDefined();

    // Trigger reflects the new selection.
    await waitFor(() => {
      expect(screen.getByRole('combobox').textContent).toContain('Banana');
    });
  });

  it('forwards className to the trigger', () => {
    render(
      <Select>
        <SelectTrigger className="custom-trigger">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox').classList.contains('custom-trigger')).toBe(true);
  });

  it('composes the Button recipe on the trigger (unified text size + border focus)', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox');
    // The trigger inherits the button-native text size (`text-ui-smd`) for
    // its default size.
    expect(trigger.classList.contains('text-ui-smd')).toBe(true);
    expect(trigger.classList.contains('text-ui-md')).toBe(false);
    // Focus is the unified neutral border (from `buttonVariants`), not the old
    // bespoke `focus-visible:border-border2`.
    expect(trigger.className).toContain('focus-visible:border-neutral5/50');
  });

  it('uses the Input overlay surface (not the Button surface) for the default variant', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox');
    expect(trigger.classList.contains('bg-surface-overlay-soft')).toBe(true);
    expect(trigger.classList.contains('border-border1')).toBe(true);
    expect(trigger.classList.contains('text-neutral6')).toBe(true);
    expect(trigger.classList.contains('data-[placeholder]:text-neutral2')).toBe(true);
    expect(trigger.classList.contains('data-[popup-open]:bg-surface-overlay-strong')).toBe(true);
    expect(trigger.className).not.toContain('button-default');

    const chevron = trigger.querySelector('svg');
    expect(chevron?.classList.contains('text-neutral3')).toBe(true);
    expect(chevron?.className.baseVal).not.toContain('opacity');
  });

  it('keeps the outline and ghost variants on the Button recipe', () => {
    render(
      <>
        <Select>
          <SelectTrigger variant="outline" aria-label="outline">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
        <Select>
          <SelectTrigger variant="ghost" aria-label="ghost">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );

    const outline = screen.getByRole('combobox', { name: 'outline' });
    expect(outline.classList.contains('bg-surface3')).toBe(true);
    expect(outline.classList.contains('bg-surface-overlay-soft')).toBe(false);

    const ghost = screen.getByRole('combobox', { name: 'ghost' });
    expect(ghost.classList.contains('bg-transparent')).toBe(true);
    expect(ghost.classList.contains('bg-surface-overlay-soft')).toBe(false);
  });
});
