import type { TopicTraceSummary } from '../topics';

export type SignalCluster = {
  id: string;
  name: string;
  description: string;
  traceSummaries: TopicTraceSummary[];
};

export type Signal = {
  id: string;
  name: string;
  description: string;
  clusters: SignalCluster[];
};
