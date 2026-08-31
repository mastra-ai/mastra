import { describe, expect, it } from 'vitest';

import { canonicalizeKnowledgeScopeIds, isKnowledgeScopeVisible, knowledgeScopeIdsKey } from '../base';

const orgScopeId = '10000000-0000-4000-8000-000000000001';
const resourceScopeId = '10000000-0000-4000-8000-000000000002';
const threadScopeId = '10000000-0000-4000-8000-000000000003';
const otherScopeId = '10000000-0000-4000-8000-000000000004';
const siblingScopeId = '10000000-0000-4000-8000-000000000005';
const context = [threadScopeId, orgScopeId, resourceScopeId];

describe('knowledge scope-node IDs', () => {
  it('canonicalizes and deduplicates direct scope memberships', () => {
    expect(canonicalizeKnowledgeScopeIds([...context, orgScopeId])).toEqual([
      orgScopeId,
      resourceScopeId,
      threadScopeId,
    ]);
    expect(knowledgeScopeIdsKey(context)).toBe(`${orgScopeId}\u001f${resourceScopeId}\u001f${threadScopeId}`);
  });

  it('uses direct membership intersection for visibility', () => {
    expect(isKnowledgeScopeVisible([orgScopeId], context)).toBe(true);
    expect(isKnowledgeScopeVisible([orgScopeId, otherScopeId], context)).toBe(true);
    expect(isKnowledgeScopeVisible([siblingScopeId], context)).toBe(false);
    expect(isKnowledgeScopeVisible([], context)).toBe(false);
  });

  it('requires canonical UUID identities while allowing an empty membership set', () => {
    expect(canonicalizeKnowledgeScopeIds([])).toEqual([]);
    expect(() => canonicalizeKnowledgeScopeIds([''])).toThrow('must be UUIDs');
    expect(() => canonicalizeKnowledgeScopeIds(['scope-org'])).toThrow('must be UUIDs');
    expect(canonicalizeKnowledgeScopeIds([orgScopeId.toUpperCase()])).toEqual([orgScopeId]);
  });
});
