import { describe, expect, it } from 'vitest';

import { knowledgeSemanticDocumentId, knowledgeSemanticIdempotencyKey, parseKnowledgeWikilinks } from '../base';

describe('knowledge wikilinks and semantic ids', () => {
  it('parses unique trimmed wikilinks deterministically', () => {
    expect(parseKnowledgeWikilinks('Worked with [[ Jane ]] on [[deploy fix]] and [[jane]].')).toEqual([
      'Jane',
      'deploy fix',
    ]);
  });

  it('ignores malformed and empty links', () => {
    expect(parseKnowledgeWikilinks('[[]] [[valid]] [[nested [[bad]]')).toEqual(['valid', 'bad']);
  });

  it('builds stable typed semantic document and operation ids', () => {
    const documentId = knowledgeSemanticDocumentId('fact', '01ABC');
    expect(documentId).toBe('knowledge:fact:01ABC');
    expect(knowledgeSemanticIdempotencyKey(documentId, 'upsert', 2)).toBe('knowledge:fact:01ABC:upsert:2');
  });
});
