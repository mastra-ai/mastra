// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Spinner } from './spinner';

afterEach(() => {
  cleanup();
});

describe('Spinner', () => {
  it('renders the default spinner with md sizing hooks', () => {
    const { container } = render(<Spinner />);

    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.tagName).toBe('svg');
    expect(spinner.getAttribute('data-size')).toBe('md');
    expect(spinner.getAttribute('data-variant')).toBe('default');
    expect(spinner.classList.contains('size-6')).toBe(true);
    expect(container.querySelector('.spinner-ring')).not.toBeNull();
  });

  it('supports the small size variant', () => {
    render(<Spinner size="sm" />);

    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.getAttribute('data-size')).toBe('sm');
    expect(spinner.classList.contains('size-4')).toBe(true);
    expect(spinner.classList.contains('size-6')).toBe(false);
  });

  it('renders the pulse variant with pulse-specific shapes', () => {
    const { container } = render(<Spinner variant="pulse" />);

    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.getAttribute('data-variant')).toBe('pulse');
    expect(container.querySelector('.spinner-pulse-core')).not.toBeNull();
    expect(container.querySelector('.spinner-pulse-ring')).not.toBeNull();
    expect(container.querySelector('.spinner-ring')).toBeNull();
  });

  it('merges className overrides without adding color props', () => {
    render(<Spinner aria-label="Saving" className="text-neutral3 size-3" />);

    const spinner = screen.getByRole('status', { name: 'Saving' });
    expect(spinner.classList.contains('spinner')).toBe(true);
    expect(spinner.classList.contains('size-3')).toBe(true);
    expect(spinner.classList.contains('text-neutral3')).toBe(true);
  });
});
