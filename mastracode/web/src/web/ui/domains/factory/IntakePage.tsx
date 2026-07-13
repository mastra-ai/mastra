import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { CircleDot } from 'lucide-react';
import { useState } from 'react';

import { useApiConfig } from '../../../../shared/api/config';
import { relativeTime } from '../../../../shared/lib/date';
import { SkeletonRows } from '../../ui';
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
 * The page is a two-column layout: a source rail on the left (one entry per
 * enabled source) and the selected source's paginated issue list on the
 * right. Both sources sync only the projects explicitly picked in Settings ›
 * General › Intake sources: GitHub shows the active project's issues when
 * it's selected, and Linear shows the selected projects' active issues
 * (narrowed server-side). Nothing is synced until something is picked.
 */
export function IntakePage() {
  return (
    <FactoryPageShell
      title="Intake"
      description="Open issues from your configured sources."
      maxWidthClassName="max-w-4xl"
    >
      {project => <IntakeSources githubProjectId={project.githubProjectId} />}
    </FactoryPageShell>
  );
}

type IntakeSourceId = 'github' | 'linear';

interface IntakeSourceEntry {
  id: IntakeSourceId;
  label: string;
  /** Dot color hinting at the source brand (layout-level accent choice). */
  dotClassName: string;
  /** Short status line shown under the label when the source needs attention. */
  hint?: string;
}

function IntakeSources({ githubProjectId }: { githubProjectId: string }) {
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const [selectedSource, setSelectedSource] = useState<IntakeSourceId | null>(null);

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

  const sources: IntakeSourceEntry[] = [];
  if (githubEnabled) {
    sources.push({
      id: 'github',
      label: 'GitHub',
      dotClassName: 'bg-accent1',
      hint: githubSelected ? undefined : 'Not selected',
    });
  }
  if (showLinear) {
    sources.push({
      id: 'linear',
      label: 'Linear',
      dotClassName: 'bg-accent3',
      hint: !linearConnected ? 'Not connected' : linearSelectedCount === 0 ? 'No projects selected' : undefined,
    });
  }

  if (sources.length === 0) {
    return (
      <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
        No intake sources are enabled. Turn them on in Settings › General.
      </Txt>
    );
  }

  // Fall back to the first visible source when nothing (or a now-hidden
  // source) is selected.
  const activeSource = sources.find(s => s.id === selectedSource)?.id ?? sources[0].id;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <nav aria-label="Intake sources" className="flex shrink-0 flex-row gap-1 md:w-44 md:flex-col">
        {sources.map(source => (
          <SourceNavButton
            key={source.id}
            source={source}
            active={activeSource === source.id}
            onSelect={() => setSelectedSource(source.id)}
          />
        ))}
      </nav>
      <div className="min-w-0 flex-1">
        {activeSource === 'github' ? (
          <section className="flex flex-col gap-3" aria-label="GitHub issues">
            {githubSelected ? (
              <IssueList githubProjectId={githubProjectId} />
            ) : (
              <Txt as="p" variant="ui-sm" className="m-0 text-icon3">
                This project isn&apos;t selected as a GitHub intake source. Pick it in Settings › General.
              </Txt>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-3" aria-label="Linear issues">
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
    </div>
  );
}

function SourceNavButton({
  source,
  active,
  onSelect,
}: {
  source: IntakeSourceEntry;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active || undefined}
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition ${
        active ? 'bg-surface4' : 'hover:bg-surface3'
      }`}
    >
      <span className={`size-2 shrink-0 rounded-full ${source.dotClassName}`} aria-hidden />
      <span className="flex min-w-0 flex-col">
        <span className={`truncate text-ui-sm ${active ? 'text-icon6' : 'text-icon4'}`}>{source.label}</span>
        {source.hint && <span className="truncate text-ui-xs text-icon3">{source.hint}</span>}
      </span>
    </button>
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
