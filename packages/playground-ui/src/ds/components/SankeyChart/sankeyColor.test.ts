import { describe, expect, it } from 'vitest';

import { buildSankeyColorMap, sankeySeriesColors } from './sankeyColor';
import { hashLabel } from '@/lib/colors';

describe('buildSankeyColorMap', () => {
  const labels = ['Search', 'Referral', 'Partner', 'Europe', 'North America', 'Asia Pacific', 'Won', 'Lost'];

  it('hashes labels stably', () => {
    expect(hashLabel('Europe')).toBe(hashLabel('Europe'));
    expect(hashLabel('Europe')).not.toBe(hashLabel('Lost'));
  });

  it('gives every label a chart series token', () => {
    const colors = buildSankeyColorMap(labels);
    for (const label of labels) expect(sankeySeriesColors).toContain(colors[label]);
  });

  it('keeps other labels colors when one label is removed', () => {
    const colors = buildSankeyColorMap(labels);
    const withoutEurope = buildSankeyColorMap(labels.filter(label => label !== 'Europe'));
    for (const label of labels.filter(label => label !== 'Europe')) expect(withoutEurope[label]).toBe(colors[label]);
  });

  it('does not depend on input order or duplicates', () => {
    expect(buildSankeyColorMap([...labels, 'Europe'])).toEqual(buildSankeyColorMap(labels.toReversed()));
  });

  it('reuses the series once there are more than eight labels', () => {
    const many = Array.from({ length: 20 }, (_, index) => `label-${index}`);
    expect(new Set(Object.values(buildSankeyColorMap(many))).size).toBe(sankeySeriesColors.length);
  });

  it('returns an empty map for no labels', () => {
    expect(buildSankeyColorMap([])).toEqual({});
  });
});
