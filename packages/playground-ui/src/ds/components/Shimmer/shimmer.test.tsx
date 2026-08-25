// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Shimmer } from './shimmer';

afterEach(() => {
  cleanup();
});

describe('Shimmer', () => {
  it('renders its children', () => {
    render(<Shimmer>Thinking…</Shimmer>);

    expect(screen.getByText('Thinking…')).not.toBeNull();
  });

  it('applies the provided className alongside its base classes', () => {
    render(<Shimmer className="custom-class">Loading</Shimmer>);

    const el = screen.getByText('Loading');
    expect(el.className).toContain('custom-class');
    expect(el.className).toContain('shimmer-text');
  });

  it('lands in place when the work it watches ends, keeping the element it wraps', () => {
    const { rerender } = render(<Shimmer>Running</Shimmer>);
    const sweeping = screen.getByText('Running');

    rerender(<Shimmer active={false}>Running</Shimmer>);

    expect(screen.getByText('Running')).toBe(sweeping);
    expect(sweeping.className).toContain('shimmer-settled');
  });

  it('leaves text that never swept unpainted', () => {
    render(<Shimmer active={false}>Done</Shimmer>);

    expect(screen.getByText('Done').className).not.toContain('shimmer');
  });
});
