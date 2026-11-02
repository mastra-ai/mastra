// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DateTimePicker } from './date-time-picker';

afterEach(cleanup);

function renderPicker(props: Partial<React.ComponentProps<typeof DateTimePicker>> = {}) {
  const onValueChange = vi.fn();
  render(<DateTimePicker value={new Date(2026, 8, 10, 14, 30)} onValueChange={onValueChange} {...props} />);
  fireEvent.click(screen.getByTestId('datepicker-button'));
  return { onValueChange };
}

describe('DateTimePicker', () => {
  it('opens on the value’s time', () => {
    renderPicker();

    expect(screen.getByLabelText<HTMLInputElement>('Time').value).toBe('14:30');
  });

  it('applies the picked day at the time typed in the time field', () => {
    const { onValueChange } = renderPicker();

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '09:15' } });
    fireEvent.click(screen.getByRole('button', { name: /September 22nd, 2026/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onValueChange).toHaveBeenCalledWith(new Date(2026, 8, 22, 9, 15));
  });

  it('offers no Apply while the time field is cleared', () => {
    const { onValueChange } = renderPicker();

    fireEvent.click(screen.getByRole('button', { name: /September 22nd, 2026/ }));
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '' } });

    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('starts an empty picker on the default time', () => {
    renderPicker({ value: undefined, defaultTimeStrValue: '09:00 AM' });

    expect(screen.getByLabelText<HTMLInputElement>('Time').value).toBe('09:00');
  });
});
