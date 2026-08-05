import { describe, expect, it } from 'vitest';
import type { Topic } from '../types';
import { aggregateTopics, filterTraceSummaries, getTraceShare, sortTraceSummaries } from '../utils';

const topics: Topic[] = [
  {
    id: 'support',
    name: 'Support',
    subtopics: [
      {
        id: 'refunds',
        name: 'Refunds',
        traceSummaries: [
          {
            id: 'trace-1',
            name: 'Refund request',
            status: 'success',
            startedAt: '2026-06-15T10:00:00.000Z',
            durationMs: 250,
          },
          {
            id: 'trace-2',
            name: 'Refund failed',
            status: 'error',
            startedAt: '2026-06-15T11:00:00.000Z',
            durationMs: 50,
          },
        ],
      },
      {
        id: 'shipping',
        name: 'Shipping',
        traceSummaries: [
          { id: 'trace-3', name: 'Track package', startedAt: '2026-06-15T09:00:00.000Z', durationMs: 500 },
        ],
      },
    ],
  },
];

describe('topics utilities', () => {
  it('aggregates trace counts and subtopic trace share', () => {
    const [topic] = aggregateTopics(topics);

    expect(topic.traceCount).toBe(3);
    expect(topic.color).toMatch(/^#/);
    expect(topic.subtopics[0].traceCount).toBe(2);
    expect(topic.subtopics[0].traceShare).toEqual({ count: 2, total: 3, percentage: 67 });
    expect(topic.subtopics[1].traceShare).toEqual({ count: 1, total: 3, percentage: 33 });
  });

  it('calculates zero share without dividing by zero', () => {
    expect(getTraceShare(0, 0)).toEqual({ count: 0, total: 0, percentage: 0 });
  });

  it('filters traces across searchable summary fields', () => {
    const traces = topics[0].subtopics[0].traceSummaries;

    expect(filterTraceSummaries(traces, 'failed').map(trace => trace.id)).toEqual(['trace-2']);
    expect(filterTraceSummaries(traces, 'success').map(trace => trace.id)).toEqual(['trace-1']);
  });

  it('sorts traces by recency and duration', () => {
    const traces = topics[0].subtopics.flatMap(subtopic => subtopic.traceSummaries);

    expect(sortTraceSummaries(traces, 'newest').map(trace => trace.id)).toEqual(['trace-2', 'trace-1', 'trace-3']);
    expect(sortTraceSummaries(traces, 'duration-desc').map(trace => trace.id)).toEqual([
      'trace-3',
      'trace-1',
      'trace-2',
    ]);
  });
});
