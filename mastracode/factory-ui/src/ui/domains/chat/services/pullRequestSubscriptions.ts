export interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  url: string;
}

interface PullRequestSubscriptionsResponse {
  subscriptions: PullRequestSubscription[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPullRequestStatus(value: unknown): value is PullRequestSubscription['status'] {
  return value === 'open' || value === 'closed' || value === 'merged';
}

function isPullRequestSubscription(value: unknown): value is PullRequestSubscription {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.repoFullName === 'string' &&
    typeof value.pullRequestNumber === 'number' &&
    Number.isInteger(value.pullRequestNumber) &&
    isPullRequestStatus(value.status) &&
    typeof value.url === 'string'
  );
}

function isPullRequestSubscriptionsResponse(value: unknown): value is PullRequestSubscriptionsResponse {
  return isRecord(value) && Array.isArray(value.subscriptions) && value.subscriptions.every(isPullRequestSubscription);
}

export async function fetchPullRequestSubscriptions(
  baseUrl: string,
  resourceId: string,
  threadId: string,
  projectPath: string | undefined,
): Promise<PullRequestSubscription[]> {
  const params = new URLSearchParams({ resourceId, threadId });
  if (projectPath) params.set('scope', projectPath);

  const response = await fetch(`${baseUrl}/web/github/subscriptions?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to load pull request subscriptions (${response.status}).`);

  const body: unknown = await response.json();
  if (!isPullRequestSubscriptionsResponse(body)) {
    throw new Error('Pull request subscriptions returned an invalid response.');
  }
  return body.subscriptions;
}
