// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { PhoneInput } from './phone-input';

beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    Object.defineProperty(window, 'PointerEvent', { configurable: true, value: window.MouseEvent });
  }
});

afterEach(() => {
  cleanup();
});

describe('PhoneInput', () => {
  it('detects the country from a pasted international number and emits E.164', () => {
    const onValueChange = vi.fn();
    render(<PhoneInput aria-label="Phone number" onValueChange={onValueChange} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Phone number' }), {
      target: { value: '+1 646 555 2671' },
    });

    expect(onValueChange).toHaveBeenLastCalledWith('+16465552671');
    expect(screen.getByRole('combobox', { name: 'Country' }).textContent).toBe('United States');
  });

  it('inserts the calling code when a country is picked', async () => {
    render(<PhoneInput aria-label="Phone number" />);

    fireEvent.click(screen.getByRole('combobox', { name: 'Country' }));
    const france = await screen.findByRole('option', { name: /France/ });
    fireEvent.pointerDown(france, { pointerType: 'mouse' });
    fireEvent.click(france, { detail: 1 });

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Phone number' });
    expect(input.value).toBe('+33');
    expect(document.activeElement).toBe(input);
  });
});
