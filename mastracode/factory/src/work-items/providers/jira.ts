import { externalAdapter } from './base.js';
import { stringValue } from './metadata-keys.js';

/** Jira issues: `ENG-42`. */
export const jiraWorkItemAdapter = externalAdapter('jira', {
  providerMetadataKeys: ['key', 'site', 'project'],
  kind: () => 'issue',
  key: (_source, metadata) => stringValue(metadata.identifier) ?? stringValue(metadata.key),
  author: metadata => stringValue(metadata.author) ?? stringValue(metadata.creator),
});
