import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequest } from 'lucide-react';

import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { FactoryPageShell } from './components/FactoryPageShell';
import { useProjectPullRequestsQuery } from './hooks/useFactoryData';
import type { GithubPullRequest } from './services/factory';

/** Factory › Review: the project's open, non-draft pull requests. */
export function ReviewPage() {
  return (
    <FactoryPageShell title="Review" description="Open pull requests for this project (drafts excluded).">
      {project => <PullRequestList githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function PullRequestList({ githubProjectId }: { githubProjectId: string }) {
  const pulls = useProjectPullRequestsQuery(githubProjectId);

  if (pulls.isPending) return <SkeletonRows label="Loading pull requests" rows={5} rowClassName="h-12 w-full" />;
  if (pulls.isError) {
    return (
      <Notice variant="destructive">
        {pulls.error instanceof Error ? pulls.error.message : 'Failed to load pull requests'}
      </Notice>
    );
  }
  if (pulls.data.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No open pull requests.
      </Txt>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Open pull requests">
      {pulls.data.map(pr => (
        <PullRequestRow key={pr.number} pr={pr} />
      ))}
    </ul>
  );
}

function PullRequestRow({ pr }: { pr: GithubPullRequest }) {
  return (
    <li>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2.5 rounded-md px-2 py-2 no-underline transition hover:bg-surface3"
      >
        <GitPullRequest size={15} className="mt-0.5 shrink-0 text-accent1" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-ui-md text-icon6">{pr.title}</span>
          <span className="truncate text-ui-xs text-icon3">
            #{pr.number}
            {pr.author ? ` · ${pr.author}` : ''} · {pr.headBranch} → {pr.baseBranch} · updated{' '}
            {relativeTime(pr.updatedAt)}
          </span>
        </span>
      </a>
    </li>
  );
}
