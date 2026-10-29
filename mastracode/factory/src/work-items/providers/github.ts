import { externalAdapter, mergedState } from './base.js';

const GITHUB_URL = /^https?:\/\/[^/]+\/([^/]+\/[^/]+)\/(?:issues|pull)\/(\d+)/;

function githubNumber(metadata: Record<string, unknown>, pullRequest: boolean): unknown {
  return (pullRequest ? metadata.githubPullRequestNumber : metadata.githubIssueNumber) ?? metadata.number;
}

/** GitHub issues and pull requests: `acme/app#12`. */
export const githubWorkItemAdapter = externalAdapter('github', {
  providerMetadataKeys: [
    'githubRepositoryId',
    'githubIssueNumber',
    'githubPullRequestNumber',
    'githubAssigneesUpdatedAt',
    'draft',
    'merged',
    'headBranch',
    'baseBranch',
    'requestedReviewers',
  ],
  kind: source => (source.type === 'pull-request' ? 'pull_request' : 'issue'),
  key: (source, metadata) => {
    const match = source.url ? GITHUB_URL.exec(source.url) : null;
    if (match) return `${match[1]}#${match[2]}`;
    const number = githubNumber(metadata, source.type === 'pull-request');
    return typeof number === 'number' ? `#${number}` : null;
  },
  state: mergedState,
});
