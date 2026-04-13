import { describe, it, expect } from 'vitest';
import type { GroupableTrace } from '../group-traces-by-thread';
import { groupTracesByThread } from '../group-traces-by-thread';

type MockTrace = GroupableTrace & { traceId: string };

const createMockTrace = (overrides: Partial<MockTrace> = {}): MockTrace => ({
  traceId: `trace-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  threadId: null,
  ...overrides,
});

describe('groupTracesByThread', () => {
  it('should return empty groups and ungrouped for empty input', () => {
    const result = groupTracesByThread([]);
    expect(result.groups).toEqual([]);
    expect(result.ungrouped).toEqual([]);
  });

  it('should place traces without threadId in ungrouped', () => {
    const trace1 = createMockTrace({ traceId: 'trace-1' });
    const trace2 = createMockTrace({ traceId: 'trace-2' });

    const result = groupTracesByThread([trace1, trace2]);

    expect(result.groups).toEqual([]);
    expect(result.ungrouped).toHaveLength(2);
    expect(result.ungrouped[0].traceId).toBe('trace-1');
    expect(result.ungrouped[1].traceId).toBe('trace-2');
  });

  it('should group traces by threadId', () => {
    const trace1 = createMockTrace({ traceId: 'trace-1', threadId: 'thread-A' });
    const trace2 = createMockTrace({ traceId: 'trace-2', threadId: 'thread-A' });
    const trace3 = createMockTrace({ traceId: 'trace-3', threadId: 'thread-B' });

    const result = groupTracesByThread([trace1, trace2, trace3]);

    expect(result.groups).toHaveLength(2);
    expect(result.ungrouped).toHaveLength(0);

    const threadA = result.groups.find(g => g.threadId === 'thread-A');
    const threadB = result.groups.find(g => g.threadId === 'thread-B');

    expect(threadA).toBeDefined();
    expect(threadA!.traces).toHaveLength(2);
    expect(threadA!.traces.map(t => t.traceId)).toEqual(['trace-1', 'trace-2']);

    expect(threadB).toBeDefined();
    expect(threadB!.traces).toHaveLength(1);
    expect(threadB!.traces[0].traceId).toBe('trace-3');
  });

  it('should separate grouped and ungrouped traces', () => {
    const trace1 = createMockTrace({ traceId: 'trace-1', threadId: 'thread-A' });
    const trace2 = createMockTrace({ traceId: 'trace-2', threadId: null });
    const trace3 = createMockTrace({ traceId: 'trace-3', threadId: 'thread-A' });

    const result = groupTracesByThread([trace1, trace2, trace3]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].threadId).toBe('thread-A');
    expect(result.groups[0].traces).toHaveLength(2);
    expect(result.ungrouped).toHaveLength(1);
    expect(result.ungrouped[0].traceId).toBe('trace-2');
  });

  it('should sort groups by most recent trace (descending)', () => {
    const trace1 = createMockTrace({
      traceId: 'trace-1',
      threadId: 'thread-old',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    const trace2 = createMockTrace({
      traceId: 'trace-2',
      threadId: 'thread-new',
      createdAt: new Date('2025-01-03T00:00:00Z'),
    });
    const trace3 = createMockTrace({
      traceId: 'trace-3',
      threadId: 'thread-mid',
      createdAt: new Date('2025-01-02T00:00:00Z'),
    });

    const result = groupTracesByThread([trace1, trace2, trace3]);

    expect(result.groups).toHaveLength(3);
    expect(result.groups[0].threadId).toBe('thread-new');
    expect(result.groups[1].threadId).toBe('thread-mid');
    expect(result.groups[2].threadId).toBe('thread-old');
  });

  it('should sort groups by the latest trace within a group, not the earliest', () => {
    const traceOldGroup1 = createMockTrace({
      traceId: 'trace-1',
      threadId: 'thread-A',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    const traceNewGroup1 = createMockTrace({
      traceId: 'trace-2',
      threadId: 'thread-A',
      createdAt: new Date('2025-01-05T00:00:00Z'),
    });
    const traceMidGroup2 = createMockTrace({
      traceId: 'trace-3',
      threadId: 'thread-B',
      createdAt: new Date('2025-01-03T00:00:00Z'),
    });

    const result = groupTracesByThread([traceOldGroup1, traceNewGroup1, traceMidGroup2]);

    expect(result.groups).toHaveLength(2);
    // thread-A has the latest trace (Jan 5), so it should be first
    expect(result.groups[0].threadId).toBe('thread-A');
    expect(result.groups[1].threadId).toBe('thread-B');
  });

  it('should preserve trace order within each group', () => {
    const trace1 = createMockTrace({ traceId: 'trace-1', threadId: 'thread-A' });
    const trace2 = createMockTrace({ traceId: 'trace-2', threadId: 'thread-A' });
    const trace3 = createMockTrace({ traceId: 'trace-3', threadId: 'thread-A' });

    const result = groupTracesByThread([trace1, trace2, trace3]);

    expect(result.groups[0].traces.map(t => t.traceId)).toEqual(['trace-1', 'trace-2', 'trace-3']);
  });

  it('should handle a single trace with a threadId', () => {
    const trace = createMockTrace({ traceId: 'trace-1', threadId: 'thread-only' });

    const result = groupTracesByThread([trace]);

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].threadId).toBe('thread-only');
    expect(result.groups[0].traces).toHaveLength(1);
    expect(result.ungrouped).toHaveLength(0);
  });
});
