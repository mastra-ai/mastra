// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sparkline } from './sparkline';

const points = (container: HTMLElement) =>
  (container.querySelector('polyline')?.getAttribute('points') ?? '').split(' ').map(p => p.split(',').map(Number));

describe('Sparkline', () => {
  afterEach(() => cleanup());

  it('keeps negative and positive values inside the box', () => {
    const { container } = render(<Sparkline values={[-1, 1]} />);
    for (const [, y] of points(container)) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(16);
    }
  });

  it('leaves out values it cannot place', () => {
    const { container } = render(<Sparkline values={[Infinity, 1, Number.NaN, 2]} />);
    const drawn = points(container);
    expect(drawn).toHaveLength(2);
    expect(drawn.flat().every(Number.isFinite)).toBe(true);
  });

  it('draws one value as a flat line', () => {
    const { container } = render(<Sparkline values={[5]} />);
    const drawn = points(container);
    expect(drawn).toHaveLength(2);
    expect(drawn[0][1]).toBe(drawn[1][1]);
    expect(drawn[1][0]).toBeGreaterThan(drawn[0][0]);
  });
});
