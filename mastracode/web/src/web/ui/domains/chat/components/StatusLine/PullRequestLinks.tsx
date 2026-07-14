import { useQuery } from '@tanstack/react-query';
import { CircleDot, CircleX, GitMerge } from 'lucide-react';
import { useParams } from 'react-router';

import { useChatSessionContext } from '../../context/useChatSessionContext';

interface PullRequestSubscription {
  id: string;
  repoFullName: string;
  pullRequestNumber: number;
  status: 'open' | 'closed' | 'merged';
  url: string;
}

interface PullRequestSubscriptionsResponse {
  subscriptions: PullRequestSubscription[];
}

function PullRequestIcon({ status }: { status: PullRequestSubscription['status'] }) {
  if (status === 'merged') return <GitMerge size={13} aria-hidden />;
  if (status === 'closed') return <CircleX size={13} aria-hidden />;
  return <CircleDot size={13} aria-hidden />;
}

function statusColor(status: PullRequestSubscription['status']): string {
  if (status === 'merged') return 'text-accent3 hover:text-accent3';
  if (status === 'closed') return 'text-error hover:text-error';
  return 'text-accent1 hover:text-accent1';
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
          className={`inline-flex items-center gap-1 ${statusColor(subscription.status)}`}
          aria-label={`Open ${subscription.status} ${subscription.repoFullName} pull request ${subscription.pullRequestNumber}`}
        >
          <PullRequestIcon status={subscription.status} /> PR #{subscription.pullRequestNumber}
        </a>
      ))}
    </div>
  );
}
