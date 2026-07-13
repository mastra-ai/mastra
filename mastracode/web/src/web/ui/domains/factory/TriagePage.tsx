import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot } from 'lucide-react';

import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { FactoryItemActions } from './components/FactoryItemActions';
import { FactoryPageShell } from './components/FactoryPageShell';
import { LoadMoreSentinel } from './components/LoadMoreSentinel';
import { useProjectIssuesQuery } from './hooks/useFactoryData';
import { useStartFactoryRun } from './hooks/useStartFactoryRun';
import type { GithubIssue } from './services/factory';

const AUTO_TRIAGED_LABEL = 'auto-triaged';
const IN_TRIAGE_LABEL = 'in-triage';
const NEEDS_APPROVAL_LABEL = 'needs-approval';
const DONE_LABEL = 'done';

/** Factory › Triage: GitHub issues currently labeled auto-triaged. */
export function TriagePage() {
  return (
    <FactoryPageShell title="Triage" description="Auto-triaged issues and their label-driven next actions.">
      {project => <TriageIssueList githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function triageBranch(issue: GithubIssue): string {
  return `factory/triage-${issue.number}`;
}

function triagePrompt(issue: GithubIssue): string {
  return [
    `Use the triage-issue skill in headless mode for GitHub issue #${issue.number}: "${issue.title}" (${issue.url}).`,
    `Current labels: ${issue.labels.length > 0 ? issue.labels.join(', ') : 'none'}.`,
    'Post or update the GitHub issue triage comment only; do not create a Maintainer\'s Triage Note.',
    'Apply the triage-issue lifecycle label policy as needed.',
  ].join(' ');
}

function triageCustomPrompt(issue: GithubIssue, instructions: string): string {
  return [
    `Regarding GitHub issue #${issue.number}: "${issue.title}" (${issue.url}).`,
    `Current labels: ${issue.labels.length > 0 ? issue.labels.join(', ') : 'none'}.`,
    instructions,
  ].join(' ');
}

function actionForIssue(issue: GithubIssue): { label: string; status: string; disabled: boolean } {
  const labels = new Set(issue.labels);
  if (labels.has(DONE_LABEL)) return { label: 'View result', status: 'Done', disabled: true };
  if (labels.has(NEEDS_APPROVAL_LABEL)) return { label: 'Prepare approval', status: 'Needs approval', disabled: false };
  if (labels.has(IN_TRIAGE_LABEL)) return { label: 'Continue triage', status: 'In triage', disabled: false };
  return { label: 'Run triage', status: 'Ready for triage', disabled: false };
}

function TriageIssueList({ githubProjectId }: { githubProjectId: string }) {
  const issues = useProjectIssuesQuery(githubProjectId, AUTO_TRIAGED_LABEL);
  const { start, enabled } = useStartFactoryRun();

  if (issues.isPending) return <SkeletonRows label="Loading triage issues" rows={5} rowClassName="h-12 w-full" />;
  if (issues.isError) {
    return (
      <Notice variant="destructive">
        {issues.error instanceof Error ? issues.error.message : 'Failed to load triage issues'}
      </Notice>
    );
  }
  if (issues.data.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No auto-triaged issues.
      </Txt>
    );
  }

  return (
    <>
      {start.isError && (
        <Notice variant="destructive">
          {start.error instanceof Error ? start.error.message : 'Failed to start triage'}
        </Notice>
      )}
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Auto-triaged issues">
        {issues.data.map(issue => {
          const action = actionForIssue(issue);
          return (
            <TriageIssueRow
              key={issue.number}
              issue={issue}
              actionLabel={action.label}
              status={action.status}
              starting={start.isPending && start.variables?.branch === triageBranch(issue)}
              disabled={!enabled || start.isPending || action.disabled}
              onRun={prompt =>
                start.mutate({
                  branch: triageBranch(issue),
                  threadTitle: `Triage #${issue.number}: ${issue.title}`,
                  prompt: prompt === undefined ? triagePrompt(issue) : triageCustomPrompt(issue, prompt),
                })
              }
            />
          );
        })}
      </ul>
      <LoadMoreSentinel
        hasNextPage={issues.hasNextPage}
        isFetchingNextPage={issues.isFetchingNextPage}
        onLoadMore={issues.fetchNextPage}
        label="Load more triage issues"
      />
    </>
  );
}

function TriageIssueRow({
  issue,
  actionLabel,
  status,
  starting,
  disabled,
  onRun,
}: {
  issue: GithubIssue;
  actionLabel: string;
  status: string;
  starting: boolean;
  disabled: boolean;
  onRun: (prompt?: string) => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-md px-2 py-2 transition hover:bg-surface3">
      <a href={issue.url} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-start gap-2.5 no-underline">
        <CircleDot size={15} className="mt-0.5 shrink-0 text-accent1" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-ui-md text-icon6">{issue.title}</span>
          <span className="text-ui-xs text-icon3">
            #{issue.number}
            {issue.author ? ` · ${issue.author}` : ''} · {status} · updated {relativeTime(issue.updatedAt)}
          </span>
          <span className="flex flex-wrap gap-1" aria-label={`Labels for issue #${issue.number}`}>
            {issue.labels.map(label => (
              <span key={label} className="rounded-md bg-surface4 px-1.5 py-0.5 text-ui-xs text-icon4">
                {label}
              </span>
            ))}
          </span>
        </span>
      </a>
      <FactoryItemActions
        actionLabel={actionLabel}
        itemLabel={`issue #${issue.number}`}
        starting={starting}
        disabled={disabled}
        onAction={() => onRun()}
        onRunPrompt={prompt => onRun(prompt)}
      />
    </li>
  );
}
