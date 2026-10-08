import { describe, expect, it } from 'vitest';

import * as storage from '../../..';
import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  canonicalizeKnowledgeScopeIds,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeIdsKey,
  knowledgeScopeKey,
} from '../base';

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
  });

  it('requires canonical UUID identities while allowing an empty membership set', () => {
    expect(canonicalizeKnowledgeScopeIds([])).toEqual([]);
    expect(() => canonicalizeKnowledgeScopeIds([''])).toThrow('must be UUIDs');
    expect(() => canonicalizeKnowledgeScopeIds(['scope-org'])).toThrow('must be UUIDs');
    expect(canonicalizeKnowledgeScopeIds([orgScopeId.toUpperCase()])).toEqual([orgScopeId]);
  });
});

describe('deprecated hierarchical scope helpers kept for published @mastra/memory', () => {
  const context = ['thread:t1', 'org:o1', 'resource:r1'];

  it('keeps every @mastra/core/storage export that published @mastra/memory 1.36.0 imports', () => {
    for (const name of [
      'InMemoryStore',
      'MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH',
      'assertKnowledgeScopeWithinCeiling',
      'canonicalizeKnowledgeScope',
      'createKnowledgeNodeCursor',
      'expandKnowledgeScope',
      'isKnowledgeScopeVisible',
      'knowledgeScopeKey',
    ]) {
      expect(storage, name).toHaveProperty(name);
    }
  });

  it('keeps the ceiling assertion as a no-op', () => {
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'resource')).not.toThrow();
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'thread')).not.toThrow();
  });

  it('canonicalizes, keys, and expands ancestor chains as published memory expects', () => {
    expect(canonicalizeKnowledgeScope([...context, 'org:o1'])).toEqual(['org:o1', 'resource:r1', 'thread:t1']);
    expect(knowledgeScopeKey(context)).toBe('org:o1\u001fresource:r1\u001fthread:t1');
    expect(expandKnowledgeScope(context, 'resource')).toEqual(['org:o1', 'resource:r1']);
    expect(() => expandKnowledgeScope(['org:o1'], 'thread')).toThrow('context has no thread entry');
    expect(canonicalizeKnowledgeScope(['thread:t1:uncurated'])).toEqual(['thread:t1:uncurated']);
    expect(() => canonicalizeKnowledgeScope(['resource:r1'])).toThrow('requires an org');
  });
});
