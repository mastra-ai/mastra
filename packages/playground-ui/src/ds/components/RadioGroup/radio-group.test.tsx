// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { RadioGroup, RadioGroupItem } from './radio-group';

// Base UI's Radio synthesizes a PointerEvent on click, which jsdom does not
// implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

describe('RadioGroup', () => {
  it('renders all radio options without throwing', () => {
    expect(() =>
      render(
        <RadioGroup aria-label="Plan">
          <RadioGroupItem value="option-1" aria-label="Option 1" />
          <RadioGroupItem value="option-2" aria-label="Option 2" />
        </RadioGroup>,
      ),
    ).not.toThrow();

    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('reflects the selected value via aria-checked', () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="option-2">
        <RadioGroupItem value="option-1" aria-label="Option 1" />
        <RadioGroupItem value="option-2" aria-label="Option 2" />
      </RadioGroup>,
    );

    expect(screen.getByLabelText('Option 1').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText('Option 2').getAttribute('aria-checked')).toBe('true');
  });

  it('selects an option when clicked', () => {
    render(
      <RadioGroup aria-label="Plan">
        <RadioGroupItem value="option-1" aria-label="Option 1" />
        <RadioGroupItem value="option-2" aria-label="Option 2" />
      </RadioGroup>,
    );

    const optionTwo = screen.getByLabelText('Option 2');
    expect(optionTwo.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(optionTwo);
    expect(optionTwo.getAttribute('aria-checked')).toBe('true');
  });

  it('fires onValueChange with the selected value', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" onValueChange={onValueChange}>
        <RadioGroupItem value="option-1" aria-label="Option 1" />
        <RadioGroupItem value="option-2" aria-label="Option 2" />
      </RadioGroup>,
    );

    fireEvent.click(screen.getByLabelText('Option 2'));

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0][0]).toBe('option-2');
  });

  it('does not select or fire onValueChange when the group is disabled', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" disabled onValueChange={onValueChange}>
        <RadioGroupItem value="option-1" aria-label="Option 1" />
        <RadioGroupItem value="option-2" aria-label="Option 2" />
      </RadioGroup>,
    );

    fireEvent.click(screen.getByLabelText('Option 2'));

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Option 2').getAttribute('aria-checked')).toBe('false');
  });

  it('respects the controlled value prop', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" value="option-1" onValueChange={onValueChange}>
        <RadioGroupItem value="option-1" aria-label="Option 1" />
        <RadioGroupItem value="option-2" aria-label="Option 2" />
      </RadioGroup>,
    );

    fireEvent.click(screen.getByLabelText('Option 2'));

    // Controlled: state only changes if the consumer updates `value`.
    expect(screen.getByLabelText('Option 1').getAttribute('aria-checked')).toBe('true');
    expect(onValueChange).toHaveBeenCalledWith('option-2', expect.anything());
  });

  it('forwards className to the group element', () => {
    render(
      <RadioGroup aria-label="Plan" className="custom-group">
        <RadioGroupItem value="option-1" aria-label="Option 1" />
      </RadioGroup>,
    );

    expect(screen.getByRole('radiogroup').classList.contains('custom-group')).toBe(true);
  });
});
