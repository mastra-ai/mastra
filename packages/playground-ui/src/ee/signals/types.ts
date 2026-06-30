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

/**
 * Display metadata for a signal in the catalog. The clusters themselves are
 * fetched live from the Entity-Learning `/topics` endpoint per selected entity.
 * `id` matches the entity-learning `signalName` (e.g. `sentiment`).
 */
export type SignalCatalogEntry = {
  id: string;
  name: string;
  description: string;
};

/** The currently selected entity in the Signals page. */
export type SelectedEntity = {
  entityType: string;
  entityId: string;
};
