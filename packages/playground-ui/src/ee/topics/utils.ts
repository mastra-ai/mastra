import type { Topic, TopicSubtopic, TopicSubtopicWithCounts, TopicTraceShare, TopicTraceSort, TopicTraceSummary, TopicWithCounts } from './types';

const TOPIC_COLORS = ['#7C3AED', '#2563EB', '#0891B2', '#059669', '#CA8A04', '#EA580C', '#DC2626', '#DB2777'];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTopicColor(id: string): string {
  return TOPIC_COLORS[hashString(id) % TOPIC_COLORS.length];
}

export function getTraceCount(subtopic: Pick<TopicSubtopic, 'traceSummaries'>): number {
  return subtopic.traceSummaries.length;
}

export function getTopicTraceCount(topic: Pick<Topic, 'subtopics'>): number {
  return topic.subtopics.reduce((total, subtopic) => total + getTraceCount(subtopic), 0);
}

export function getTraceShare(count: number, total: number): TopicTraceShare {
  return {
    count,
    total,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  };
}

export function aggregateTopics(topics: Topic[]): TopicWithCounts[] {
  const totalTraceCount = topics.reduce((total, topic) => total + getTopicTraceCount(topic), 0);

  return topics.map(topic => ({
    ...topic,
    color: topic.color ?? getTopicColor(topic.id),
    traceCount: getTopicTraceCount(topic),
    subtopics: topic.subtopics.map<TopicSubtopicWithCounts>(subtopic => {
      const traceCount = getTraceCount(subtopic);
      return {
        ...subtopic,
        color: subtopic.color ?? topic.color ?? getTopicColor(subtopic.id),
        traceCount,
        traceShare: getTraceShare(traceCount, totalTraceCount),
      };
    }),
  }));
}

function toTime(value: string | Date | undefined): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function filterTraceSummaries(traces: TopicTraceSummary[], search: string): TopicTraceSummary[] {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return traces;

  return traces.filter(trace =>
    [trace.id, trace.name, trace.entityName, trace.status].some(value => value?.toLowerCase().includes(normalizedSearch)),
  );
}

export function sortTraceSummaries(traces: TopicTraceSummary[], sort: TopicTraceSort): TopicTraceSummary[] {
  return traces.toSorted((left, right) => {
    switch (sort) {
      case 'oldest':
        return toTime(left.startedAt) - toTime(right.startedAt);
      case 'duration-desc':
        return (right.durationMs ?? 0) - (left.durationMs ?? 0);
      case 'duration-asc':
        return (left.durationMs ?? 0) - (right.durationMs ?? 0);
      case 'newest':
      default:
        return toTime(right.startedAt) - toTime(left.startedAt);
    }
  });
}

export function getVisibleTraceSummaries(
  traces: TopicTraceSummary[],
  options: { search: string; sort: TopicTraceSort; page: number; pageSize: number },
): { traces: TopicTraceSummary[]; total: number; hasMore: boolean } {
  const filtered = filterTraceSummaries(traces, options.search);
  const sorted = sortTraceSummaries(filtered, options.sort);
  const end = options.page * options.pageSize;

  return {
    traces: sorted.slice(0, end),
    total: sorted.length,
    hasMore: end < sorted.length,
  };
}
