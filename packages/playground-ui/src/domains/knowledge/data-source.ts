import type { InfiniteData, UseInfiniteQueryResult, UseQueryResult } from '@tanstack/react-query';
import type {
  KnowledgeActivityPayload,
  KnowledgeNodePayload,
  KnowledgeRung,
  KnowledgeSearchPayload,
  KnowledgeSelection,
} from './types';

/**
 * What the Knowledge explorer reads from its host. Factory UI and Mastra Studio each
 * supply the hooks for their own server routes; the components never fetch directly.
 * Each member is called as a React hook, so a host must pass the same functions on
 * every render of its provider.
 */
export interface KnowledgeDataSource {
  /** One node with its records, for the node flyout. */
  useNode: (nodeId: string, scopeLevel: KnowledgeRung) => UseQueryResult<KnowledgeNodePayload>;
  /** Paged activity for the active lens, newest first. */
  useActivity: (selection: KnowledgeSelection) => UseInfiniteQueryResult<InfiniteData<KnowledgeActivityPayload>>;
  /** Search across scopes and nodes; hosts skip short queries. */
  useSearch: (query: string) => UseQueryResult<KnowledgeSearchPayload>;
}
