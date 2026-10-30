import { externalAdapter } from './base.js';
import { stringValue } from './metadata-keys.js';

/** Linear issues: `ENG-42`. */
export const linearWorkItemAdapter = externalAdapter('linear', {
  providerMetadataKeys: [
    'linearIssueId',
    'linearProjectId',
    'linearState',
    'linearStateType',
    'linearAssignee',
    'linearCreator',
    'linearPriority',
    'linearTeam',
    'team',
    'teamKey',
  ],
  key: (_source, metadata) => stringValue(metadata.identifier),
  state: (_source, metadata) => stringValue(metadata.linearState) ?? stringValue(metadata.state),
  author: metadata =>
    stringValue(metadata.author) ?? stringValue(metadata.creator) ?? stringValue(metadata.linearCreator),
});
