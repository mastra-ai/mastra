export type TopicTraceSort = 'newest' | 'oldest' | 'duration-desc' | 'duration-asc';

export interface TopicTraceSummary {
  id: string;
  name?: string;
  startedAt?: string | Date;
  endedAt?: string | Date;
  durationMs?: number;
  status?: 'success' | 'error' | 'running' | string;
  entityName?: string;
  spanCount?: number;
}

export interface TopicSubtopic {
  id: string;
  name: string;
  description?: string;
  color?: string;
  traceSummaries: TopicTraceSummary[];
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
  color?: string;
  subtopics: TopicSubtopic[];
}

export interface TopicTraceShare {
  count: number;
  total: number;
  percentage: number;
}

export interface TopicWithCounts extends Topic {
  color: string;
  traceCount: number;
  subtopics: TopicSubtopicWithCounts[];
}

export interface TopicSubtopicWithCounts extends TopicSubtopic {
  color: string;
  traceCount: number;
  traceShare: TopicTraceShare;
}
