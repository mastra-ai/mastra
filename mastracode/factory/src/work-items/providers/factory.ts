import type { WorkItemProviderAdapter } from './types.js';

/**
 * Cards made in Factory (New card, `factory_create_work_item`). Factory is
 * their provider: they are keyed by their board item, read by a short id, and
 * open. None of their metadata is a provider fact.
 */
export const factoryWorkItemAdapter: WorkItemProviderAdapter = {
  provider: 'factory',
  providerMetadataKeys: [],
  toWorkItem(source, _metadata, context) {
    if (source) throw new Error('A Factory work item has no external source.');
    return {
      provider: 'factory',
      kind: 'issue',
      integrationId: 'factory',
      sourceType: 'manual',
      workspaceId: null,
      externalId: context.boardItemId,
      sourceKey: null,
      url: null,
      key: context.boardItemId.slice(0, 8),
      title: context.title,
      state: 'open',
      labels: [],
      author: null,
      metadata: null,
    };
  },
};
