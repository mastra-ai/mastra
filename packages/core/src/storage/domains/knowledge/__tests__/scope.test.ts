import { describe, expect, it } from 'vitest';

import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '../base';
import * as storage from '../../..';

const context = ['thread:t1', 'org:o1', 'resource:r1'];

describe('knowledge scopes', () => {
  it('canonicalizes and deduplicates ancestor chains', () => {
    expect(canonicalizeKnowledgeScope([...context, 'org:o1'])).toEqual(['org:o1', 'resource:r1', 'thread:t1']);
    expect(knowledgeScopeKey(context)).toBe('org:o1\u001fresource:r1\u001fthread:t1');
  });

  it('expands a level from trusted conversation context', () => {
    expect(expandKnowledgeScope(context, 'org')).toEqual(['org:o1']);
    expect(expandKnowledgeScope(context, 'resource')).toEqual(['org:o1', 'resource:r1']);
    expect(expandKnowledgeScope(context, 'thread')).toEqual(['org:o1', 'resource:r1', 'thread:t1']);
    expect(() => expandKnowledgeScope(['org:o1'], 'thread')).toThrow('context has no thread entry');
  });

  it('uses subset visibility and excludes sibling scopes', () => {
    expect(isKnowledgeScopeVisible(['org:o1'], context)).toBe(true);
    expect(isKnowledgeScopeVisible(['org:o1', 'resource:r1'], context)).toBe(true);
    expect(isKnowledgeScopeVisible(['org:o1', 'resource:r2'], context)).toBe(false);
  });

  it('rejects malformed, partial, and cross-chain scopes', () => {
    expect(() => canonicalizeKnowledgeScope([])).toThrow('cannot be empty');
    expect(() => canonicalizeKnowledgeScope(['thread:t1'])).toThrow('requires resource and org');
    expect(() => canonicalizeKnowledgeScope(['resource:r1'])).toThrow('requires an org');
    expect(() => canonicalizeKnowledgeScope(['org:o1', 'org:o2'])).toThrow('multiple org');
    expect(() => canonicalizeKnowledgeScope(['org:o1\u001fresource:r1'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope(['tenant:t1'])).toThrow('Invalid knowledge scope entry');
  });

  it('keeps the deprecated ceiling assertion as a no-op for published memory versions', () => {
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'resource')).not.toThrow();
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'thread')).not.toThrow();
  });

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
});
