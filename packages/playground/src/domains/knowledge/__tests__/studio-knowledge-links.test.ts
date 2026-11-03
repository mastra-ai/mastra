import type { KnowledgePageResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { studioPageCard } from '../studio-knowledge-links';

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
  childCount: 3,
};

const view = (page: object, ancestors: object[]) => ({ page, ancestors }) as unknown as KnowledgePageResponse;

describe('studioPageCard', () => {
  it('addresses a page by its scope and keys, with its child count', () => {
    expect(studioPageCard(view(refunds, [scope, policies]))).toEqual({
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
});
