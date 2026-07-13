import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { GitPullRequest } from 'lucide-react';

import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { FactoryItemActions } from './components/FactoryItemActions';
import { FactoryPageShell } from './components/FactoryPageShell';
import { LoadMoreSentinel } from './components/LoadMoreSentinel';
import { useProjectPullRequestsQuery } from '../../../../shared/hooks/useFactoryData';
import { useStartFactoryRun } from '../../../../shared/hooks/useStartFactoryRun';
import type { GithubPullRequest } from './services/factory';

/** Factory › Review: the project's open, non-draft pull requests. */
export function ReviewPage() {
  return (
    <FactoryPageShell title="Review" description="Open pull requests for this project (drafts excluded).">
      {project => <PullRequestList githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function prBranch(pr: GithubPullRequest): string {
  return `factory/pr-${pr.number}`;
}

function prPrompt(pr: GithubPullRequest): string {
  return [
    `Use the understand-pr skill to review GitHub pull request #${pr.number}: "${pr.title}" (${pr.url}).`,
    `The PR head branch is ${pr.headBranch}; check it out in this worktree first (e.g. \`gh pr checkout ${pr.number}\`).`,
  ].join(' ');
}

function prCustomPrompt(pr: GithubPullRequest, instructions: string): string {
  return [
    `Regarding GitHub pull request #${pr.number}: "${pr.title}" (${pr.url}).`,
    `The PR head branch is ${pr.headBranch}; check it out in this worktree first (e.g. \`gh pr checkout ${pr.number}\`).`,
    instructions,
  ].join(' ');
}

function PullRequestList({ githubProjectId }: { githubProjectId: string }) {
  const pulls = useProjectPullRequestsQuery(githubProjectId);
  const { start, enabled } = useStartFactoryRun();

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
    <>
      {start.isError && (
        <Notice variant="destructive">
          {start.error instanceof Error ? start.error.message : 'Failed to start review'}
        </Notice>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Open pull requests">
        {pulls.data.map(pr => (
          <PullRequestRow
            key={pr.number}
            pr={pr}
            starting={start.isPending && start.variables?.branch === prBranch(pr)}
            disabled={!enabled || start.isPending}
            onRun={prompt =>
              start.mutate({
                branch: prBranch(pr),
                threadTitle: `PR #${pr.number}: ${pr.title}`,
                prompt: prompt === undefined ? prPrompt(pr) : prCustomPrompt(pr, prompt),
              })
            }
          />
        ))}
      </ul>
      <LoadMoreSentinel
        hasNextPage={pulls.hasNextPage}
        isFetchingNextPage={pulls.isFetchingNextPage}
        onLoadMore={pulls.fetchNextPage}
        label="Load more pull requests"
      />
    </>
  );
}

function PullRequestRow({
  pr,
  starting,
  disabled,
  onRun,
}: {
  pr: GithubPullRequest;
  starting: boolean;
  disabled: boolean;
  /** Start a run; `undefined` = default Review, string = custom prompt. */
  onRun: (prompt?: string) => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-md px-2 py-2 transition hover:bg-surface3">
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-start gap-2.5 no-underline"
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
      <FactoryItemActions
        actionLabel="Review"
        itemLabel={`pull request #${pr.number}`}
        starting={starting}
        disabled={disabled}
        onAction={() => onRun()}
        onRunPrompt={prompt => onRun(prompt)}
      />
    </li>
  );
}
