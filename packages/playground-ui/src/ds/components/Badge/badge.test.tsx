// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Badge } from './Badge';

afterEach(() => {
  cleanup();
});

describe('Badge', () => {
  it('renders as inline phrasing content and forwards HTML attributes', () => {
    render(<Badge title="Publication status">Published</Badge>);

    const badge = screen.getByText('Published');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('title')).toBe('Publication status');
  });

  it('keeps status indicators decorative', () => {
    const { container } = render(<Badge indicator="pulse">Running</Badge>);

    const badge = screen.getByText('Running');
    expect(badge.hasAttribute('indicator')).toBe(false);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('only animates pulse indicators and keeps their semantic color', () => {
    const { container, rerender } = render(
      <Badge variant="info" indicator="pulse">
        Live
      </Badge>,
    );

    const pulse = container.querySelector('[aria-hidden="true"]');
    expect(pulse?.classList.contains('bg-accent5')).toBe(true);
    expect(pulse?.classList.contains('motion-safe:animate-pulse')).toBe(true);

    rerender(
      <Badge variant="info" indicator="dot">
        Connected
      </Badge>,
    );

    expect(container.querySelector('[aria-hidden="true"]')?.classList.contains('motion-safe:animate-pulse')).toBe(
      false,
    );
  });
});
