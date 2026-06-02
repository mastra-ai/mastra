// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { Checkbox } from './checkbox';

// Base UI's Checkbox synthesizes a PointerEvent on click, which jsdom does not
// implement. Polyfill it with the available MouseEvent constructor.
beforeAll(() => {
  if (typeof window.PointerEvent === 'undefined') {
    window.PointerEvent = window.MouseEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  cleanup();
});

describe('Checkbox', () => {
  it('renders an unchecked checkbox by default', () => {
    render(<Checkbox aria-label="accept" />);

    const checkbox = screen.getByRole('checkbox', { name: 'accept' });
    expect(checkbox).toBeDefined();
    expect(checkbox.getAttribute('aria-checked')).toBe('false');
  });

  it('renders as checked when the controlled `checked` prop is true', () => {
    render(<Checkbox aria-label="accept" checked onCheckedChange={() => {}} />);

    expect(screen.getByRole('checkbox', { name: 'accept' }).getAttribute('aria-checked')).toBe('true');
  });

  it('toggles an uncontrolled checkbox on click', () => {
    render(<Checkbox aria-label="accept" />);

    const checkbox = screen.getByRole('checkbox', { name: 'accept' });
    expect(checkbox.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(checkbox);
    expect(checkbox.getAttribute('aria-checked')).toBe('true');
  });

  it('fires onCheckedChange with the new boolean state', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="accept" onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'accept' }));

    expect(onCheckedChange).toHaveBeenCalledTimes(1);
    expect(onCheckedChange.mock.calls[0][0]).toBe(true);
  });

  it('maps the Radix-style `checked="indeterminate"` value to the indeterminate state', () => {
    render(<Checkbox aria-label="accept" checked="indeterminate" onCheckedChange={() => {}} />);

    expect(screen.getByRole('checkbox', { name: 'accept' }).getAttribute('aria-checked')).toBe('mixed');
  });

  it('does not fire onCheckedChange when disabled', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="accept" disabled onCheckedChange={onCheckedChange} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'accept' }));

    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
