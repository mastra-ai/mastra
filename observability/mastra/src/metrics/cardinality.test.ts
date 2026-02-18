/**
 * Unit tests for CardinalityFilter
 */

import { describe, it, expect } from 'vitest';
import { CardinalityFilter } from './cardinality';

describe('CardinalityFilter', () => {
  it('should block default high-cardinality labels', () => {
    const filter = new CardinalityFilter();

    const result = filter.filterLabels({
      agent: 'test-agent',
      trace_id: 'abc-123',
      span_id: 'def-456',
      user_id: 'user-789',
      session_id: 'sess-001',
      request_id: 'req-002',
      run_id: 'run-003',
      resource_id: 'res-004',
      thread_id: 'thr-005',
    });

    expect(result).toEqual({ agent: 'test-agent' });
  });

  it('should be case-insensitive for label names', () => {
    const filter = new CardinalityFilter();

    const result = filter.filterLabels({
      TRACE_ID: 'abc',
      User_Id: 'user-1',
      agent: 'keep-me',
    });

    expect(result).toEqual({ agent: 'keep-me' });
  });

  it('should block UUID-like values by default', () => {
    const filter = new CardinalityFilter();

    const result = filter.filterLabels({
      agent: 'test-agent',
      some_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'ok',
    });

    expect(result).toEqual({ agent: 'test-agent', status: 'ok' });
  });

  it('should allow UUID values when blockUUIDs is false', () => {
    const filter = new CardinalityFilter({ blockUUIDs: false });

    const result = filter.filterLabels({
      entity: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result).toEqual({
      entity: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('should support custom blocked labels', () => {
    const filter = new CardinalityFilter({
      blockedLabels: ['custom_field', 'secret'],
    });

    const result = filter.filterLabels({
      agent: 'keep',
      custom_field: 'blocked',
      secret: 'blocked',
      trace_id: 'now-allowed', // not in custom list
    });

    expect(result).toEqual({ agent: 'keep', trace_id: 'now-allowed' });
  });

  it('should allow all labels with empty blocked list', () => {
    const filter = new CardinalityFilter({
      blockedLabels: [],
      blockUUIDs: false,
    });

    const result = filter.filterLabels({
      trace_id: 'abc',
      user_id: 'user-1',
      any_label: 'value',
    });

    expect(result).toEqual({
      trace_id: 'abc',
      user_id: 'user-1',
      any_label: 'value',
    });
  });

  it('should handle empty input', () => {
    const filter = new CardinalityFilter();
    expect(filter.filterLabels({})).toEqual({});
  });
});
