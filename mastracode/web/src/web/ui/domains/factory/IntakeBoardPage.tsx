import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { useState } from 'react';

import { useProjectIssuesQuery, useProjectPullRequestsQuery, useStartIssueTriageMutation } from '../../../../shared/hooks/useFactoryData';
import { useIntakeConfigQuery } from '../../../../shared/hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../shared/hooks/useLinearData';
import { useUpsertWorkItemMutation, useWorkItemsQuery } from '../../../../shared/hooks/useWorkItems';
import { excludeFiledBySourceKey, hasLabel } from './boardUtils';
import { Board, LoadMoreButton } from './components/Board';
import type { BoardCard } from './components/Board';
import { FactoryPageShell } from './components/FactoryPageShell';
import type { GithubIssue, GithubPullRequest } from './services/factory';
import type { LinearIssue } from './services/linear';
import type { CreateWorkItemInput } from './services/workItems';

const AUTO_TRIAGED_LABEL = 'auto-triaged';
type IntakeSource = 'github' | 'github-prs' | 'linear';

export function IntakeBoardPage() {
  return (
    <FactoryPageShell title="Intake" description="Browse and file incoming issues and pull requests.">
      {factory => <IntakeBoard githubProjectId={factory.binding.githubProjectId} />}
    </FactoryPageShell>
  );
}

function IntakeBoard({ githubProjectId }: { githubProjectId: string }) {
  const config = useIntakeConfigQuery();
  const linearStatus = useLinearStatusQuery();
  const items = useWorkItemsQuery(githubProjectId);
  const [source, setSource] = useState<IntakeSource>('github');
  const githubEnabled = config.data?.github.enabled ?? false;
  const githubSelected = config.data?.github.repositoryIds?.includes(githubProjectId) ?? false;
  const linearEnabled = Boolean(
    config.data?.linear.enabled &&
      config.data.linear.projectIds?.length &&
      linearStatus.data?.enabled &&
      linearStatus.data.connected,
  );
  const available: IntakeSource[] = [
    ...(githubEnabled && githubSelected ? (['github'] as const) : []),
    'github-prs',
    ...(linearEnabled ? (['linear'] as const) : []),
  ];
  const activeSource = available.includes(source) ? source : available[0];
  const issues = useProjectIssuesQuery(activeSource === 'github' ? githubProjectId : undefined);
  const pulls = useProjectPullRequestsQuery(activeSource === 'github-prs' ? githubProjectId : undefined);
  const linear = useLinearIssuesQuery(activeSource === 'linear');
  const upsert = useUpsertWorkItemMutation(githubProjectId);
  const { triage, pendingIssueNumbers } = useStartIssueTriageMutation(githubProjectId);

  if (config.isPending || linearStatus.isPending || items.isPending) return <p role="status">Loading Intake board</p>;
  const activeQuery = activeSource === 'github' ? issues : activeSource === 'github-prs' ? pulls : linear;
  if (config.isError || items.isError || activeQuery.isError) {
    const error = config.error ?? items.error ?? activeQuery.error;
    return <Notice variant="destructive">{error instanceof Error ? error.message : 'Failed to load Intake'}</Notice>;
  }

  const candidates = excludeFiledBySourceKey(candidateCards(activeSource, issues.data, pulls.data, linear.data), items.data);
  const filed = (items.data ?? []).filter(item => item.stages.includes('intake'));
  const file = (input: CreateWorkItemInput) => upsert.mutate(input);
  const cards: BoardCard[] = [
    ...candidates.map(candidate => ({
      ...candidate,
      action: (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => file(candidate.input)} disabled={upsert.isPending}>File</Button>
          {candidate.issue && !hasLabel(candidate.issue.labels, AUTO_TRIAGED_LABEL) ? (
            <Button size="sm" variant="ghost" onClick={() => triage.mutate(candidate.issue!)} disabled={pendingIssueNumbers.includes(candidate.issue.number)}>
              {pendingIssueNumbers.includes(candidate.issue.number) ? 'Triaging…' : 'Triage'}
            </Button>
          ) : null}
        </div>
      ),
    })),
    ...filed.map(item => ({ id: item.id, title: item.title, url: item.url ?? undefined, meta: item.source.replaceAll('-', ' ') })),
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex gap-2" aria-label="Intake source">
        {available.map(value => <Button key={value} size="sm" variant={activeSource === value ? 'default' : 'ghost'} onClick={() => setSource(value)}>{sourceLabel(value)}</Button>)}
      </div>
      <Board
        error={upsert.error instanceof Error ? upsert.error.message : triage.error instanceof Error ? triage.error.message : undefined}
        columns={[{
          id: 'intake', title: 'Intake', cards, emptyLabel: 'No incoming work.',
          footer: activeQuery.hasNextPage ? <LoadMoreButton onClick={() => void activeQuery.fetchNextPage()} pending={activeQuery.isFetchingNextPage} /> : undefined,
        }]}
      />
    </div>
  );
}

interface CandidateCard extends BoardCard { sourceKey: string; input: CreateWorkItemInput; issue?: GithubIssue }

function candidateCards(source: IntakeSource | undefined, issues: GithubIssue[] | undefined, pulls: GithubPullRequest[] | undefined, linear: LinearIssue[] | undefined): CandidateCard[] {
  if (source === 'github') return (issues ?? []).filter(issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL)).map(issue => ({
    id: `github-issue:${issue.number}`, sourceKey: `github-issue:${issue.number}`, title: issue.title, url: issue.url,
    meta: `#${issue.number}${issue.author ? ` · ${issue.author}` : ''}`, issue,
    input: { source: 'github-issue', sourceKey: `github-issue:${issue.number}`, title: issue.title, url: issue.url, stages: ['intake'], metadata: { number: issue.number, labels: issue.labels, author: issue.author } },
  }));
  if (source === 'github-prs') return (pulls ?? []).map(pull => ({
    id: `github-pr:${pull.number}`, sourceKey: `github-pr:${pull.number}`, title: pull.title, url: pull.url,
    meta: `#${pull.number}${pull.author ? ` · ${pull.author}` : ''}`,
    input: { source: 'github-pr', sourceKey: `github-pr:${pull.number}`, title: pull.title, url: pull.url, stages: ['intake'], metadata: { number: pull.number, author: pull.author, headBranch: pull.headBranch, baseBranch: pull.baseBranch } },
  }));
  return (linear ?? []).map(issue => ({
    id: `linear-issue:${issue.id}`, sourceKey: `linear-issue:${issue.id}`, title: issue.title, url: issue.url,
    meta: `${issue.identifier} · ${issue.state}`,
    input: { source: 'linear-issue', sourceKey: `linear-issue:${issue.id}`, title: issue.title, url: issue.url, stages: ['intake'], metadata: { identifier: issue.identifier, state: issue.state, assignee: issue.assignee } },
  }));
}

function sourceLabel(source: IntakeSource): string {
  if (source === 'github') return 'Issues';
  if (source === 'github-prs') return 'PRs';
  return 'Linear';
}
