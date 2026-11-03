import { describe, expect, it } from 'vitest';
import { edgeOffsets, rimToRim } from './edgeOffsets';

const edge = (id: string, source: string, target: string) => ({ id, source, target });
const slot = (offsets: ReturnType<typeof edgeOffsets>, id: string) => {
  const found = offsets.get(id);
  if (!found) throw new Error(`no offset for ${id}`);
  return found;
};
const a = { x: 0, y: 0, r: 20 };
const b = { x: 200, y: 0, r: 20 };

describe('edgeOffsets', () => {
  it('leaves a one-way edge on the centre line', () => {
    expect(slot(edgeOffsets([edge('e1', 'a', 'b')]), 'e1')).toEqual({ offset: 0, reversed: false });
  });

  it('gives a two-way pair offsets of opposite sign, a few pixels each', () => {
    const offsets = edgeOffsets([edge('out', 'a', 'b'), edge('in', 'b', 'a')]);
    const out = slot(offsets, 'out');
    const back = slot(offsets, 'in');
    expect(out.offset).not.toBe(0);
    expect(Math.sign(out.offset)).toBe(-Math.sign(back.offset));
    expect(Math.abs(out.offset)).toBeGreaterThanOrEqual(4);
    expect(Math.abs(out.offset)).toBeLessThanOrEqual(6);
  });

  it('spreads several edges between the same pair, whatever their kind', () => {
    const offsets = edgeOffsets([edge('p', 'a', 'b'), edge('n', 'a', 'b'), edge('g', 'b', 'a')]);
    const values = ['p', 'n', 'g'].map(id => slot(offsets, id).offset);
    expect(new Set(values).size).toBe(3);
  });

  it('does not touch an edge between a different pair', () => {
    const offsets = edgeOffsets([edge('out', 'a', 'b'), edge('in', 'b', 'a'), edge('other', 'a', 'c')]);
    expect(slot(offsets, 'other').offset).toBe(0);
  });
});

describe('rimToRim', () => {
  it('draws a two-way pair as parallel lines on opposite sides, ends on the circle rims', () => {
    const offsets = edgeOffsets([edge('out', 'a', 'b'), edge('in', 'b', 'a')]);
    const out = rimToRim(a, b, offsets.get('out'));
    const back = rimToRim(b, a, offsets.get('in'));
    expect(out.y1).toBeCloseTo(out.y2);
    expect(back.y1).toBeCloseTo(back.y2);
    expect(out.y1).not.toBeCloseTo(back.y1);
    expect(Math.abs(out.y1 - back.y1)).toBeGreaterThanOrEqual(8);
    expect(Math.hypot(out.x1 - a.x, out.y1 - a.y)).toBeCloseTo(a.r + 3);
    expect(Math.hypot(out.x2 - b.x, out.y2 - b.y)).toBeCloseTo(b.r + 3);
  });

  it('keeps a one-way edge on the centre line', () => {
    const line = rimToRim(a, b, { offset: 0, reversed: false });
    expect(line).toEqual({ x1: 23, y1: 0, x2: 177, y2: 0 });
  });
});
