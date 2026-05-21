// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Switch } from './switch';

// Base UI's Switch synthesizes a PointerEvent on click, which jsdom does not
// implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

describe('Switch', () => {
  it('renders a switch without throwing', () => {
    expect(() => render(<Switch aria-label="Toggle" />)).not.toThrow();

    expect(screen.getByRole('switch')).toBeDefined();
  });

  it('reflects the checked state via aria-checked', () => {
    render(<Switch aria-label="Toggle" defaultChecked />);

    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('toggles an uncontrolled switch when clicked', () => {
    render(<Switch aria-label="Toggle" />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(switchEl);
    expect(switchEl.getAttribute('aria-checked')).toBe('true');
  });

  it('fires onCheckedChange with the new value when toggled', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Toggle" onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole('switch'));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0][0]).toBe(true);
  });

  it('does not toggle or fire onCheckedChange when disabled', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Toggle" disabled onCheckedChange={onCheckedChange} />);

    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);

    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(switchEl.getAttribute('aria-checked')).toBe('false');
  });

  it('respects the controlled checked prop', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Toggle" checked onCheckedChange={onCheckedChange} />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(switchEl);
    // Controlled: state only changes if the consumer updates `checked`.
    expect(switchEl.getAttribute('aria-checked')).toBe('true');
    expect(onCheckedChange).toHaveBeenCalledWith(false, expect.anything());
  });

  it('forwards className to the root element', () => {
    render(<Switch aria-label="Toggle" className="custom-switch" />);

    expect(screen.getByRole('switch').classList.contains('custom-switch')).toBe(true);
  });

  it('applies the id to the visible switch control, not a hidden input', () => {
    render(<Switch aria-label="Toggle" id="my-switch" />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl.getAttribute('id')).toBe('my-switch');
    expect(switchEl.tagName).toBe('BUTTON');
  });
});
