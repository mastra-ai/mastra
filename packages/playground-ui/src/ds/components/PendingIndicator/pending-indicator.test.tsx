// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { PendingIndicator } from './pending-indicator';

afterEach(() => {
  cleanup();
});

describe('PendingIndicator', () => {
  it('renders a single fading dot', () => {
    const { container } = render(<PendingIndicator />);

    const dots = container.querySelectorAll('span');
    expect(dots.length).toBe(1);
    expect(dots[0]?.className).toContain('animate-pulse');
    expect(dots[0]?.className).toContain('rounded-full');
  });

  it('exposes a stable default test id', () => {
    render(<PendingIndicator />);

    expect(screen.getByTestId('pending-indicator')).not.toBeNull();
  });

  it('allows overriding the test id', () => {
    render(<PendingIndicator testId="custom-pending" />);

    expect(screen.getByTestId('custom-pending')).not.toBeNull();
  });

  it('applies the provided className alongside its base classes', () => {
    render(<PendingIndicator className="custom-class" />);

    const el = screen.getByTestId('pending-indicator');
    expect(el.className).toContain('custom-class');
  });
});
