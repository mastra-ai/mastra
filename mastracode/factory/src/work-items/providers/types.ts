import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import type { WorkItemKind, WorkItemProvider } from '../../storage/domains/work-items/work-item-schema.js';

export interface ProviderWorkItemSource {
  provider: WorkItemProvider;
  kind: WorkItemKind;
  integrationId: string;
  sourceType: string;
  workspaceId: string | null;
  externalId: string;
  sourceKey: string | null;
  url: string | null;
  key: string | null;
  state: string | null;
  labels: string[];
  author: string | null;
  metadata: Record<string, unknown> | null;
}

/** The same mapping serves integration ingest and legacy migration. */
export interface WorkItemProviderAdapter {
  provider: WorkItemProvider;
  providerMetadataKeys: readonly string[];
  toSource(
    source: ExternalWorkItemSource | null,
    metadata: Record<string, unknown> | null,
  ): ProviderWorkItemSource | null;
}
