import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { CircleDot } from 'lucide-react';
import { useApiConfig } from '#shared/api/config';
import { relativeTime } from '#shared/lib/date';
import { SkeletonRows } from '../../ui/SkeletonRows';
import { FactoryItemActions } from './components/FactoryItemActions';
import { FactoryPageShell } from './components/FactoryPageShell';
import { LoadMoreSentinel } from './components/LoadMoreSentinel';
import { useProjectIssuesQuery } from './hooks/useFactoryData';
import { useIntakeConfigQuery } from './hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from './hooks/useLinearData';
import { useStartFactoryRun } from './hooks/useStartFactoryRun';
import type { GithubIssue } from './services/factory';
import type { LinearIssue } from './services/linear';
import { connectLinear } from './services/linear';

/**
 * Factory › Intake: open issues from the configured intake sources.
 *
 * Both sources sync only the projects explicitly picked in Settings › General
 * › Intake sources: GitHub shows the active project's issues when it's
 * selected, and Linear shows the selected projects' active issues (narrowed
 * server-side). Nothing is synced until something is picked.
 */
export function IntakePage() {
  return (
    <FactoryPageShell title="Intake" description="Open issues from your configured sources.">
      {project => <IntakeSources githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

function IntakeSources({ githubProjectId }: { githubProjectId: string }) {
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  if (configQuery.isPending) return <SkeletonRows label="Loading intake sources" rows={5} rowClassName="h-12 w-full" />;

  // On a config error, fall back to the GitHub-only view rather than a dead end.
  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  // Nothing selected means nothing synced: the active project must be picked
  // in Settings for its issues to appear here.
  const githubSelected = config ? (config.github.projectIds?.includes(githubProjectId) ?? false) : true;
  const linearEnabled = config?.linear.enabled ?? false;
  const linearSelectedCount = config?.linear.projectIds?.length ?? 0;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  const showLinear = linearEnabled && linearFeature;

  if (!githubEnabled && !showLinear) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No intake sources are enabled. Turn them on in Settings › General.
      </Txt>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {githubEnabled && (
        <section className="flex flex-col gap-3" aria-label="GitHub issues">
          <SourceHeading label="GitHub" />
          {githubSelected ? (
            <IssueList githubProjectId={githubProjectId} />
          ) : (
            <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
              This project isn&apos;t selected as a GitHub intake source. Pick it in Settings › General.
            </Txt>
          )}
        </section>
      )}
      {showLinear && (
        <section className="flex flex-col gap-3" aria-label="Linear issues">
          <SourceHeading label="Linear" />
          {!linearConnected ? (
            <LinearConnectNotice />
          ) : linearSelectedCount === 0 ? (
            <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
              No Linear projects selected. Pick them in Settings › General.
            </Txt>
          ) : (
            <LinearIssueList />
          )}
        </section>
      )}
    </div>
  );
}

function SourceHeading({ label }: { label: string }) {
  return (
    <Txt as="h2" variant="ui-sm" className="m-0 font-medium uppercase tracking-wide text-icon3">
      {label}
    </Txt>
  );
}

function LinearConnectNotice() {
  const { baseUrl } = useApiConfig();
  return (
    <div className="flex items-center gap-3">
      <Txt as="span" variant="ui-sm" className="text-icon3">
        Connect a Linear workspace to see its issues here.
      </Txt>
      <Button size="xs" onClick={() => connectLinear(baseUrl)}>
        Connect Linear
      </Button>
    </div>
  );
}

// ── GitHub ───────────────────────────────────────────────────────────────

function issueBranch(issue: GithubIssue): string {
  return `factory/issue-${issue.number}`;
}

function issuePrompt(issue: GithubIssue): string {
  return `Use the understand-issue skill to investigate GitHub issue #${issue.number}: "${issue.title}" (${issue.url}).`;
}

function issueCustomPrompt(issue: GithubIssue, instructions: string): string {
  return `Regarding GitHub issue #${issue.number}: "${issue.title}" (${issue.url}). ${instructions}`;
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
            onRun={prompt =>
              start.mutate({
                branch: issueBranch(issue),
                threadTitle: `Issue #${issue.number}: ${issue.title}`,
                prompt: prompt === undefined ? issuePrompt(issue) : issueCustomPrompt(issue, prompt),
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
  onRun,
}: {
  issue: GithubIssue;
  starting: boolean;
  disabled: boolean;
  /** Start a run; `undefined` = default Investigate, string = custom prompt. */
  onRun: (prompt?: string) => void;
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
      <FactoryItemActions
        actionLabel="Investigate"
        itemLabel={`issue #${issue.number}`}
        starting={starting}
        disabled={disabled}
        onAction={() => onRun()}
        onRunPrompt={prompt => onRun(prompt)}
      />
    </li>
  );
}

// ── Linear ───────────────────────────────────────────────────────────────

function linearIssueBranch(issue: LinearIssue): string {
  return `factory/linear-${issue.identifier.toLowerCase()}`;
}

function linearIssuePrompt(issue: LinearIssue): string {
  return `Use the understand-issue skill to investigate Linear issue ${issue.identifier}: "${issue.title}" (${issue.url}).`;
}

function linearIssueCustomPrompt(issue: LinearIssue, instructions: string): string {
  return `Regarding Linear issue ${issue.identifier}: "${issue.title}" (${issue.url}). ${instructions}`;
}

function LinearIssueList() {
  const issues = useLinearIssuesQuery(true);
  const { start, enabled } = useStartFactoryRun();

  if (issues.isPending) return <SkeletonRows label="Loading Linear issues" rows={5} rowClassName="h-12 w-full" />;
  if (issues.isError) {
    return (
      <Notice variant="destructive">
        {issues.error instanceof Error ? issues.error.message : 'Failed to load Linear issues'}
      </Notice>
    );
  }
  if (issues.data.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No active Linear issues.
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
      <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label="Linear issues">
        {issues.data.map(issue => (
          <LinearIssueRow
            key={issue.id}
            issue={issue}
            starting={start.isPending && start.variables?.branch === linearIssueBranch(issue)}
            disabled={!enabled || start.isPending}
            onRun={prompt =>
              start.mutate({
                branch: linearIssueBranch(issue),
                threadTitle: `${issue.identifier}: ${issue.title}`,
                prompt: prompt === undefined ? linearIssuePrompt(issue) : linearIssueCustomPrompt(issue, prompt),
              })
            }
          />
        ))}
      </ul>
      <LoadMoreSentinel
        hasNextPage={issues.hasNextPage}
        isFetchingNextPage={issues.isFetchingNextPage}
        onLoadMore={issues.fetchNextPage}
        label="Load more Linear issues"
      />
    </>
  );
}

function LinearIssueRow({
  issue,
  starting,
  disabled,
  onRun,
}: {
  issue: LinearIssue;
  starting: boolean;
  disabled: boolean;
  /** Start a run; `undefined` = default Investigate, string = custom prompt. */
  onRun: (prompt?: string) => void;
}) {
  return (
    <li className="flex items-start gap-2.5 rounded-md px-2 py-2 transition hover:bg-surface3">
      <a
        href={issue.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-start gap-2.5 no-underline"
      >
        <CircleDot size={15} className="mt-0.5 shrink-0 text-accent3" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-ui-md text-icon6">{issue.title}</span>
          <span className="text-ui-xs text-icon3">
            {issue.identifier} · {issue.state}
            {issue.assignee ? ` · ${issue.assignee}` : ''} · updated {relativeTime(issue.updatedAt)}
          </span>
        </span>
      </a>
      <FactoryItemActions
        actionLabel="Investigate"
        itemLabel={issue.identifier}
        starting={starting}
        disabled={disabled}
        onAction={() => onRun()}
        onRunPrompt={prompt => onRun(prompt)}
      />
    </li>
  );
}
