// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select';

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

  it('wires the variant prop through to the button recipe (default = the filled Button default, field-only variants)', () => {
    function renderWithVariant(variant?: 'default' | 'outline' | 'ghost' | 'primary') {
      const utils = render(
        <Select>
          <SelectTrigger {...(variant ? { variant } : {})}>
            <SelectValue placeholder="Pick one" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apple">Apple</SelectItem>
          </SelectContent>
        </Select>,
      );
      const className = screen.getByRole('combobox').className;
      utils.unmount();
      return className;
    }

    expect(renderWithVariant()).toBe(renderWithVariant('default'));
    expect(renderWithVariant('default')).toContain('bg-surface3');
    expect(renderWithVariant('default')).not.toContain('bg-transparent');
    expect(renderWithVariant('primary')).toBe(renderWithVariant('default'));
    expect(renderWithVariant('outline')).toContain('bg-transparent');
    expect(renderWithVariant('outline')).toContain('border-border1');
    expect(renderWithVariant('ghost')).toContain('border-transparent');
  });
});
