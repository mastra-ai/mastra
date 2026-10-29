import { externalAdapter, mergedState } from './base.js';
import { stringValue } from './metadata-keys.js';

const MERGE_REQUEST_URL = /^https?:\/\/[^/]+\/(.+?)\/-\/merge_requests\/(\d+)/;
const ISSUE_URL = /^https?:\/\/[^/]+\/(.+?)\/-\/(?:issues|work_items)\/(\d+)/;

/** GitLab issues (`group/project#3`) and merge requests (`group/project!7`). */
export const gitlabWorkItemAdapter = externalAdapter('gitlab', {
  providerMetadataKeys: [
    'gitlabHost',
    'gitlabProjectId',
    'gitlabIssueIid',
    'gitlabMergeRequestIid',
    'draft',
    'merged',
    'headBranch',
    'baseBranch',
    'requestedReviewers',
  ],
  kind: source => (source.type === 'pull-request' ? 'merge_request' : 'issue'),
  key: (source, metadata) => {
    if (source.type === 'pull-request') {
      const match = source.url ? MERGE_REQUEST_URL.exec(source.url) : null;
      if (match) return `${match[1]}!${match[2]}`;
      return typeof metadata.gitlabMergeRequestIid === 'number' ? `!${metadata.gitlabMergeRequestIid}` : null;
    }
    const identifier = stringValue(metadata.identifier);
    if (identifier) return identifier;
    const match = source.url ? ISSUE_URL.exec(source.url) : null;
    if (match) return `${match[1]}#${match[2]}`;
    return typeof metadata.gitlabIssueIid === 'number' ? `#${metadata.gitlabIssueIid}` : null;
  },
  state: mergedState,
});
