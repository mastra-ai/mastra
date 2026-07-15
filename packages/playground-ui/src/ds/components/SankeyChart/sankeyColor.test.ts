import { describe, expect, it } from 'vitest';

import { buildSankeyHueMap, hashHue, nodeColor, nodeColorVivid } from './sankeyColor';

const labels = ['Europe', 'North America', 'Asia Pacific', 'Won', 'Lost', 'Search', 'Referral', 'Partner'];

function circularDistance(left: number, right: number) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

describe('Sankey colors', () => {
  it('returns stable normalized hashes and environment-appropriate colors', () => {
    expect(hashHue('Europe')).toBe(hashHue('Europe'));
    expect(hashHue('Europe')).toBeGreaterThanOrEqual(0);
    expect(hashHue('Europe')).toBeLessThan(360);
    expect(nodeColor(200)).toBe('hsl(200 42% 62%)');
    expect(nodeColorVivid(200)).toBe('hsl(200 55% 68%)');
  });

  it('deterministically separates runtime labels by at least 26 degrees', () => {
    const hues = buildSankeyHueMap([...labels, 'Europe']);
    const repeated = buildSankeyHueMap(labels.toReversed());

    expect(hues).toEqual(repeated);
    expect(Object.keys(hues)).toHaveLength(labels.length);

    const values = Object.values(hues);
    for (let leftIndex = 0; leftIndex < values.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < values.length; rightIndex += 1) {
        const left = values[leftIndex];
        const right = values[rightIndex];
        if (left === undefined || right === undefined) continue;
        expect(circularDistance(left, right)).toBeGreaterThanOrEqual(26);
      }
    }
  });
});
