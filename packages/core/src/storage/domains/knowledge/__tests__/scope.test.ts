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

  it('rejects malformed entries but accepts any tag type', () => {
    expect(() => canonicalizeKnowledgeScope([])).toThrow('cannot be empty');
    expect(() => canonicalizeKnowledgeScope(['org:o1\u001fresource:r1'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope(['Team:x'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope(['team:'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope([':x'])).toThrow('Invalid knowledge scope entry');
    // No level, ancestor or one-per-type rules.
    expect(canonicalizeKnowledgeScope(['thread:t1'])).toEqual(['thread:t1']);
    expect(canonicalizeKnowledgeScope(['tenant:t1', 'org:o1', 'org:o2'])).toEqual(['org:o1', 'org:o2', 'tenant:t1']);
    expect(canonicalizeKnowledgeScope(['team:acme:support', 'agent:alex'])).toEqual([
      'agent:alex',
      'team:acme:support',
    ]);
  });

  it('refuses any value segment that starts with $, so a stored scope never looks like a pattern', () => {
    expect(() => canonicalizeKnowledgeScope(['team:$org:director'])).toThrow('Invalid knowledge scope entry');
    expect(() => canonicalizeKnowledgeScope(['team:acme:$x-y'])).toThrow('Invalid knowledge scope entry');
    expect(canonicalizeKnowledgeScope(['team:acme:x$'])).toEqual(['team:acme:x$']);
  });

  it('sorts whole entries by UTF-16 code unit, independent of locale', () => {
    expect(canonicalizeKnowledgeScope(['a:x', 'ab:x', 'a_b:x', 'a1:x', 'a-b:x'])).toEqual([
      'a-b:x',
      'a1:x',
      'a:x',
      'a_b:x',
      'ab:x',
    ]);
    // Existing org/resource/thread keys keep their order, so no stored key moves.
    expect(canonicalizeKnowledgeScope(['thread:t1', 'org:o1', 'resource:r1'])).toEqual([
      'org:o1',
      'resource:r1',
      'thread:t1',
    ]);
  });

  it('caps a scope at 8 tags', () => {
    const tags = Array.from({ length: 9 }, (_, index) => `tag${index}:v`);
    expect(canonicalizeKnowledgeScope(tags.slice(0, 8))).toHaveLength(8);
    expect(() => canonicalizeKnowledgeScope(tags)).toThrow('at most 8 tags; got 9');
    // Duplicates count once.
    expect(canonicalizeKnowledgeScope([...tags.slice(0, 8), 'tag0:v'])).toHaveLength(8);
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
