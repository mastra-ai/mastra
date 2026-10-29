import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import type { WorkItemKind, WorkItemProvider } from '../../storage/domains/work-items/work-item-schema.js';

/** The provider-owned half of a card, as one adapter maps it onto the shared columns. */
export interface ProviderWorkItem {
  provider: WorkItemProvider;
  kind: WorkItemKind;
  integrationId: string;
  sourceType: string;
  workspaceId: string | null;
  /** Provider-scoped id; unique per project and provider. */
  externalId: string;
  /** `externalSourceKey(source)`; null for Factory-native cards. */
  sourceKey: string | null;
  url: string | null;
  key: string | null;
  title: string;
  state: string | null;
  labels: string[];
  author: string | null;
  /** Provider facts without a column, keyed as they were on the card. */
  metadata: Record<string, unknown> | null;
}

export interface ProviderWorkItemContext {
  title: string;
  /** The board item the work item belongs to; Factory-native cards are keyed by it. */
  boardItemId: string;
}

/**
 * Maps one provider's sources onto the shared work item columns. The input is
 * the card's source and the metadata the integration files it with, so the
 * same adapter serves live ingest and the migration of legacy cards.
 */
export interface WorkItemProviderAdapter {
  provider: WorkItemProvider;
  /** Metadata keys this provider owns; they live on the work item, never on the board item. */
  providerMetadataKeys: readonly string[];
  toWorkItem(
    source: ExternalWorkItemSource | null,
    metadata: Record<string, unknown> | null,
    context: ProviderWorkItemContext,
  ): ProviderWorkItem;
}
