// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { Field, FieldLabel } from '../Field';
import {
  InputNumber,
  InputNumberDecrement,
  InputNumberGroup,
  InputNumberIncrement,
  InputNumberInput,
} from './input-number';

afterEach(() => cleanup());

beforeAll(() => {
  if (!('PointerEvent' in window)) Object.defineProperty(window, 'PointerEvent', { value: window.MouseEvent });
});

function Stepper(props: ComponentProps<typeof InputNumber>) {
  return (
    <InputNumber {...props}>
      <InputNumberGroup>
        <InputNumberDecrement />
        <InputNumberInput aria-label="Retries" />
        <InputNumberIncrement />
      </InputNumberGroup>
    </InputNumber>
  );
}

function input() {
  return screen.getByRole('textbox', { name: 'Retries' });
}

describe('InputNumber', () => {
  it('steps the value with the increment and decrement buttons', () => {
    render(<Stepper defaultValue={5} step={2} />);

    fireEvent.click(screen.getByRole('button', { name: 'Increase' }));
    expect(input()).toHaveProperty('value', '7');

    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease' }));
    expect(input()).toHaveProperty('value', '3');
  });

  it('stops stepping at min and max', () => {
    render(<Stepper defaultValue={1} min={0} max={2} />);
    const increase = screen.getByRole('button', { name: 'Increase' });
    const decrease = screen.getByRole('button', { name: 'Decrease' });

    fireEvent.click(increase);
    fireEvent.click(increase);
    expect(input()).toHaveProperty('value', '2');
    expect(increase.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(decrease);
    fireEvent.click(decrease);
    fireEvent.click(decrease);
    expect(input()).toHaveProperty('value', '0');
    expect(decrease.getAttribute('aria-disabled')).toBe('true');
  });

  it('rejects non-numeric characters', () => {
    render(<Stepper defaultValue={4} />);

    fireEvent.change(input(), { target: { value: '4a' } });
    expect(input()).toHaveProperty('value', '4');
  });

  it('clamps a typed value to max on blur', () => {
    render(<Stepper max={10} />);

    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: '42' } });
    fireEvent.blur(input());
    expect(input()).toHaveProperty('value', '10');
  });
});

describe('InputNumber in a Field', () => {
  function FieldStepper(props: ComponentProps<typeof Field>) {
    return (
      <Field {...props}>
        <FieldLabel>Max retries</FieldLabel>
        <InputNumber defaultValue={3}>
          <InputNumberGroup>
            <InputNumberDecrement />
            <InputNumberInput />
            <InputNumberIncrement />
          </InputNumberGroup>
        </InputNumber>
      </Field>
    );
  }

  it('is named by the label, which activates the input', () => {
    render(<FieldStepper />);
    const control = screen.getByRole('textbox', { name: 'Max retries' });
    const label = screen.getByText('Max retries');

    expect(label instanceof HTMLLabelElement && label.control).toBe(control);
  });

  it('reports the Field invalid state', () => {
    render(<FieldStepper invalid />);

    expect(screen.getByRole('textbox', { name: 'Max retries' }).getAttribute('aria-invalid')).toBe('true');
  });

  it('is disabled by a disabled Field', () => {
    render(<FieldStepper disabled />);

    expect(screen.getByRole('textbox', { name: 'Max retries' })).toHaveProperty('disabled', true);
    for (const name of ['Increase', 'Decrease']) {
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
    }
    expect(screen.getByRole('textbox', { name: 'Max retries' })).toHaveProperty('value', '3');
  });
});
