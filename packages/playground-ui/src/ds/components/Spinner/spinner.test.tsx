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

  it('supports the large size variant', () => {
    render(<Spinner size="lg" />);

    const spinner = screen.getByRole('status', { name: 'Loading' });
    expect(spinner.getAttribute('data-size')).toBe('lg');
    expect(spinner.classList.contains('size-8')).toBe(true);
  });

  it('does not add a fill wrapper by default', () => {
    render(<Spinner />);

    expect(document.querySelector('[data-slot="spinner-fill"]')).toBeNull();
  });

  it('centers itself in a full-height wrapper when fill is set', () => {
    render(<Spinner fill />);

    const wrapper = document.querySelector('[data-slot="spinner-fill"]');
    expect(wrapper?.className).toContain('h-full');
    expect(wrapper?.contains(screen.getByRole('status', { name: 'Loading' }))).toBe(true);
  });

  it('merges a caller className with its own', () => {
    render(<Spinner aria-label="Saving" className="size-3" />);

    const spinner = screen.getByRole('status', { name: 'Saving' });
    expect(spinner.classList.contains('spinner')).toBe(true);
    expect(spinner.classList.contains('size-3')).toBe(true);
  });
});
