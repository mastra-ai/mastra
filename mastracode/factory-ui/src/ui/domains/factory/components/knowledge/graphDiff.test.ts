import { describe, expect, it } from 'vitest';

import { computeArrivals } from './graphDiff';
import { parseFactSegments } from './factText';

function input(viewKey: string, version: string | null, nodeIds: string[], edgeIds: string[] = []) {
  return { viewKey, version, nodeIds: new Set(nodeIds), edgeIds: new Set(edgeIds) };
}

describe('computeArrivals', () => {
  it('reports nothing on the first payload', () => {
    const result = computeArrivals(null, input('project', 'v1', ['a', 'b']));
    expect(result.nodes.size).toBe(0);
  });

  it('diffs new node and edge ids on same-view polls', () => {
    const prev = input('project', 'v1', ['a', 'b'], ['e1']);
    const next = input('project', 'v2', ['a', 'b', 'c'], ['e1', 'e2']);
    const result = computeArrivals(prev, next);
    expect([...result.nodes]).toEqual(['c']);
    expect([...result.edges]).toEqual(['e2']);
  });

  it('short-circuits when the version cursor is unchanged', () => {
    const prev = input('project', 'v1', ['a']);
    const next = input('project', 'v1', ['a', 'b']);
    expect(computeArrivals(prev, next).nodes.size).toBe(0);
  });

  it('still diffs by id sets when versions differ (cursor is only a hint)', () => {
    const prev = input('project', 'v1', ['a']);
    const next = input('project', 'v9', ['a', 'b']);
    expect([...computeArrivals(prev, next).nodes]).toEqual(['b']);
  });

  it('resets the baseline on a view switch — no mass arrival (Amendment A2)', () => {
    const prev = input('project', 'v1', ['a', 'b']);
    const next = input('thread:t1', 'v2', ['a', 'b', 'c', 'd', 'e']);
    expect(computeArrivals(prev, next).nodes.size).toBe(0);
  });

  it('resets between different threads too', () => {
    const prev = input('thread:t1', 'v1', ['a']);
    const next = input('thread:t2', 'v2', ['a', 'b']);
    expect(computeArrivals(prev, next).nodes.size).toBe(0);
  });
});

describe('parseFactSegments', () => {
  it('splits text and wikilinks', () => {
    expect(parseFactSegments('Uses [[Billing API]] for charging and [[auth middleware]].')).toEqual([
      { type: 'text', value: 'Uses ' },
      { type: 'wikilink', value: 'Billing API' },
      { type: 'text', value: ' for charging and ' },
      { type: 'wikilink', value: 'auth middleware' },
      { type: 'text', value: '.' },
    ]);
  });

  it('returns plain text untouched', () => {
    expect(parseFactSegments('no links here')).toEqual([{ type: 'text', value: 'no links here' }]);
  });
});
