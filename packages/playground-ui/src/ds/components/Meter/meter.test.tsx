// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Meter } from './meter';

afterEach(() => {
  cleanup();
});

const segments = (meter: HTMLElement) =>
  Array.from(meter.querySelectorAll<HTMLElement>('[data-slot^="meter-"]')).map(segment => ({
    part: segment.dataset.slot,
    grow: segment.style.getPropertyValue('--meter-share'),
  }));

describe('Meter', () => {
  it('names the meter and reports usage against the allowance', () => {
    render(<Meter value={148} max={360} aria-label="Memory" aria-valuetext="148 of 360 GB-hours" />);

    const meter = screen.getByRole('meter', { name: 'Memory' });
    expect(meter.getAttribute('aria-valuenow')).toBe('148');
    expect(meter.getAttribute('aria-valuemin')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('360');
    expect(meter.getAttribute('aria-valuetext')).toBe('148 of 360 GB-hours');
  });

  it('fills the used share and leaves the rest of the allowance as track', () => {
    render(<Meter value={148} max={360} aria-label="Memory" />);

    const meter = screen.getByRole('meter');
    expect(meter.hasAttribute('data-over')).toBe(false);
    expect(segments(meter)).toEqual([
      { part: 'meter-used', grow: '148' },
      { part: 'meter-rest', grow: '212' },
    ]);
  });

  it('marks usage beyond the allowance in red, sized to how far over it is', () => {
    render(<Meter value={112} max={100} aria-label="vCPU" />);

    const meter = screen.getByRole('meter');
    expect(meter.hasAttribute('data-over')).toBe(true);
    expect(meter.getAttribute('aria-valuenow')).toBe('100');
    expect(segments(meter)).toEqual([
      { part: 'meter-used', grow: '100' },
      { part: 'meter-over', grow: '12' },
    ]);
  });

  it('fills the whole bar at exactly the allowance, with nothing in red', () => {
    render(<Meter value={100} max={100} aria-label="vCPU" />);

    expect(segments(screen.getByRole('meter'))).toEqual([{ part: 'meter-used', grow: '100' }]);
  });

  it.each([
    { max: 0, grow: '1' },
    { max: 360, grow: '360' },
  ])('shows an empty track with an allowance of $max when nothing is used', ({ max, grow }) => {
    render(<Meter value={0} max={max} aria-label="Events" />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe(String(max));
    expect(meter.hasAttribute('data-over')).toBe(false);
    expect(segments(meter)).toEqual([{ part: 'meter-rest', grow }]);
  });

  it('reports usage with no allowance as entirely over the allowance', () => {
    render(<Meter value={12} max={0} aria-label="Events" aria-valuetext="12 events, no allowance" />);

    const meter = screen.getByRole('meter');
    expect(meter.getAttribute('aria-valuenow')).toBe('0');
    expect(meter.getAttribute('aria-valuemax')).toBe('0');
    expect(meter.getAttribute('aria-valuetext')).toBe('12 events, no allowance');
    expect(meter.hasAttribute('data-over')).toBe(true);
    expect(segments(meter)).toEqual([{ part: 'meter-over', grow: '12' }]);
  });

  it('can be named by a visible label', () => {
    render(
      <>
        <span id="egress-label">Egress</span>
        <Meter value={3.4} max={10} aria-labelledby="egress-label" />
      </>,
    );

    expect(screen.getByRole('meter', { name: 'Egress' })).not.toBeNull();
  });
});
