import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildSankeyHueMap, hashHue, nodeColor, nodeColorVivid } from './sankeyColor';

const labels = ['Europe', 'North America', 'Asia Pacific', 'Won', 'Lost', 'Search', 'Referral', 'Partner'];

function circularDistance(left: number, right: number) {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
}

type CssStub = { supports?: (property: string, value: string) => boolean };

/** Stubbed rather than deleted, so jsdom's own `CSS` comes back afterwards. */
function stubCss(stub: CssStub) {
  vi.stubGlobal('CSS', stub);
}

describe('Sankey colors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns stable normalized hashes and environment-appropriate colors', () => {
    expect(hashHue('Europe')).toBe(hashHue('Europe'));
    expect(hashHue('Europe')).toBeGreaterThanOrEqual(0);
    expect(hashHue('Europe')).toBeLessThan(360);
    expect(nodeColor(200)).toBe('hsl(200 42% 62%)');
    expect(nodeColorVivid(200)).toBe('hsl(200 55% 68%)');
  });

  it('hashes each label to its own stable hue', () => {
    // Node colors must not drift between sessions, so the hash is pinned.
    expect(Object.fromEntries(labels.map(label => [label, hashHue(label)]))).toEqual({
      Europe: 71,
      'North America': 152,
      'Asia Pacific': 112,
      Won: 271,
      Lost: 75,
      Search: 345,
      Referral: 64,
      Partner: 169,
    });
  });

  it('normalizes hues onto 0–360 in both directions', () => {
    expect(nodeColor(-40)).toBe('hsl(320 42% 62%)');
    expect(nodeColor(400)).toBe('hsl(40 42% 62%)');
    expect(nodeColorVivid(-40)).toBe('hsl(320 55% 68%)');
  });

  it('emits oklch colors when the browser supports the oklch color space', () => {
    stubCss({ supports: (property, value) => property === 'color' && value === 'oklch(62% 0.14 180)' });

    expect(nodeColor(200)).toBe('oklch(68% 0.13 200)');
    expect(nodeColorVivid(200)).toBe('oklch(74% 0.18 200)');
  });

  it('falls back to hsl when the browser reports no oklch support', () => {
    stubCss({ supports: () => false });

    expect(nodeColor(200)).toBe('hsl(200 42% 62%)');
    expect(nodeColorVivid(200)).toBe('hsl(200 55% 68%)');
  });

  it('falls back to hsl when CSS exists but exposes no supports() method', () => {
    stubCss({});

    expect(nodeColor(200)).toBe('hsl(200 42% 62%)');
    expect(nodeColorVivid(200)).toBe('hsl(200 55% 68%)');
  });

  it('falls back to hsl when supports() returns a truthy non-boolean', () => {
    stubCss({ supports: () => 'yes' as unknown as boolean });

    expect(nodeColor(200)).toBe('hsl(200 42% 62%)');
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

  it('nudges crowded labels apart by half the missing distance, symmetrically', () => {
    // Lost (75) and Europe (71) collide; each moves by (26 - 4) / 2 = 11 degrees.
    expect(buildSankeyHueMap(['Europe', 'Lost'])).toEqual({ Europe: 60, Lost: 86 });
  });

  it('leaves labels untouched once they are exactly the minimum distance apart', () => {
    expect(buildSankeyHueMap(['Europe', 'Asia Pacific'])).toEqual({ Europe: 71, 'Asia Pacific': 112 });
  });

  it('assigns a stable hue map for the whole label set', () => {
    expect(buildSankeyHueMap(labels)).toEqual({
      Referral: 41.5,
      Lost: 67.5,
      Europe: 93.5,
      'Asia Pacific': 119.5,
      'North America': 147.5,
      Partner: 173.5,
      Won: 271,
      Search: 345,
    });
  });

  it('converges to a stable layout when more labels than fit are requested', () => {
    // 20 labels cannot all be 26 degrees apart, so relaxation runs to its
    // iteration ceiling; the result must still be deterministic.
    const many = Array.from({ length: 20 }, (_, index) => `signal-${index}`);

    expect(buildSankeyHueMap(many)).toEqual({
      'signal-19': 11.394544214902794,
      'signal-13': 23.290840949664073,
      'signal-11': 42.23880295113594,
      'signal-17': 61.18653298728657,
      'signal-8': 80.13400110382179,
      'signal-4': 99.08120583588345,
      'signal-15': 118.02817334847185,
      'signal-3': 136.974953777858,
      'signal-7': 155.92161523607717,
      'signal-1': 174.86823616235233,
      'signal-12': 193.81489685222482,
      'signal-10': 212.76167105443528,
      'signal-18': 231.70861849341634,
      'signal-9': 250.65577905714076,
      'signal-5': 269.60316920002435,
      'signal-16': 288.55078086958406,
      'signal-14': 307.4985829992527,
      'signal-2': 326.44652534578904,
      'signal-0': 352.44652534578904,
      'signal-6': 345.3945442149028,
    });
  });

  it('returns an empty map for no labels', () => {
    expect(buildSankeyHueMap([])).toEqual({});
  });
});
