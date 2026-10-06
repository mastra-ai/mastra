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

describe('pickTimeTicks edge cases', () => {
  const series = (count: number, step: number, from = start) =>
    Array.from({ length: count }, (_, i) => from + i * step);
  const clock = (t: number) => {
    const d = new Date(t);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  it('labels sub-hour buckets on round minutes', () => {
    const minutes = series(60, 60_000);
    const picked = [...pickTimeTicks(minutes, minutes.map(clock), 900)].map(i => clock(minutes[i] ?? 0));
    expect(picked.length).toBeGreaterThanOrEqual(3);
    for (const label of picked) expect(Number(label.split(':')[1]) % 5).toBe(0);
  });

  it('puts daily buckets on midnights, a week apart when a month is narrow', () => {
    const days = series(30, 24 * HOUR, new Date(2026, 8, 6).getTime());
    const dayLabels = days.map(t => new Date(t).toDateString());
    const picked = [...pickTimeTicks(days, dayLabels, 500)];
    expect(picked.length).toBeGreaterThanOrEqual(3);
    for (const i of picked) expect(new Date(days[i] ?? 0).getHours()).toBe(0);
  });

  it('spaces buckets longer than a week evenly instead of guessing a grid', () => {
    const months = series(12, 30 * 24 * HOUR);
    const picked = [
      ...pickTimeTicks(
        months,
        months.map(t => new Date(t).toDateString()),
        1400,
      ),
    ];
    expect(picked[0]).toBe(0);
    expect(picked).toContain(11);
  });

  it('handles empty, single and two-bucket series', () => {
    expect([...pickTimeTicks([], [], 800)]).toEqual([]);
    expect([...pickTimeTicks([start], ['2 PM'], 800)]).toEqual([0]);
    expect([...pickTimeTicks([start, start + HOUR], ['2 PM', '3 PM'], 800)]).toEqual([0, 1]);
  });

  it('ignores non-finite timestamps and falls back to even spacing', () => {
    const broken = [...ts.slice(0, 10), Number.NaN, ...ts.slice(11)];
    const picked = [...pickTimeTicks(broken, labels, 800)];
    expect(picked).toContain(0);
    expect(picked).toContain(23);
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
