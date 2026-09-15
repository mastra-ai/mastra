// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select';

// Base UI synthesizes PointerEvents, which this jsdom version does not implement.
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
    // Base UI only commits a mouse click preceded by pointerdown on the same item.
    fireEvent.pointerDown(banana, { pointerType: 'mouse' });
    fireEvent.click(banana, { detail: 1 });

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledTimes(1);
    });
    expect(onValueChange.mock.calls[0][0]).toBe('banana');
    expect(onValueChange.mock.calls[0][1]).toBeDefined();

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

  it('composes the Button recipe on the trigger (unified text size)', () => {
    renderSelect();

    const trigger = screen.getByRole('combobox');
    expect(trigger.classList.contains('text-ui-smd')).toBe(true);
    expect(trigger.classList.contains('text-ui-md')).toBe(false);
  });
});
