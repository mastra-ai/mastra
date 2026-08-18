import { useMemo, useState } from 'react';

import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import { useIntakeBindingsQuery, useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { issueCandidate, linearCandidate, pullRequestCandidate } from '../boardCandidates';
import type { BoardCandidate, IntakeSource } from '../boardCandidates';
import { AUTO_TRIAGED_LABEL, hasLabel } from '../boardItems';
import type { BoardKind } from '../boardStages';

/**
 * The Intake swimlane's feed: which candidate source is browsed, the queries
 * behind it, and the candidates left once anything already on the board is
 * dropped.
 *
 * Work Intake gates issues per account; the Review pull-request feed is always
 * enabled.
 */
export function useBoardIntake({
  factoryProjectId,
  repository,
  kind,
  knownSourceKeys,
}: {
  factoryProjectId: string;
  repository: LinkedRepositoryPayload;
  kind: BoardKind;
  knownSourceKeys: ReadonlySet<string>;
}) {
  const review = kind === 'review';
  const projectRepositoryId = repository.projectRepositoryId;
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();

  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.sourceIds?.includes(repository.slug) ?? false) : true;
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  // Linear sources route to one Factory project. Once any routing exists, a board
  // only offers the Linear feed when a source points at the project being viewed —
  // otherwise every board would list (and ingest) every selected Linear project.
  // With no routing at all the server still serves single-Factory orgs, where the
  // destination is unambiguous; mirror that here so the feed is never offered empty.
  const bindingsQuery = useIntakeBindingsQuery();
  const factoriesQuery = useFactoriesQuery();
  const linearBindings = (bindingsQuery.data ?? []).filter(binding => binding.integrationId === 'linear');
  const linearRouted =
    linearBindings.length === 0
      ? (factoriesQuery.data?.length ?? 0) <= 1
      : linearBindings.some(binding => binding.factoryProjectId === factoryProjectId);
  const linearReady =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0 && linearRouted;

  // Work intake owns issues; Review intake owns pull requests. Keeping the
  // feeds on separate routes prevents review-producing PR work from being
  // confused with the Work board's review-receiving lane.
  const githubIntakeActive = githubEnabled && githubSelected;
  const available: IntakeSource[] = review
    ? ['github-prs']
    : [...(githubIntakeActive ? (['github'] as const) : []), ...(linearReady ? (['linear'] as const) : [])];
  const [selected, setSelected] = useState<IntakeSource>(review ? 'github-prs' : 'github');
  const active: IntakeSource | undefined = available.includes(selected) ? selected : available[0];

  // Fetch every configured source so teammate filters can include provider identities
  // even when a different intake feed is visible. Only the active feed affects loading.
  const issues = useProjectIssuesQuery(!review && githubIntakeActive ? projectRepositoryId : undefined);
  const triageIssues = useProjectIssuesQuery(active === 'github' ? projectRepositoryId : undefined, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(review ? projectRepositoryId : undefined);
  const linearIssues = useLinearIssuesQuery(!review && linearReady ? factoryProjectId : undefined);

  const intakeIssues = useMemo(
    () => (issues.data ?? []).filter(issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL)),
    [issues.data],
  );
  const participantCandidates = useMemo(
    () =>
      review
        ? (pulls.data ?? []).map(pullRequestCandidate)
        : [...(issues.data ?? []).map(issueCandidate), ...(linearIssues.data ?? []).map(linearCandidate)],
    [issues.data, pulls.data, linearIssues.data, review],
  );
  const candidates = useMemo(() => {
    const all: BoardCandidate[] = review
      ? participantCandidates
      : active === 'linear'
        ? (linearIssues.data ?? []).map(linearCandidate)
        : active === 'github'
          ? [...intakeIssues.map(issueCandidate), ...(triageIssues.data ?? []).map(issueCandidate)]
          : [];
    return all.filter(candidate => !knownSourceKeys.has(candidate.sourceKey));
  }, [knownSourceKeys, participantCandidates, intakeIssues, triageIssues.data, linearIssues.data, active, review]);

  return {
    available,
    active,
    showSwitch: available.length > 1,
    select: setSelected,
    candidates,
    participantCandidates,
    issues,
    pulls,
    linearIssues,
    isPending:
      (!review && (configQuery.isPending || ((config?.linear.enabled ?? false) && linearStatusQuery.isPending))) ||
      (active === 'github' && issues.isPending) ||
      (active === 'github-prs' && pulls.isPending) ||
      (active === 'linear' && linearIssues.isPending),
    isTriagePending: !review && active === 'github' && triageIssues.isPending,
  };
}
