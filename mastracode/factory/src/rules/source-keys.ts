export function githubIssueSourceKey(repositoryId: number, issueNumber: number): string {
  return `github-issue:${repositoryId}:${issueNumber}`;
}

export function githubPullRequestSourceKey(repositoryId: number, pullRequestNumber: number): string {
  return `github-pr:${repositoryId}:${pullRequestNumber}`;
}

export function linearIssueSourceKey(issueId: string): string {
  return `linear:${issueId}`;
}
