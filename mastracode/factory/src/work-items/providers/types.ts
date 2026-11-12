import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import type { WorkItemProvider } from '../../storage/domains/work-items/work-item-schema.js';

export interface ProviderWorkItemSource {
  provider: WorkItemProvider;
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
  /**
   * Where the item lives at its provider, for rules to route by: a GitHub repository or GitLab
   * project path (`acme/app`, `acme/platform/api`), a Linear team key, a Jira project key. Null
   * when the item doesn't say; absent for providers without such a scope.
   */
  repository?(item: Pick<ProviderWorkItemSource, 'key' | 'metadata'>): string | null;
  /**
   * Set by the providers whose open issues and pull requests Factory offers as intake: whether the
   * provider has closed the record. A record of any other provider is never an intake candidate.
   */
  closed?(item: Pick<ProviderWorkItemSource, 'state' | 'metadata'>): boolean;
}
