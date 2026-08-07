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
    expect(el.className).toContain('text-transparent');
  });

  it('drives the shimmer-text keyframe animation', () => {
    render(<Shimmer>Animate</Shimmer>);

    const el = screen.getByText('Animate');
    expect(el.style.animation).toContain('shimmer-text');
  });
});
