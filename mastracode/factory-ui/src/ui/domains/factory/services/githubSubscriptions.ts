export interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  url: string;
}

export interface PullRequestSubscriptionsResponse {
  subscriptions: PullRequestSubscription[];
}

export function pullRequestSubscriptionsQueryKey(resourceId: string, threadId: string, projectPath?: string) {
  return ['github', 'subscriptions', resourceId, threadId, projectPath] as const;
}

export async function listPullRequestSubscriptions(
  baseUrl: string,
  resourceId: string,
  threadId: string,
  projectPath?: string,
): Promise<PullRequestSubscriptionsResponse> {
  const params = new URLSearchParams({ resourceId, threadId });
  if (projectPath) params.set('scope', projectPath);
  const response = await fetch(`${baseUrl}/web/github/subscriptions?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(`Failed to load pull request subscriptions (${response.status}).`);
  return response.json();
}
