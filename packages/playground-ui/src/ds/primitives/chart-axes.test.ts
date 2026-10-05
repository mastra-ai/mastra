import { describe, expect, it } from 'vitest';
import { chartYTickCount, pickTimeTicks } from './chart-axes';

const HOUR = 3_600_000;
const start = new Date(2026, 9, 5, 14).getTime();
const ts = Array.from({ length: 24 }, (_, i) => start + i * HOUR);
const labels = ts.map(t => {
  const h = new Date(t).getHours();
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
});

describe('pickTimeTicks', () => {
  it('labels round clock hours that fit the width', () => {
    const picked = [...pickTimeTicks(ts, labels, 1400)].map(i => labels[i]);
    expect(picked).toEqual([
      '2 PM',
      '4 PM',
      '6 PM',
      '8 PM',
      '10 PM',
      '12 AM',
      '2 AM',
      '4 AM',
      '6 AM',
      '8 AM',
      '10 AM',
      '12 PM',
    ]);
  });

  it('takes a bigger step when narrow, still on the clock', () => {
    expect([...pickTimeTicks(ts, labels, 500)].map(i => labels[i])).toEqual([
      '4 PM',
      '8 PM',
      '12 AM',
      '4 AM',
      '8 AM',
      '12 PM',
    ]);
    expect([...pickTimeTicks(ts, labels, 400)].map(i => labels[i])).toEqual(['6 PM', '12 AM', '6 AM', '12 PM']);
  });

  it('falls back to the ends for edges or tiny plots', () => {
    expect([...pickTimeTicks(ts, labels, 1400, 'edges')]).toEqual([0, 23]);
    expect([...pickTimeTicks(ts, labels, 120)]).toEqual([0, 23]);
  });

  it('spaces labels evenly without timestamps, ending on the last bucket', () => {
    const picked = [
      ...pickTimeTicks(
        ts.map(() => undefined),
        labels,
        500,
      ),
    ];
    expect(picked).toContain(0);
    expect(picked).toContain(23);
    expect(picked.length).toBeGreaterThanOrEqual(3);
  });
});

describe('chartYTickCount', () => {
  it('stays between 3 and 5', () => {
    expect(chartYTickCount(0)).toBe(3);
    expect(chartYTickCount(120)).toBe(3);
    expect(chartYTickCount(260)).toBe(5);
    expect(chartYTickCount(1000)).toBe(5);
  });
});
