import { describe, expect, it } from 'vitest';
import { dataMax, isWholeData, valueYAxis } from './chart-frame';

const size = { width: 400, height: 240 };
const format = (v: number) => String(v);

describe('valueYAxis', () => {
  it('rounds the axis to just above the data max', () => {
    const axis = valueYAxis({ show: true, size, formatter: format, max: 4.4 });
    expect(axis.props.ticks).toEqual([0, 2.5, 5]);
    expect(axis.props.domain).toEqual([0, 5]);
  });

  it('keeps whole ticks for counts', () => {
    const axis = valueYAxis({ show: true, size, formatter: format, max: 7.2, integer: true });
    expect(axis.props.ticks).toEqual([0, 2, 4, 6, 8]);
  });

  it('lets a fixed domain win over the data max', () => {
    const axis = valueYAxis({ show: true, size, formatter: format, max: 4.4, domain: [0, 1] });
    expect(axis.props.ticks).toBeUndefined();
    expect(axis.props.domain).toEqual([0, 1]);
  });

  it('leaves the axis to Recharts without a max', () => {
    const axis = valueYAxis({ show: true, size, formatter: format });
    expect(axis.props.ticks).toBeUndefined();
    expect(axis.props.domain).toBeUndefined();
  });
});

describe('dataMax', () => {
  const data = [
    { t: 1, a: 2, b: 3, c: null },
    { t: 2, a: 4.5, b: 1, c: Number.NaN },
  ];

  it('takes the largest value under the keys', () => {
    expect(dataMax(data, ['a', 'b', 'c'])).toBe(4.5);
  });

  it('takes the largest row total when stacked', () => {
    expect(dataMax(data, ['a', 'b', 'c'], true)).toBe(5.5);
  });

  it('is 0 with no data', () => {
    expect(dataMax([], ['a'])).toBe(0);
  });
});

describe('isWholeData', () => {
  it('is true when every number is whole, ignoring gaps', () => {
    expect(isWholeData([{ a: 1, b: null }, { a: 40 }], ['a', 'b'])).toBe(true);
  });

  it('is false when any number has a fraction', () => {
    expect(isWholeData([{ a: 1 }, { a: 2.5 }], ['a'])).toBe(false);
  });
});
