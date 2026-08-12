// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenRate } from './token-rate';

afterEach(() => {
  cleanup();
});

describe('TokenRate', () => {
  it('plots one point per sample, ending at the right edge', () => {
    const { container } = render(<TokenRate history={[10, 20, 40]} tokensPerSec={40} />);

    const points = container.querySelector('polyline')?.getAttribute('points')?.split(' ') ?? [];

    expect(points).toHaveLength(3);
    expect(points[2].startsWith('30,')).toBe(true);
  });

  it('still draws a line when a run has produced a single sample', () => {
    const { container } = render(<TokenRate history={[12]} tokensPerSec={12} />);

    expect(container.querySelector('polyline')?.getAttribute('points')).toBe('0,1.00 30,1.00');
  });

  it('names the rate for assistive tech while the digits stay folded', () => {
    render(<TokenRate history={[10, 42]} tokensPerSec={42} />);

    expect(screen.getByLabelText('42 tokens per second')).not.toBeNull();
  });
});
