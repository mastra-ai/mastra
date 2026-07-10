import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot, Play } from 'lucide-react';

import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { FactoryPageShell } from './components/FactoryPageShell';
import { LoadMoreSentinel } from './components/LoadMoreSentinel';
import { useProjectIssuesQuery } from './hooks/useFactoryData';
import { useStartFactoryRun } from './hooks/useStartFactoryRun';
import type { GithubIssue } from './services/factory';

/** Factory › Intake: the project's open GitHub issues. */
export function IntakePage() {
  return (
    <FactoryPageShell title="Intake" description="Open GitHub issues for this project.">
      {project => <IssueList githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function issueBranch(issue: GithubIssue): string {
  return `factory/issue-${issue.number}`;
}

function issuePrompt(issue: GithubIssue): string {
  return `Use the understand-issue skill to investigate GitHub issue #${issue.number}: "${issue.title}" (${issue.url}).`;
}

function IssueList({ githubProjectId }: { githubProjectId: string }) {
  const issues = useProjectIssuesQuery(githubProjectId);
  const { start, enabled } = useStartFactoryRun();

  if (issues.isPending) return <SkeletonRows label="Loading issues" rows={5} rowClassName="h-12 w-full" />;
  if (issues.isError) {
    return (
      <Notice variant="destructive">
        {issues.error instanceof Error ? issues.error.message : 'Failed to load issues'}
      </Notice>
    );
  }
  if (issues.data.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No open issues.
      </Txt>
    );
  }

  return (
    <>
      {start.isError && (
        <Notice variant="destructive">
          {start.error instanceof Error ? start.error.message : 'Failed to start investigation'}
        </Notice>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Open issues">
        {issues.data.map(issue => (
          <IssueRow
            key={issue.number}
            issue={issue}
            starting={start.isPending && start.variables?.branch === issueBranch(issue)}
            disabled={!enabled || start.isPending}
            onInvestigate={() =>
              start.mutate({
                branch: issueBranch(issue),
                threadTitle: `Issue #${issue.number}: ${issue.title}`,
                prompt: issuePrompt(issue),
              })
            }
          />
        ))}
      </ul>
      <LoadMoreSentinel
        hasNextPage={issues.hasNextPage}
        isFetchingNextPage={issues.isFetchingNextPage}
        onLoadMore={issues.fetchNextPage}
        label="Load more issues"
      />
    </>
  );
}

function IssueRow({
  issue,
  starting,
  disabled,
  onInvestigate,
}: {
  issue: GithubIssue;
  starting: boolean;
  disabled: boolean;
  onInvestigate: () => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-md px-2 py-2 transition hover:bg-surface3">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-start gap-2.5 no-underline"
      >
        <CircleDot size={15} className="mt-0.5 shrink-0 text-accent1" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-ui-md text-icon6">{issue.title}</span>
          <span className="text-ui-xs text-icon3">
            #{issue.number}
            {issue.author ? ` · ${issue.author}` : ''} · opened {relativeTime(issue.createdAt)}
          </span>
        </span>
      </a>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        aria-label={`Investigate issue #${issue.number}`}
        disabled={disabled}
        onClick={onInvestigate}
      >
        <Play size={13} aria-hidden />
        {starting ? 'Starting…' : 'Investigate'}
      </Button>
    </li>
  );
}
