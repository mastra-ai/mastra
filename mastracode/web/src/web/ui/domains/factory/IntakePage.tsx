import { Badge } from '@mastra/playground-ui/components/Badge';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot, MessageSquare } from 'lucide-react';

import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
import { FactoryPageShell } from './components/FactoryPageShell';
import { useProjectIssuesQuery } from './hooks/useFactoryData';
import type { GithubIssue } from './services/factory';

/** Factory › Intake: the project's open GitHub issues. */
export function IntakePage() {
  return (
    <FactoryPageShell title="Intake" description="Open GitHub issues for this project.">
      {project => <IssueList githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function IssueList({ githubProjectId }: { githubProjectId: string }) {
  const issues = useProjectIssuesQuery(githubProjectId);

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
    <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Open issues">
      {issues.data.map(issue => (
        <IssueRow key={issue.number} issue={issue} />
      ))}
    </ul>
  );
}

function IssueRow({ issue }: { issue: GithubIssue }) {
  return (
    <li>
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-start gap-2.5 rounded-md px-2 py-2 no-underline transition hover:bg-surface3"
      >
        <CircleDot size={15} className="mt-0.5 shrink-0 text-accent1" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-ui-md text-icon6">{issue.title}</span>
            {issue.labels.map(label => (
              <Badge key={label} className="shrink-0">
                {label}
              </Badge>
            ))}
          </span>
          <span className="text-ui-xs text-icon3">
            #{issue.number}
            {issue.author ? ` · ${issue.author}` : ''} · opened {relativeTime(issue.createdAt)}
          </span>
        </span>
        {issue.comments > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-ui-xs text-icon3">
            <MessageSquare size={13} aria-hidden />
            {issue.comments}
          </span>
        )}
      </a>
    </li>
  );
}
