import type { ExternalWorkItemSource } from '../../storage/domains/work-items/base.js';
import { externalAdapter } from './base.js';
import { factoryWorkItemAdapter } from './factory.js';
import { githubWorkItemAdapter } from './github.js';
import { gitlabWorkItemAdapter } from './gitlab.js';
import { incidentioWorkItemAdapter } from './incidentio.js';
import { jiraWorkItemAdapter } from './jira.js';
import { linearWorkItemAdapter } from './linear.js';
import { stringValue } from './metadata-keys.js';
import { slackWorkItemAdapter } from './slack.js';
import type { WorkItemProviderAdapter } from './types.js';

export type { ProviderWorkItemSource, WorkItemProviderAdapter } from './types.js';
export { BOARD_METADATA_KEYS, SHARED_PROVIDER_METADATA_KEYS, splitCardMetadata } from './metadata-keys.js';

/** Integrations this package does not ship: an issue keyed by its identifier, shared keys only. */
const customWorkItemAdapter = externalAdapter('custom', {
  providerFromSource: true,
  providerMetadataKeys: [],
  kind: () => 'issue',
  key: (_source, metadata) => stringValue(metadata.identifier),
});

export const WORK_ITEM_PROVIDER_ADAPTERS: readonly WorkItemProviderAdapter[] = [
  githubWorkItemAdapter,
  gitlabWorkItemAdapter,
  jiraWorkItemAdapter,
  linearWorkItemAdapter,
  slackWorkItemAdapter,
  incidentioWorkItemAdapter,
  factoryWorkItemAdapter,
];

/** The adapter that maps a card with this source onto a work item. */
export function workItemProviderAdapter(source: ExternalWorkItemSource | null): WorkItemProviderAdapter {
  if (!source) return factoryWorkItemAdapter;
  if (source.type === 'slack-thread') return slackWorkItemAdapter;
  return (
    WORK_ITEM_PROVIDER_ADAPTERS.find(
      adapter => adapter !== factoryWorkItemAdapter && adapter.provider === source.integrationId,
    ) ?? customWorkItemAdapter
  );
}
