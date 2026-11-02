import { describe, expect, it } from 'vitest';

import type { KnowledgePagePayload } from '../pageTypes';
import { graphWithChildren } from './pageGraph';

function page(id: string, parentId: string | null, extra: Partial<KnowledgePagePayload> = {}): KnowledgePagePayload {
  return {
    id,
    scopeId: 'root',
    parentId,
    isScope: parentId === null,
    position: id,
    name: id,
    version: 1,
    createdBy: { author: 'host' },
    updatedBy: { author: 'host' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

const root = page('root', null, { childCount: 5 });
const first = page('a', 'root');
const kids = [first, ...['b', 'c', 'd', 'e'].map(id => page(id, 'root'))];

describe('graphWithChildren', () => {
  it("adds at most the cap of a focused page's missing children and counts the rest", () => {
    const result = graphWithChildren([root, first], ['root'], kids, new Set(['root']), 2);
    expect(result.pages.map(p => p.id)).toEqual(['root', 'a', 'b', 'c']);
    expect(result.hiddenChildren.get('root')).toBe(2);
  });

  it('adds nothing for a focused page whose children have not loaded yet', () => {
    const result = graphWithChildren([root], ['root'], [], new Set(), 2);
    expect(result.pages.map(p => p.id)).toEqual(['root']);
    expect(result.hiddenChildren.has('root')).toBe(false);
  });

  it('adds nothing for a focused page the graph does not hold', () => {
    const result = graphWithChildren([first], ['root'], kids, new Set(['root']));
    expect(result.pages.map(p => p.id)).toEqual(['a']);
  });

  it('skips deleted and merged children', () => {
    const loaded = [
      page('a', 'root', { deletedAt: '2026-11-01T00:00:00.000Z' }),
      page('b', 'root', { mergedInto: 'c' }),
    ];
    const result = graphWithChildren([{ ...root, childCount: undefined }], ['root'], loaded, new Set(['root']));
    expect(result.pages.map(p => p.id)).toEqual(['root']);
    expect(result.hiddenChildren.get('root')).toBe(0);
  });
});
