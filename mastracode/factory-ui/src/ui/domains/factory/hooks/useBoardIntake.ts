import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
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
import { hasLabel, isPersistedCandidate } from '../boardItems';
import { pickedBoardSources } from '../boardSourceFilters';
import type { IntakeSourceBinding } from '../services/intake';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { BoardStageId } from '../stages';

/**
 * The Intake swimlane's feeds and the candidates left once anything already
 * on the board is dropped.
 *
 * Work Intake gates GitHub issues org-wide; the Review pull-request feed is
 * always enabled. Provider issues only appear on boards explicitly routed
 * to them, together on the board's initial phase.
 */
const EMPTY_KEYS: ReadonlySet<string> = new Set();
const NO_REPOSITORIES: readonly string[] = [];

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

/** A single feed keeps its query state; multiple feeds page independently. */
function combineIntakeFeeds(feeds: readonly (IntakeFeed & { isPending: boolean })[]) {
  if (feeds.length === 0) return undefined;
  if (feeds.length === 1) return feeds[0];

  const failedFeed = feeds.find(feed => feed.error);
  const healthyFeeds = feeds.filter(feed => !feed.error);
  return {
    error: failedFeed?.error ?? null,
    isPending: feeds.some(feed => feed.isPending),
    isFetchNextPageError: failedFeed?.isFetchNextPageError ?? false,
    hasNextPage: healthyFeeds.some(feed => feed.hasNextPage),
    isFetchingNextPage: healthyFeeds.some(feed => feed.isFetchingNextPage),
    fetchNextPage: () => Promise.all(healthyFeeds.filter(feed => feed.hasNextPage).map(feed => feed.fetchNextPage())),
    refetch: () => Promise.all(feeds.map(feed => feed.refetch())),
    retryFailed: failedFeed
      ? () => (failedFeed.isFetchNextPageError ? failedFeed.fetchNextPage() : failedFeed.refetch())
      : undefined,
  };
}

export function useBoardIntake({
  factoryProjectId,
  repositories,
  definition,
  knownSourceKeys,
  elsewhereSourceKeys = EMPTY_KEYS,
  sourceFilters,
}: {
  factoryProjectId: string;
  /** Every linked repository; the first decides between GitHub and GitLab review feeds. */
  repositories: readonly LinkedRepositoryPayload[];
  definition: InstalledBoardInfo;
  knownSourceKeys: ReadonlySet<string>;
  /** Subset of `knownSourceKeys` whose card lives on another board. */
  elsewhereSourceKeys?: ReadonlySet<string>;
  sourceFilters?: Pick<BoardFilterState, 'source' | 'linearProject'>;
}) {
  const kind = definition.id;
  const review = kind === 'review';
  const initialPhase = definition.initialPhase;
  const repository = repositories[0];
  const projectRepositoryId = repository?.projectRepositoryId;
  const gitlabRepository = repository?.provider === 'gitlab';
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const jiraStatusQuery = useJiraStatusQuery();
  const incidentioStatusQuery = useIncidentioStatusQuery();

  const config = configQuery.data;
  const gitlabStatusQuery = useGitLabStatusQuery(!review);
  const githubEnabled = config?.github.enabled ?? true;
  // Every linked GitHub repository feeds intake, not just the first one.
  // Review watches pull requests on all of them; Work only browses the
  // repositories selected as issue sources.
  const reviewRepositoryIds = repositories
    .filter(linked => linked.provider !== 'gitlab')
    .map(linked => linked.projectRepositoryId);
  const githubRepositoryIds = repositories
    .filter(linked => linked.provider !== 'gitlab')
    .filter(linked => (config ? (config.github.sourceIds?.includes(linked.slug) ?? false) : true))
    .map(linked => linked.projectRepositoryId);
  const githubSelected = githubRepositoryIds.length > 0;
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
  const pickedSources = sourceFilters ? pickedBoardSources(sourceFilters) : new Set<string>();
  const browsedSources = available.filter(
    source => pickedSources.size === 0 || pickedSources.has(source.split('-')[0]),
  );
  const browsesGithub = browsedSources.includes('github');

  // Fetch every configured source so person filters can include provider identities
  // even when a source filter hides its feed. Only browsed feeds affect loading.
  const issues = useProjectIssuesQuery(!review && githubIntakeActive ? githubRepositoryIds : NO_REPOSITORIES);
  // Auto-triage is a Work-only lane, so only Work browses the triaged feed.
  const triageIssues = useProjectIssuesQuery(
    kind === 'work' && browsesGithub ? githubRepositoryIds : NO_REPOSITORIES,
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
  const pulls = useProjectPullRequestsQuery(review && !gitlabRepository ? reviewRepositoryIds : NO_REPOSITORIES);
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

  // Keep an unresolved board pending while discovering its routed sources.
  const discoveringSources =
    ((config?.gitlab.enabled ?? false) && gitlabStatusQuery.isPending) ||
    ((config?.linear.enabled ?? false) && linearStatusQuery.isPending) ||
    ((config?.jira.enabled ?? false) && jiraStatusQuery.isPending) ||
    ((config?.incidentio?.enabled ?? false) && incidentioStatusQuery.isPending) ||
    bindingsPending ||
    routesPending;
  const isConfigurationPending = !review && configQuery.isPending;
  const isRoutingPending = browsesGithub && routesPending;
  const isPending =
    isConfigurationPending || (!review && discoveringSources) || isRoutingPending || Boolean(feed?.isPending);

  return {
    active: failedSource ?? browsedSources[0],
    available,
    candidates,
    alreadyMaterialized,
    participantCandidates,
    feedByColumn,
    isPending,
    isTriagePending: kind === 'work' && browsesGithub && triageIssues.isPending,
  };
}
