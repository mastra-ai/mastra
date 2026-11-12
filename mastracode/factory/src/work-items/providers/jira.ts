import { externalAdapter, issueKeyPrefix } from './base.js';
import { stringValue } from './metadata-keys.js';

/** Jira issues: `ENG-42`. */
export const jiraWorkItemAdapter = externalAdapter('jira', {
  providerMetadataKeys: ['key', 'site', 'project'],
  key: (_source, metadata) => stringValue(metadata.identifier) ?? stringValue(metadata.key),
  author: metadata => stringValue(metadata.author) ?? stringValue(metadata.creator),
  intake: {},
  // The project key: `OPS` for `OPS-3`.
  repository: ({ key, metadata }) => stringValue(metadata?.project) ?? issueKeyPrefix(key),
});
