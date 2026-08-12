// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TokenRate } from './token-rate';

afterEach(() => {
  cleanup();
});

function bars(container: HTMLElement) {
  return [...container.querySelectorAll('rect')].map(bar => ({
    x: Number(bar.getAttribute('x')),
    height: Number(bar.getAttribute('height')),
    y: Number(bar.getAttribute('y')),
  }));
}

describe('TokenRate', () => {
  it('scales height against a fixed ceiling, so a steady rate stays a steady height', () => {
    const { container } = render(<TokenRate history={[60, 60]} tokensPerSec={60} />);
    const [first, second] = bars(container).slice(-2);

    expect(first.height).toBe(6);
    expect(second.height).toBe(6);
  });

  it('keeps the waveform centred on the box', () => {
    const { container } = render(<TokenRate history={[120, 6]} tokensPerSec={6} />);

    for (const bar of bars(container)) {
      expect(bar.y + bar.height / 2).toBe(6);
    }
  });

  it('lands the newest sample at the right edge whatever the run has produced', () => {
    const { container } = render(<TokenRate history={[40]} tokensPerSec={40} />);
    const drawn = bars(container);

    expect(drawn).toHaveLength(6);
    expect(drawn.at(-1)?.x).toBe(15);
    expect(drawn.at(-1)?.height).toBe(4);
  });

  it('holds its width on a baseline before a run has produced anything', () => {
    const { container } = render(<TokenRate history={[]} tokensPerSec={0} />);
    const drawn = bars(container);

    expect(drawn).toHaveLength(6);
    expect(drawn.every(bar => bar.height === 2)).toBe(true);
  });

  it('keeps the rate readable next to the waveform', () => {
    render(<TokenRate history={[10, 42]} tokensPerSec={42} />);

    expect(screen.getByText('42')).not.toBeNull();
    expect(screen.getByText('tok/s')).not.toBeNull();
  });
});
