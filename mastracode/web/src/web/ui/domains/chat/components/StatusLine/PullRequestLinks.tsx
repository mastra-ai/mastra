import { useQuery } from '@tanstack/react-query';
import { GitPullRequest } from 'lucide-react';
import { useParams } from 'react-router';

import { useChatSessionContext } from '../../context/useChatSessionContext';

interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  url: string;
}

interface PullRequestSubscriptionsResponse {
  subscriptions: PullRequestSubscription[];
}

/** Pull requests subscribed to the active GitHub-backed thread. */
export function PullRequestLinks() {
  const { threadId } = useParams<{ threadId: string }>();
  const { baseUrl, resourceId, projectPath, projectState } = useChatSessionContext();
  const githubProjectId = projectState?.githubProjectId;
  const enabled = typeof githubProjectId === 'string' && Boolean(threadId);
  const query = useQuery({
    queryKey: ['github', 'subscriptions', resourceId, threadId, projectPath],
    queryFn: async () => {
      if (!threadId) return { subscriptions: [] };
      const params = new URLSearchParams({ resourceId, threadId });
      if (projectPath) params.set('scope', projectPath);
      const response = await fetch(`${baseUrl}/web/github/subscriptions?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`Failed to load pull request subscriptions (${response.status}).`);
      return response.json() as Promise<PullRequestSubscriptionsResponse>;
    },
    enabled,
  });

  if (!query.data?.subscriptions.length) return null;

  return (
    <div className="flex items-center gap-2">
      {query.data.subscriptions.map(subscription => (
        <a
          key={subscription.id}
          href={subscription.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-icon3 hover:text-icon5"
          aria-label={`Open ${subscription.repoFullName} pull request ${subscription.pullRequestNumber}`}
        >
          <GitPullRequest size={13} /> PR #{subscription.pullRequestNumber}
        </a>
      ))}
    </div>
  );
}
