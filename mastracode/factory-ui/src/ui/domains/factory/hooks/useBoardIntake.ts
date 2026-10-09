import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { useState } from 'react';

import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import {
  useGitLabIssuesQuery,
  useGitLabMergeRequestsQuery,
  useGitLabStatusQuery,
} from '../../../../hooks/useGitLabData';
import {
  useIntakeBindingsQuery,
  useIntakeConfigQuery,
  useIntakeLabelRoutesQuery,
} from '../../../../hooks/useIntakeConfig';
import { useIncidentioIssuesQuery, useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraIssuesQuery, useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearIssuesQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import {
  gitlabCandidate,
  gitlabMergeRequestCandidate,
  incidentioCandidate,
  issueCandidate,
  jiraCandidate,
  linearCandidate,
  pullRequestCandidate,
} from '../boardCandidates';
import type { BoardCandidate, IntakeFeed, IntakeSource } from '../boardCandidates';
import type { BoardFilterState } from '../boardFilters';
import { hasBoardSourceFilters } from '../boardSourceFilters';
import { hasLabel, isPersistedCandidate } from '../boardItems';
import type { IntakeSourceBinding } from '../services/intake';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { BoardStageId } from '../stages';

/**
 * The Intake swimlane's feed: which candidate source is browsed, the queries
 * behind it, and the candidates left once anything already on the board is
 * dropped.
 *
 * Work Intake gates GitHub issues org-wide; the Review pull-request feed is
 * always enabled. Any board (Work included) only gets a Linear or Jira feed
 * from the sources explicitly routed to it, offered on the board's initial
 * phase.
 */
const EMPTY_KEYS: ReadonlySet<string> = new Set();

const INTAKE_CARD_SOURCES: Record<IntakeSource, BoardCandidate['source']> = {
  github: 'github-issue',
  'github-prs': 'github-pr',
  'gitlab-prs': 'gitlab-pr',
  gitlab: 'gitlab-issue',
  linear: 'linear-issue',
  jira: 'jira-issue',
  incidentio: 'incidentio-follow-up',
};

/** Keep only issues whose configured source routes to this board. */
function issuesBoundToBoard<T extends { sourceId?: unknown }>(
  issues: readonly T[],
  bindings: readonly IntakeSourceBinding[],
  board: string,
): T[] {
  return issues.filter(issue => {
    const sourceId = issue.sourceId;
    if (typeof sourceId !== 'string' || !sourceId) return false;
    return bindings.find(binding => binding.sourceId === sourceId)?.board === board;
  });
}

/** Routing failures retry discovery rather than the provider's issue list. */
function feedWithRoutingFailure(
  feed: IntakeFeed & { isPending: boolean },
  routing: Pick<IntakeFeed, 'error' | 'refetch'>,
  failed: boolean,
) {
  if (!failed) return feed;
  return {
    ...feed,
    isPending: false,
    error: routing.error,
    isFetchNextPageError: false,
    refetch: () => routing.refetch(),
  };
}

/** A single feed keeps its query state; multiple feeds page and retry together. */
function combineIntakeFeeds(feeds: readonly (IntakeFeed & { isPending: boolean })[]) {
  if (feeds.length === 0) return undefined;
  if (feeds.length === 1) return feeds[0];

  const failedFeed = feeds.find(feed => feed.error);
  return {
    error: failedFeed?.error ?? null,
    isPending: feeds.some(feed => feed.isPending),
    isFetchNextPageError: failedFeed?.isFetchNextPageError ?? false,
    hasNextPage: feeds.some(feed => feed.hasNextPage),
    isFetchingNextPage: feeds.some(feed => feed.isFetchingNextPage),
    fetchNextPage: () => Promise.all(feeds.filter(feed => feed.hasNextPage).map(feed => feed.fetchNextPage())),
    refetch: () => Promise.all(feeds.map(feed => feed.refetch())),
  };
}

export function useBoardIntake({
  factoryProjectId,
  repository,
  definition,
  knownSourceKeys,
  elsewhereSourceKeys = EMPTY_KEYS,
  sourceFilters,
}: {
  factoryProjectId: string;
  repository: LinkedRepositoryPayload;
  definition: InstalledBoardInfo;
  knownSourceKeys: ReadonlySet<string>;
  /** Subset of `knownSourceKeys` whose card lives on another board. */
  elsewhereSourceKeys?: ReadonlySet<string>;
  sourceFilters?: Pick<BoardFilterState, 'sources' | 'linearProjectIds'>;
}) {
  const kind = definition.id;
  const review = kind === 'review';
  const initialPhase = definition.initialPhase;
  const projectRepositoryId = repository.projectRepositoryId;
  const gitlabRepository = repository.provider === 'gitlab';
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const jiraStatusQuery = useJiraStatusQuery();
  const incidentioStatusQuery = useIncidentioStatusQuery();

  const config = configQuery.data;
  const gitlabStatusQuery = useGitLabStatusQuery(!review);
  const githubEnabled = config?.github.enabled ?? true;
  const githubSelected = config ? (config.github.sourceIds?.includes(repository.slug) ?? false) : true;
  const gitlabConnected = Boolean(gitlabStatusQuery.data?.enabled && gitlabStatusQuery.data.configured);
  const linearFeature = linearStatusQuery.data?.enabled ?? false;
  const linearConnected = Boolean(linearFeature && linearStatusQuery.data?.connected);
  // Provider routing is explicit: a source feeds exactly the board its binding
  // names. A board offers a provider's feed only when some source is routed to
  // it, so viewing a board never ingests issues nobody asked it to take.
  const bindingsQuery = useIntakeBindingsQuery();
  const routedHereFor = (integrationId: string) =>
    (bindingsQuery.data ?? []).some(
      binding =>
        binding.integrationId === integrationId &&
        binding.factoryProjectId === factoryProjectId &&
        binding.board === kind,
    );
  const linearRouted = routedHereFor('linear');
  const gitlabRouted = routedHereFor('gitlab');
  const gitlabEligible =
    !review && (config?.gitlab.enabled ?? false) && gitlabConnected && (config?.gitlab.sourceIds?.length ?? 0) > 0;
  const linearEligible =
    !review && (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0;
  const jiraConfigured = Boolean(jiraStatusQuery.data?.enabled && jiraStatusQuery.data.configured);
  const jiraRouted = routedHereFor('jira');
  const jiraEligible =
    !review && (config?.jira.enabled ?? false) && jiraConfigured && (config?.jira.sourceIds?.length ?? 0) > 0;
  const incidentioConfigured = Boolean(incidentioStatusQuery.data?.enabled && incidentioStatusQuery.data.configured);
  const incidentioRouted = routedHereFor('incidentio');
  const incidentioEligible =
    !review &&
    (config?.incidentio?.enabled ?? false) &&
    incidentioConfigured &&
    (config?.incidentio?.sourceIds?.length ?? 0) > 0;
  // Bindings decide whether this board gets a provider feed at all, so an
  // eligible board stays pending until they load rather than looking empty,
  // and a failed load is shown as a feed error (with retry) rather than
  // being mistaken for "nothing bound here".
  const providerEligible = gitlabEligible || linearEligible || jiraEligible || incidentioEligible;
  const bindingsPending = providerEligible && bindingsQuery.isPending;
  const bindingsFailed = providerEligible && bindingsQuery.isError;
  const gitlabReady = gitlabEligible && (gitlabRouted || bindingsFailed);
  const linearReady = linearEligible && (linearRouted || bindingsFailed);
  const jiraReady = jiraEligible && (jiraRouted || bindingsFailed);
  const incidentioReady = incidentioEligible && (incidentioRouted || bindingsFailed);

  // GitHub issues route by label: a label routed to a board sends its issues
  // there, and Work keeps every unrouted issue. A custom board only offers the
  // GitHub feed when at least one label is routed to it.
  const labelRoutesQuery = useIntakeLabelRoutesQuery(review || gitlabRepository ? undefined : factoryProjectId);
  const labelRoutes = (labelRoutesQuery.data ?? []).filter(route => route.integrationId === 'github');
  const routedHere = labelRoutes.some(route => route.board === kind);
  // Until routes load, no board can tell which issues it owns: Work would
  // flash cards routed elsewhere and a custom board would look empty. A failed
  // load is not "no routes" either, so the feed reports that error instead of
  // classifying every issue as Work.
  const routesPending = !review && !gitlabRepository && githubEnabled && githubSelected && labelRoutesQuery.isPending;
  const routesFailed = !review && !gitlabRepository && labelRoutesQuery.isError;
  const routesSettled = review || gitlabRepository || labelRoutesQuery.isSuccess;

  // Work intake owns issues; Review intake owns pull requests. Keeping the
  // feeds on separate routes prevents review-producing PR work from being
  // confused with the Work board's review-receiving lane.
  const githubIntakeActive =
    !gitlabRepository && (kind === 'work' || routedHere || routesFailed) && githubEnabled && githubSelected;
  const available: IntakeSource[] = review
    ? [gitlabRepository ? 'gitlab-prs' : 'github-prs']
    : [
        ...(githubIntakeActive ? (['github'] as const) : []),
        ...(gitlabReady ? (['gitlab'] as const) : []),
        ...(linearReady ? (['linear'] as const) : []),
        ...(jiraReady ? (['jira'] as const) : []),
        ...(incidentioReady ? (['incidentio'] as const) : []),
      ];
  const [selected, setSelected] = useState<IntakeSource>(
    review ? (gitlabRepository ? 'gitlab-prs' : 'github-prs') : 'github',
  );
  const active: IntakeSource | undefined = available.includes(selected) ? selected : available[0];

  const sourceFiltered = sourceFilters !== undefined && hasBoardSourceFilters(sourceFilters);
  const browsedSources = available.filter(source => {
    if (!sourceFiltered) return source === active;
    const provider = source.split('-')[0];
    if (sourceFilters && sourceFilters.sources.size > 0 && !sourceFilters.sources.has(provider)) return false;
    return !sourceFilters?.linearProjectIds.size || source === 'linear';
  });
  const browsesGithub = browsedSources.includes('github');

  // Fetch every configured source so teammate filters can include provider identities
  // even when a different intake feed is visible. Only the browsed feeds affect loading.
  const issues = useProjectIssuesQuery(!review && githubIntakeActive ? projectRepositoryId : undefined);
  // Auto-triage is a Work-only lane, so only Work browses the triaged feed.
  const triageIssues = useProjectIssuesQuery(
    kind === 'work' && browsesGithub ? projectRepositoryId : undefined,
    AUTO_TRIAGED_LABEL,
  );
  // Mirrors the server's resolution: the first route (in listing order) whose
  // label the issue carries wins; unrouted issues belong to Work.
  const boardIssues = (issues.data ?? []).filter(issue => {
    if (!routesSettled) return false;
    const routedBoard = labelRoutes.find(route => hasLabel(issue.labels, route.label))?.board ?? 'work';
    return routedBoard === kind;
  });
  const projectBindings = (bindingsQuery.data ?? []).filter(binding => binding.factoryProjectId === factoryProjectId);
  const pulls = useProjectPullRequestsQuery(review && !gitlabRepository ? projectRepositoryId : undefined);
  const mergeRequests = useGitLabMergeRequestsQuery(
    review && gitlabRepository ? factoryProjectId : undefined,
    review && gitlabRepository ? projectRepositoryId : undefined,
  );
  const gitlabIssues = useGitLabIssuesQuery(
    !review && gitlabReady ? factoryProjectId : undefined,
    !review && gitlabReady ? kind : undefined,
  );
  const boardGitLabIssues = issuesBoundToBoard(
    gitlabIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'gitlab'),
    kind,
  );
  const linearIssues = useLinearIssuesQuery(!review && linearReady ? factoryProjectId : undefined);
  const boardLinearIssues = issuesBoundToBoard(
    linearIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'linear'),
    kind,
  );
  const jiraIssues = useJiraIssuesQuery(!review && jiraReady ? factoryProjectId : undefined);
  const boardJiraIssues = issuesBoundToBoard(
    jiraIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'jira'),
    kind,
  );
  const incidentioIssues = useIncidentioIssuesQuery(!review && incidentioReady ? factoryProjectId : undefined);
  const boardIncidentioIssues = issuesBoundToBoard(
    incidentioIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'incidentio'),
    kind,
  );

  const githubReviewCandidates = (pulls.data ?? []).map(pullRequestCandidate);
  const gitlabReviewCandidates = (mergeRequests.data ?? []).map(gitlabMergeRequestCandidate);
  const reviewCandidates = gitlabRepository ? gitlabReviewCandidates : githubReviewCandidates;
  const workCandidates = [
    ...boardIssues.map(issueCandidate),
    ...boardGitLabIssues.map(gitlabCandidate),
    ...boardLinearIssues.map(linearCandidate),
    ...boardJiraIssues.map(jiraCandidate),
    ...boardIncidentioIssues.map(incidentioCandidate),
  ];
  const participantCandidates = review ? reviewCandidates : workCandidates;
  const browsedCandidates = browsedSources.flatMap(source => {
    const initialCandidates = participantCandidates
      .filter(candidate => {
        if (candidate.source !== INTAKE_CARD_SOURCES[source]) return false;
        return source !== 'github' || candidate.column !== 'triage';
      })
      .map(candidate => ({ ...candidate, column: initialPhase }));
    if (source !== 'github') return initialCandidates;
    return [...initialCandidates, ...(triageIssues.data ?? []).map(issueCandidate)];
  });
  // A source materializes once per Factory, so items that already have a card
  // are held back. Only those carded on another board get counted: a card on
  // this board is visible in a column, so it needs no explanation.
  const candidates = browsedCandidates.filter(candidate => !isPersistedCandidate(knownSourceKeys, candidate));
  const alreadyMaterialized = browsedCandidates.filter(candidate =>
    isPersistedCandidate(elsewhereSourceKeys, candidate),
  ).length;

  const githubFeed = feedWithRoutingFailure(issues, labelRoutesQuery, routesFailed);
  const gitlabFeed = feedWithRoutingFailure(gitlabIssues, bindingsQuery, bindingsFailed);
  const linearFeed = feedWithRoutingFailure(linearIssues, bindingsQuery, bindingsFailed);
  const jiraFeed = feedWithRoutingFailure(jiraIssues, bindingsQuery, bindingsFailed);
  const incidentioFeed = feedWithRoutingFailure(incidentioIssues, bindingsQuery, bindingsFailed);
  const browsed = {
    github: githubFeed,
    'github-prs': pulls,
    'gitlab-prs': mergeRequests,
    gitlab: gitlabFeed,
    linear: linearFeed,
    jira: jiraFeed,
    incidentio: incidentioFeed,
  };
  const failedSource = browsedSources.find(source => browsed[source].error);
  const feed = combineIntakeFeeds(browsedSources.map(source => browsed[source]));
  // Triage is fed by its own labelled query, so it fails (and retries) on its own.
  const feedByColumn: Partial<Record<BoardStageId, IntakeFeed>> = {
    [initialPhase]: feed,
    ...(kind === 'work' && browsesGithub ? { triage: triageIssues } : {}),
  };

  // Discovery can add more source tabs without holding the selected feed's
  // loading state. Keep an unresolved board pending until a source is known.
  const discoveringSources =
    ((config?.gitlab.enabled ?? false) && gitlabStatusQuery.isPending) ||
    ((config?.linear.enabled ?? false) && linearStatusQuery.isPending) ||
    ((config?.jira.enabled ?? false) && jiraStatusQuery.isPending) ||
    ((config?.incidentio?.enabled ?? false) && incidentioStatusQuery.isPending) ||
    bindingsPending ||
    routesPending;
  const isConfigurationPending = !review && configQuery.isPending;
  const isSourcePending = (sourceFiltered || !active) && discoveringSources;
  const isRoutingPending = browsesGithub && routesPending;
  const isPending = isConfigurationPending || isSourcePending || isRoutingPending || Boolean(feed?.isPending);

  return {
    available,
    active: failedSource ?? browsedSources[0] ?? active,
    showSwitch: available.length > 1,
    select: setSelected,
    candidates,
    alreadyMaterialized,
    participantCandidates,
    feedByColumn,
    isPending,
    isTriagePending: kind === 'work' && browsesGithub && triageIssues.isPending,
  };
}
