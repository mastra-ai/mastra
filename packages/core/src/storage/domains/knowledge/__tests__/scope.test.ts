import { describe, expect, it } from 'vitest';

import * as storage from '../../..';
import {
  assertKnowledgeCeilingRaised,
  assertKnowledgeScopeWithinCeiling,
  canonicalizeKnowledgeScope,
  expandKnowledgeScope,
  isKnowledgeScopeVisible,
  knowledgeScopeKey,
  knowledgeVisibleScopeKeys,
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

  it('accepts opaque uncurated companion addresses without legacy ancestors', () => {
    expect(canonicalizeKnowledgeScope(['thread:t1:uncurated'])).toEqual(['thread:t1:uncurated']);
    expect(canonicalizeKnowledgeScope(['resource:r1:uncurated', 'thread:t1:uncurated'])).toEqual([
      'resource:r1:uncurated',
      'thread:t1:uncurated',
    ]);
  });

  it('uses subset visibility and excludes sibling scopes', () => {
    expect(isKnowledgeScopeVisible(['org:o1'], context)).toBe(true);
    expect(isKnowledgeScopeVisible(['org:o1', 'resource:r1'], context)).toBe(true);
    expect(isKnowledgeScopeVisible(['org:o1', 'resource:r2'], context)).toBe(false);
  });

  it('enumerates persisted scope subsets including uncurated companions', () => {
    const resourceCompanion = 'resource:r1:uncurated';
    const threadCompanion = 'thread:t1:uncurated';
    const keys = knowledgeVisibleScopeKeys([...context, resourceCompanion, threadCompanion]);

    expect(keys).toEqual(
      expect.arrayContaining([
        knowledgeScopeKey(context),
        knowledgeScopeKey([resourceCompanion]),
        knowledgeScopeKey([threadCompanion]),
        knowledgeScopeKey([resourceCompanion, threadCompanion]),
      ]),
    );
  });

  it('rejects malformed, partial, and cross-chain scopes', () => {
    expect(() => canonicalizeKnowledgeScope([])).toThrow('cannot be empty');
    expect(() => canonicalizeKnowledgeScope(['thread:t1'])).toThrow('requires resource and org');
    expect(() => canonicalizeKnowledgeScope(['resource:r1'])).toThrow('requires an org');
    expect(() => canonicalizeKnowledgeScope(['org:o1', 'org:o2'])).toThrow('multiple org');
    expect(() => canonicalizeKnowledgeScope(['org:o1\u001fresource:r1'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope(['tenant:t1'])).toThrow('Invalid knowledge scope entry');
  });

  it('keeps the deprecated ceiling assertions as no-ops for published memory and store versions', () => {
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'resource')).not.toThrow();
    expect(() => assertKnowledgeScopeWithinCeiling(['org:o1'], 'thread')).not.toThrow();
    expect(() => assertKnowledgeCeilingRaised('resource', 'thread')).not.toThrow();
  });

  it('keeps every Knowledge @mastra/core/storage export that published memory and store packages import', () => {
    // Imported by @mastra/memory 1.36.0, @mastra/libsql 1.25.1, @mastra/pg 1.30.0,
    // @mastra/mysql 0.12.1, and @mastra/mongodb 1.22.0.
    for (const name of [
      'InMemoryStore',
      'KnowledgeConflictError',
      'KnowledgeNotFoundError',
      'KnowledgeStorage',
      'MAX_KNOWLEDGE_NODE_DESCRIPTION_LENGTH',
      'assertKnowledgeCeilingRaised',
      'assertKnowledgeScopeWithinCeiling',
      'canonicalizeKnowledgeScope',
      'createKnowledgeNodeCursor',
      'createKnowledgeUlid',
      'expandKnowledgeScope',
      'isKnowledgeScopeVisible',
      'knowledgeScopeKey',
      'knowledgeSemanticDocumentId',
      'knowledgeSemanticIdempotencyKey',
      'parseKnowledgeNodeCursor',
      'parseKnowledgeWikilinks',
    ]) {
      expect(storage, name).toHaveProperty(name);
    }
  });
});
