// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimeInput } from './time-input';

const clock = (container: HTMLElement) => container.querySelector('button') as HTMLButtonElement;

describe('TimeInput', () => {
  afterEach(() => {
    delete (HTMLInputElement.prototype as Partial<HTMLInputElement>).showPicker;
  });

  it('opens the native picker from the clock and focuses the field', () => {
    const showPicker = vi.fn();
    HTMLInputElement.prototype.showPicker = showPicker;
    const { container } = render(<TimeInput aria-label="Time" />);

    fireEvent.click(clock(container));

    expect(showPicker).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByLabelText('Time'));
  });

  it('still focuses the field when the browser has no time picker', () => {
    HTMLInputElement.prototype.showPicker = () => {
      throw new DOMException('not supported', 'NotSupportedError');
    };
    const { container } = render(<TimeInput aria-label="Time" />);

    fireEvent.click(clock(container));

    expect(document.activeElement).toBe(screen.getByLabelText('Time'));
  });

  it('forwards the ref and disables the clock with the field', () => {
    const ref = createRef<HTMLInputElement>();
    const { container } = render(<TimeInput ref={ref} aria-label="Time" disabled />);

    expect(ref.current).toBe(screen.getByLabelText('Time'));
    expect(ref.current?.type).toBe('time');
    expect(clock(container).disabled).toBe(true);
  });
});
