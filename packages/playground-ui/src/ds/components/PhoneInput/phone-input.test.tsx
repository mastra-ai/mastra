// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PhoneInput } from './phone-input';

afterEach(() => {
  cleanup();
});

describe('PhoneInput', () => {
  it('detects the country from a pasted international number and emits E.164', () => {
    const onValueChange = vi.fn();
    render(<PhoneInput aria-label="Phone number" onValueChange={onValueChange} />);

    fireEvent.paste(screen.getByRole('textbox', { name: 'Phone number' }), {
      clipboardData: { getData: () => '+1 646 555 2671' },
    });

    expect(onValueChange).toHaveBeenLastCalledWith('+16465552671');
    expect(screen.getByRole('combobox', { name: 'Country' }).textContent).toBe('United States');
  });
});
