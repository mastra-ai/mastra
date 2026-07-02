import { describe, it, expect } from 'vitest';
import { buildMemoryHeaders, mergeLlmCallHeaders } from './merge-llm-call-headers';

describe('buildMemoryHeaders', () => {
  it('emits only the keys that have values', () => {
    expect(buildMemoryHeaders({ threadId: 't1' })).toEqual({ 'x-thread-id': 't1' });
    expect(buildMemoryHeaders({ resourceId: 'r1' })).toEqual({ 'x-resource-id': 'r1' });
    expect(buildMemoryHeaders({ threadId: 't1', resourceId: 'r1' })).toEqual({
      'x-thread-id': 't1',
      'x-resource-id': 'r1',
    });
  });

  it('returns an empty record when both are missing', () => {
    expect(buildMemoryHeaders({})).toEqual({});
  });
});

describe('mergeLlmCallHeaders', () => {
  it('returns undefined when no headers come in', () => {
    expect(mergeLlmCallHeaders({})).toBeUndefined();
    expect(mergeLlmCallHeaders({ memoryHeaders: {}, modelConfigHeaders: {}, callTimeHeaders: {} })).toBeUndefined();
  });

  it('layers memory < modelConfig < callTime so callTime wins on conflict', () => {
    const merged = mergeLlmCallHeaders({
      memoryHeaders: { 'x-thread-id': 't1', 'x-shared': 'memory' },
      modelConfigHeaders: { 'x-api-region': 'eu', 'x-shared': 'modelConfig' },
      callTimeHeaders: { authorization: 'Bearer abc', 'x-shared': 'callTime' },
    });
    expect(merged).toEqual({
      'x-thread-id': 't1',
      'x-api-region': 'eu',
      authorization: 'Bearer abc',
      'x-shared': 'callTime',
    });
  });

  it('returns just memory headers when no other layer is provided', () => {
    expect(mergeLlmCallHeaders({ memoryHeaders: { 'x-thread-id': 't1', 'x-resource-id': 'r1' } })).toEqual({
      'x-thread-id': 't1',
      'x-resource-id': 'r1',
    });
  });
});
