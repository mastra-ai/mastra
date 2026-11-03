import type { KnowledgePageResponse, KnowledgeTreeResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { isDeclaredAddress, studioPageCard } from '../studio-knowledge-links';

const base = { position: 'a', version: 1, createdAt: '', updatedAt: '', createdBy: {}, updatedBy: {} };
const scope = { ...base, id: 's', scopeId: 's', parentId: null, isScope: true, address: 'org:acme', name: 'Acme' };
const policies = { ...base, id: 'p', scopeId: 's', parentId: 's', isScope: false, key: 'policies', name: 'Policies' };
const refunds = {
  ...base,
  id: 'r',
  scopeId: 's',
  parentId: 'p',
  isScope: false,
  key: 'refunds',
  name: 'Refunds',
};

const view = (page: object, ancestors: object[]) => ({ page, ancestors }) as unknown as KnowledgePageResponse;

describe('studioPageCard', () => {
  // What GET /tree?parentId=… returns: the children, and a cursor when there are more.
  const tree = (count: number, nextCursor?: string) =>
    ({
      pages: Array.from({ length: count }, (_, index) => ({ ...policies, id: `c${index}`, parentId: 'r' })),
      truncated: false,
      ...(nextCursor ? { nextCursor } : {}),
    }) as unknown as KnowledgeTreeResponse;

  it('addresses a page by its scope and keys, with its child count from the tree route', () => {
    expect(studioPageCard(view(refunds, [scope, policies]), tree(3))).toEqual({
      name: 'Refunds',
      kind: 'Page',
      pageRef: 'org:acme#policies/refunds',
      childCount: '3',
    });
  });

  it('names a scope by its label and address', () => {
    expect(studioPageCard(view({ ...scope, displayLabel: 'Team' }, []))).toMatchObject({
      kind: 'Team',
      pageRef: 'org:acme',
    });
  });

  it('shows no child count for a page with no children, and a plus when more follow', () => {
    expect(studioPageCard(view(refunds, [scope, policies]), tree(0)).childCount).toBeUndefined();
    expect(studioPageCard(view(refunds, [scope, policies])).childCount).toBeUndefined();
    expect(studioPageCard(view(refunds, [scope, policies]), tree(2, 'more')).childCount).toBe('2+');
  });
});

describe('isDeclaredAddress', () => {
  const roots = { pages: [scope], truncated: false } as unknown as KnowledgeTreeResponse;

  it('accepts an address whose scope type the instance has', () => {
    expect(isDeclaredAddress('org:acme#policies/refunds', roots)).toBe(true);
    expect(isDeclaredAddress('org:other#x', roots)).toBe(true);
  });

  it('refuses text that only looks like an address, and anything before the roots load', () => {
    for (const text of ['git:abc#1', 'mailto:x#y', 'localhost:3000#top', 'Pricing']) {
      expect(isDeclaredAddress(text, roots), text).toBe(false);
    }
    expect(isDeclaredAddress('org:acme#x', undefined)).toBe(false);
  });
});
