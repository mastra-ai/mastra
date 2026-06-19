import type { TopicTraceSummary } from '../topics';

export type SignalFacet = {
  id: string;
  name: string;
  description: string;
  traceSummaries: TopicTraceSummary[];
};

export type Signal = {
  id: string;
  name: string;
  description: string;
  facets: SignalFacet[];
};
