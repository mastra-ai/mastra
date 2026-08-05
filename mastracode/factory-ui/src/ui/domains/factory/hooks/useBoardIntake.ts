import { useMemo, useState } from 'react';

import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import { useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
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
  const linearReady =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0;

  // Work intake owns issues; Review intake owns pull requests. Keeping the
  // feeds on separate routes prevents review-producing PR work from being
  // confused with the Work board's review-receiving lane.
  const githubIntakeActive = githubEnabled && githubSelected;
  const available: IntakeSource[] = review
    ? ['github-prs']
    : [...(githubIntakeActive ? (['github'] as const) : []), ...(linearReady ? (['linear'] as const) : [])];
  const [selected, setSelected] = useState<IntakeSource>(review ? 'github-prs' : 'github');
  const active: IntakeSource | undefined = available.includes(selected) ? selected : available[0];

  // Only the active intake feed fetches; the other feeds load on switch.
  const issues = useProjectIssuesQuery(active === 'github' ? projectRepositoryId : undefined);
  const triageIssues = useProjectIssuesQuery(!review ? projectRepositoryId : undefined, AUTO_TRIAGED_LABEL);
  const pulls = useProjectPullRequestsQuery(active === 'github-prs' ? projectRepositoryId : undefined);
  const linearIssues = useLinearIssuesQuery(active === 'linear' ? factoryProjectId : undefined);

  const candidates = useMemo(() => {
    const intakeIssues = (active === 'github' ? (issues.data ?? []) : []).filter(
      issue => !hasLabel(issue.labels, AUTO_TRIAGED_LABEL),
    );
    const all: BoardCandidate[] = review
      ? (pulls.data ?? []).map(pullRequestCandidate)
      : [
          ...intakeIssues.map(issueCandidate),
          ...(triageIssues.data ?? []).map(issueCandidate),
          ...(active === 'linear' ? (linearIssues.data ?? []).map(linearCandidate) : []),
        ];
    return all.filter(candidate => !knownSourceKeys.has(candidate.sourceKey));
  }, [knownSourceKeys, issues.data, triageIssues.data, pulls.data, linearIssues.data, active, review]);

  return {
    available,
    active,
    showSwitch: available.length > 1,
    select: setSelected,
    candidates,
    issues,
    pulls,
    linearIssues,
    isPending:
      (!review && (configQuery.isPending || ((config?.linear.enabled ?? false) && linearStatusQuery.isPending))) ||
      (active === 'github' && issues.isPending) ||
      (active === 'github-prs' && pulls.isPending) ||
      (active === 'linear' && linearIssues.isPending),
    isTriagePending: !review && triageIssues.isPending,
  };
}
