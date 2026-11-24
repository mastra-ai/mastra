import type { WorkItemProviderAdapter } from './types.js';

/** Native work has no external source; its metadata stays with its board placement. */
export const factoryWorkItemAdapter: WorkItemProviderAdapter = {
  provider: 'factory',
  providerMetadataKeys: [],
  toSource(source) {
    if (source) throw new Error('A Factory work item has no external source.');
    return null;
  },
};
