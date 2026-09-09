import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { useMemo, useState } from 'react';

import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import {
  useIntakeBindingsQuery,
  useIntakeConfigQuery,
  useIntakeLabelRoutesQuery,
} from '../../../../hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { issueCandidate, linearCandidate, pullRequestCandidate } from '../boardCandidates';
import type { BoardCandidate, IntakeFeed, IntakeSource } from '../boardCandidates';
import { hasLabel } from '../boardItems';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { BoardStageId } from '../stages';

/**
 * The Intake swimlane's feed: which candidate source is browsed, the queries
 * behind it, and the candidates left once anything already on the board is
 * dropped.
 *
 * Work Intake gates GitHub issues per account; the Review pull-request feed is
 * always enabled. Any board (Work included) only gets a Linear feed from the
 * sources explicitly routed to it, offered on the board's initial phase.
 */
const EMPTY_KEYS: ReadonlySet<string> = new Set();

export function useBoardIntake({
  factoryProjectId,
  repository,
  definition,
  knownSourceKeys,
  elsewhereSourceKeys = EMPTY_KEYS,
}: {
  factoryProjectId: string;
  repository: LinkedRepositoryPayload;
  definition: InstalledBoardInfo;
  knownSourceKeys: ReadonlySet<string>;
  /** Subset of `knownSourceKeys` whose card lives on another board. */
  elsewhereSourceKeys?: ReadonlySet<string>;
}) {
  const kind = definition.id;
  const review = kind === 'review';
  const initialPhase = definition.initialPhase;
  const projectRepositoryId = repository.projectRepositoryId;
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.sourceIds?.includes(repository.slug) ?? false) : true;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  // Linear routing is explicit: a source feeds exactly the board its binding
  // names. A board offers the Linear feed only when some source is routed to
  // it, so viewing a board never ingests issues nobody asked it to take.
  const bindingsQuery = useIntakeBindingsQuery();
  const linearRouted = (bindingsQuery.data ?? []).some(
    binding =>
      binding.integrationId === 'linear' && binding.factoryProjectId === factoryProjectId && binding.board === kind,
  );
  const linearReady =
    !review &&
    (config?.linear.enabled ?? false) &&
    linearConnected &&
    (config?.linear.sourceIds?.length ?? 0) > 0 &&
    linearRouted;

  // GitHub issues route by label: a label routed to a board sends its issues
  // there, and Work keeps every unrouted issue. A custom board only offers the
  // GitHub feed when at least one label is routed to it.
  const labelRoutesQuery = useIntakeLabelRoutesQuery(review ? undefined : factoryProjectId);
  const labelRoutes = useMemo(
    () => (labelRoutesQuery.data ?? []).filter(route => route.integrationId === 'github'),
    [labelRoutesQuery.data],
  );
  const routedHere = labelRoutes.some(route => route.board === kind);
  // Until routes resolve, Work cannot tell which issues belong elsewhere, so it
  // holds its GitHub feed rather than flashing cards that another board owns.
  const routesSettled = review || !labelRoutesQuery.isPending;

  // Work intake owns issues; Review intake owns pull requests. Keeping the
  // feeds on separate routes prevents review-producing PR work from being
  // confused with the Work board's review-receiving lane.
  const githubIntakeActive = (kind === 'work' || routedHere) && githubEnabled && githubSelected;
  const available: IntakeSource[] = review
    ? ['github-prs']
    : [...(githubIntakeActive ? (['github'] as const) : []), ...(linearReady ? (['linear'] as const) : [])];
  const [selected, setSelected] = useState<IntakeSource>(review ? 'github-prs' : 'github');
  const active: IntakeSource | undefined = available.includes(selected) ? selected : available[0];

  // Fetch every configured source so teammate filters can include provider identities
  // even when a different intake feed is visible. Only the active feed affects loading.
  const issues = useProjectIssuesQuery(!review && githubIntakeActive ? projectRepositoryId : undefined);
  // Auto-triage is a Work-only lane, so only Work browses the triaged feed.
  const triageIssues = useProjectIssuesQuery(
    kind === 'work' && active === 'github' ? projectRepositoryId : undefined,
    AUTO_TRIAGED_LABEL,
  );
  // Mirrors the server's resolution: the first route (in listing order) whose
  // label the issue carries wins; unrouted issues belong to Work.
  const boardIssues = useMemo(
    () =>
      routesSettled
        ? (issues.data ?? []).filter(
            issue => (labelRoutes.find(route => hasLabel(issue.labels, route.label))?.board ?? 'work') === kind,
          )
        : [],
    [issues.data, labelRoutes, kind, routesSettled],
  );
  const pulls = useProjectPullRequestsQuery(review ? projectRepositoryId : undefined);
  const linearIssues = useLinearIssuesQuery(!review && linearReady ? factoryProjectId : undefined);
  const boardLinearIssues = useMemo(() => {
    const bindings = (bindingsQuery.data ?? []).filter(
      binding => binding.integrationId === 'linear' && binding.factoryProjectId === factoryProjectId,
    );
    return (linearIssues.data ?? []).filter(issue => {
      const binding = issue.sourceId ? bindings.find(candidate => candidate.sourceId === issue.sourceId) : undefined;
      return binding?.board === kind;
    });
  }, [linearIssues.data, bindingsQuery.data, factoryProjectId, kind]);

  const intakeIssues = useMemo(
    () => boardIssues.filter(issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL)),
    [boardIssues],
  );
  const participantCandidates = useMemo(
    () =>
      review
        ? (pulls.data ?? []).map(pullRequestCandidate)
        : [...boardIssues.map(issueCandidate), ...boardLinearIssues.map(linearCandidate)],
    [boardIssues, pulls.data, boardLinearIssues, review],
  );
  const { candidates, alreadyMaterialized } = useMemo(() => {
    const all: BoardCandidate[] = review
      ? participantCandidates
      : active === 'linear'
        ? boardLinearIssues.map(issue => ({ ...linearCandidate(issue), column: initialPhase }))
        : active === 'github'
          ? [
              ...intakeIssues.map(issue => ({ ...issueCandidate(issue), column: initialPhase })),
              ...(triageIssues.data ?? []).map(issueCandidate),
            ]
          : [];
    // A source materializes once per Factory, so items that already have a card
    // are held back. Only those carded on another board get counted: a card on
    // this board is visible in a column, so it needs no explanation.
    const fresh = all.filter(candidate => !knownSourceKeys.has(candidate.sourceKey));
    const elsewhere = all.filter(candidate => elsewhereSourceKeys.has(candidate.sourceKey)).length;
    return { candidates: fresh, alreadyMaterialized: elsewhere };
  }, [
    knownSourceKeys,
    elsewhereSourceKeys,
    participantCandidates,
    intakeIssues,
    triageIssues.data,
    boardLinearIssues,
    active,
    review,
    initialPhase,
  ]);

  const browsed = { github: issues, 'github-prs': pulls, linear: linearIssues };
  const feed = active ? browsed[active] : undefined;
  // Triage is fed by its own labelled query, so it fails (and retries) on its own.
  const feedByColumn: Partial<Record<BoardStageId, IntakeFeed>> = {
    [initialPhase]: feed,
    ...(kind === 'work' && active === 'github' ? { triage: triageIssues } : {}),
  };

  return {
    available,
    active,
    showSwitch: available.length > 1,
    select: setSelected,
    candidates,
    alreadyMaterialized,
    participantCandidates,
    feedByColumn,
    isPending:
      (!review && (configQuery.isPending || ((config?.linear.enabled ?? false) && linearStatusQuery.isPending))) ||
      (active === 'github' && !routesSettled) ||
      Boolean(feed?.isPending),
    isTriagePending: kind === 'work' && active === 'github' && triageIssues.isPending,
  };
}
