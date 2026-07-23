import { describe, expect, it } from 'vitest';

import {
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
} from '../base';

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
    expect(() => canonicalizeKnowledgeScope(['tenant:t1'])).toThrow('Invalid knowledge scope entry');
  });

  it('enforces scope ceilings using the narrowest reserved level', () => {
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1', 'resource:r1'], 'resource')).not.toThrow();
    expect(() => assertKnowledgeScopeWithinCeiling(context, 'resource')).not.toThrow();
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'resource')).toThrow('exceeds resource ceiling');
  });
});
