import { describe, expect, it } from 'vitest';

import { SpanType } from './types';
import { getEntityTypeForSpan } from './utils';

describe('getEntityTypeForSpan', () => {
  it('maps rag ingestion spans to the rag_ingestion entity type', () => {
    expect(getEntityTypeForSpan({ spanType: SpanType.RAG_INGESTION })).toBe('rag_ingestion');
  });

  it('prefers an explicit entity type when present', () => {
    expect(
      getEntityTypeForSpan({
        entityType: 'rag_ingestion',
        spanType: SpanType.GENERIC,
      }),
    ).toBe('rag_ingestion');
  });
});
