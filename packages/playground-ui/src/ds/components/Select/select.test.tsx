// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select';

// Base UI's Select synthesizes PointerEvents on interaction, which jsdom does
// not implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
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

  it('accepts the legacy size and variant props on the trigger without throwing', () => {
    expect(() =>
      render(
        <Select>
          <SelectTrigger size="sm" variant="ghost">
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>,
      ),
    ).not.toThrow();
  });
});
