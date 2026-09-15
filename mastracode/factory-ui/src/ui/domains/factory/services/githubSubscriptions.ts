export interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  url: string;
}

export function pullRequestSubscriptionsQueryKey(
  resourceId: string,
  threadId: string | undefined,
  projectPath?: string,
) {
  return ['github', 'subscriptions', resourceId, threadId, projectPath] as const;
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
    value.pullRequestNumber > 0 &&
    isPullRequestStatus(value.status) &&
    typeof value.url === 'string'
  );
}

export async function listPullRequestSubscriptions(
  baseUrl: string,
  resourceId: string,
  threadId: string,
  projectPath?: string,
): Promise<PullRequestSubscription[]> {
  const params = new URLSearchParams({ resourceId, threadId });
  if (projectPath) params.set('scope', projectPath);
  const response = await fetch(`${baseUrl}/web/github/subscriptions?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to load pull request subscriptions (${response.status}).`);

  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.subscriptions)) {
    throw new Error('Pull request subscriptions returned an invalid response.');
  }
  // one bad row must not hide every other pull request; warn so a widened server enum is not silent
  const subscriptions = body.subscriptions.filter(isPullRequestSubscription);
  const dropped = body.subscriptions.length - subscriptions.length;
  if (dropped > 0 && import.meta.env.DEV) {
    console.warn(`Dropped ${dropped} pull request subscription(s) the client does not understand.`);
  }
  return subscriptions;
}
