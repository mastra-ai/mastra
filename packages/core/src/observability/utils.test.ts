import { describe, expect, it } from 'vitest';

import { SpanType } from './types';
import { getEntityTypeForSpan, getStepAvailableToolNames } from './utils';

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

describe('getStepAvailableToolNames', () => {
  it('returns activeTools when present, ignoring tools', () => {
    expect(getStepAvailableToolNames({ a: {}, b: {}, c: {} }, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('falls back to tool keys when activeTools is undefined', () => {
    expect(getStepAvailableToolNames({ a: {}, b: {} })).toEqual(['a', 'b']);
  });

  it('honors explicit empty activeTools as "no tools enabled" instead of falling back to tool keys', () => {
    expect(getStepAvailableToolNames({ a: {}, b: {} }, [])).toEqual([]);
  });

  it('returns [] (not undefined) for tool-less agents so observers see a definitive empty set', () => {
    expect(getStepAvailableToolNames({}, undefined)).toEqual([]);
    expect(getStepAvailableToolNames({}, [])).toEqual([]);
  });

  it('returns undefined when tools is undefined', () => {
    expect(getStepAvailableToolNames(undefined, undefined)).toBeUndefined();
  });
});
