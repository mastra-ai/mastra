import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { pickedBoardSources, PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useProjectIssuesQuery, useProjectPullRequestsQuery } from '../../../../hooks/useFactoryData';
import { filedFromQueryOptions } from '../../../../hooks/useWorkItems';
import type { FiledFromAnswer } from '../../../../hooks/useWorkItems';
import {
  useGitLabIssuesQuery,
  useGitLabMergeRequestsQuery,
  useGitLabStatusQuery,
} from '../../../../hooks/useGitLabData';
import { useIntakeBindingsQuery, useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
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
import { isPersistedCandidate, persistedSourceKeys } from '../boardItems';
import { itemBoard } from '../boardStages';
import type { IntakeSourceBinding } from '../services/intake';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { BoardStageId } from '../stages';

/**
 * The Intake swimlane's feeds and the candidates left once anything already
 * on the board is dropped.
 *
 * Every new card is filed on the default board before the project's intake
 * routes place it, so only the default board lists items that have no card
 * yet: GitHub issues from the selected repositories, the linked repositories'
 * pull requests, and the issues of provider sources bound to the project.
 */
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

/** Keep only issues whose source is bound to the project. */
function issuesFromBoundSources<T extends { sourceId?: unknown }>(
  issues: readonly T[],
  bindings: readonly IntakeSourceBinding[],
): T[] {
  return issues.filter(issue => {
    const sourceId = issue.sourceId;
    if (typeof sourceId !== 'string' || !sourceId) return false;
    return bindings.some(binding => binding.sourceId === sourceId);
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

/** The most feed items one filed lookup covers: each is asked by its source id and by its URL, a hundred values at most. */
const CANDIDATES_PER_LOOKUP = 50;

/**
 * What each filed lookup asks about: every feed in runs of items, so a page added to one feed
 * leaves the lookups of the others, and of its own earlier runs, as they were.
 */
function filedLookupSources(feeds: readonly (readonly BoardCandidate[])[]): string[][] {
  const lookups: string[][] = [];
  for (const feed of feeds) {
    for (let start = 0; start < feed.length; start += CANDIDATES_PER_LOOKUP) {
      lookups.push(
        feed
          .slice(start, start + CANDIDATES_PER_LOOKUP)
          .flatMap(candidate => [candidate.sourceKey, candidate.url])
          .filter(Boolean),
      );
    }
  }
  return lookups;
}

/**
 * A feed as its column shows it. Its items are held back until the server says which are already
 * filed, so a page counts as loaded only then: otherwise the end of the column is in view over the
 * items held back, and asks for the next page. A lookup that failed fails the feed, or the column
 * would read as an empty backlog.
 */
function feedOnceItemsAreLookedUp(
  feed: IntakeFeed & { isPending: boolean },
  lookups: readonly UseQueryResult<FiledFromAnswer>[],
): IntakeFeed & { isPending: boolean } {
  const failed = lookups.find(lookup => lookup.isError);
  if (failed && !feed.error) {
    return {
      ...feed,
      isPending: false,
      error: failed.error,
      isFetchNextPageError: false,
      refetch: () => Promise.all(lookups.filter(lookup => lookup.isError).map(lookup => lookup.refetch())),
    };
  }
  // A lookup showing what was answered for a shorter run still waits for the items added to it.
  const awaited = lookups.some(lookup => lookup.isFetching && (lookup.isPending || lookup.isPlaceholderData));
  if (!awaited) return feed;
  // Nothing answered yet: the column has no item to show, as while the first page loads.
  if (lookups.every(lookup => !lookup.data)) return { ...feed, isPending: true, hasNextPage: false };
  return { ...feed, isFetchingNextPage: true };
}

export function useBoardIntake({
  factoryProjectId,
  repositories,
  definition,
  sourceFilters,
}: {
  factoryProjectId: string;
  /** Every linked repository; the first decides between GitHub and GitLab review feeds. */
  repositories: readonly LinkedRepositoryPayload[];
  definition: InstalledBoardInfo;
  sourceFilters?: Pick<BoardFilterState, 'source' | 'linearProject'>;
}) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const kind = definition.id;
  const defaultBoard = kind === DEFAULT_BOARD_ID;
  const browsesPullRequests = defaultBoard;
  // Work without Triage (a project created now) offers auto-triaged issues in Intake with the rest.
  const triageColumn = defaultBoard && definition.phases.some(phase => phase.id === 'triage');
  const initialPhase = definition.initialPhase;
  const repository = repositories[0];
  const projectRepositoryId = repository?.projectRepositoryId;
  const gitlabRepository = repository?.provider === 'gitlab';
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const jiraStatusQuery = useJiraStatusQuery();
  const incidentioStatusQuery = useIncidentioStatusQuery();

  const config = configQuery.data;
  const gitlabStatusQuery = useGitLabStatusQuery(true);
  const githubEnabled = config?.github.enabled ?? false;
  // Every linked GitHub repository feeds intake, not just the first one. Pull requests come from
  // all of them; issues only from the repositories selected as issue sources.
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
  // A provider feeds the project only through a source bound to it, so viewing
  // a board never ingests issues nobody asked the project to take.
  const bindingsQuery = useIntakeBindingsQuery();
  const routedHereFor = (integrationId: string) =>
    defaultBoard &&
    (bindingsQuery.data ?? []).some(
      binding => binding.integrationId === integrationId && binding.factoryProjectId === factoryProjectId,
    );
  const linearRouted = routedHereFor('linear');
  const gitlabRouted = routedHereFor('gitlab');
  const gitlabEligible =
    (config?.gitlab.enabled ?? false) && gitlabConnected && (config?.gitlab.sourceIds?.length ?? 0) > 0;
  const linearEligible =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0;
  const jiraConfigured = Boolean(jiraStatusQuery.data?.enabled && jiraStatusQuery.data.configured);
  const jiraRouted = routedHereFor('jira');
  const jiraEligible = (config?.jira.enabled ?? false) && jiraConfigured && (config?.jira.sourceIds?.length ?? 0) > 0;
  const incidentioConfigured = Boolean(incidentioStatusQuery.data?.enabled && incidentioStatusQuery.data.configured);
  const incidentioRouted = routedHereFor('incidentio');
  const incidentioEligible =
    (config?.incidentio?.enabled ?? false) && incidentioConfigured && (config?.incidentio?.sourceIds?.length ?? 0) > 0;
  // Bindings decide whether this board gets a provider feed at all, so an
  // eligible board stays pending until they load rather than looking empty,
  // and a failed load is shown as a feed error (with retry) rather than
  // being mistaken for "nothing bound here".
  const providerEligible = defaultBoard && (gitlabEligible || linearEligible || jiraEligible || incidentioEligible);
  const bindingsPending = providerEligible && bindingsQuery.isPending;
  const bindingsFailed = providerEligible && bindingsQuery.isError;
  const gitlabReady = gitlabEligible && (gitlabRouted || bindingsFailed);
  const linearReady = linearEligible && (linearRouted || bindingsFailed);
  const jiraReady = jiraEligible && (jiraRouted || bindingsFailed);
  const incidentioReady = incidentioEligible && (incidentioRouted || bindingsFailed);

  // Provider sources are shared across factories, so one counts only once it is bound to this
  // project; until bindings load (or when they fail) the setup prompt waits.
  const boundToProject = (integrationId: string, sourceIds: readonly string[] | null | undefined) =>
    bindingsQuery.isPending ||
    bindingsQuery.isError ||
    (bindingsQuery.data ?? []).some(
      binding =>
        binding.integrationId === integrationId &&
        binding.factoryProjectId === factoryProjectId &&
        (sourceIds?.includes(binding.sourceId) ?? false),
    );
  const sourceConnected =
    (!gitlabRepository && githubEnabled && githubSelected) ||
    (gitlabEligible && boundToProject('gitlab', config?.gitlab.sourceIds)) ||
    (linearEligible && boundToProject('linear', config?.linear.sourceIds)) ||
    (jiraEligible && boundToProject('jira', config?.jira.sourceIds)) ||
    (incidentioEligible && boundToProject('incidentio', config?.incidentio?.sourceIds));
  const githubIntakeActive = !gitlabRepository && defaultBoard && githubEnabled && githubSelected;
  const pullRequestSource: IntakeSource = gitlabRepository ? 'gitlab-prs' : 'github-prs';
  const available: IntakeSource[] = [
    ...(githubIntakeActive ? (['github'] as const) : []),
    ...(gitlabReady ? (['gitlab'] as const) : []),
    ...(linearReady ? (['linear'] as const) : []),
    ...(jiraReady ? (['jira'] as const) : []),
    ...(incidentioReady ? (['incidentio'] as const) : []),
  ];
  // A connected source files onto the default board, and onto another board only through an
  // intake route that places its new cards there: enabled, run on `work_item.opened`, and not
  // one that only joins a pull request to an existing card (the server's `resolveIntakeRoute`).
  const readsIntakeRoutes = !defaultBoard && sourceConnected && available.length === 0;
  const intakeRoutesQuery = useIntakeRoutesQuery(readsIntakeRoutes ? factoryProjectId : undefined);
  const intakeRoutesPending = readsIntakeRoutes && intakeRoutesQuery.isPending;
  const intakeRoutesFailed = readsIntakeRoutes && intakeRoutesQuery.isError;
  const routePlacesCardsHere = (intakeRoutesQuery.data?.intakeRoutes ?? []).some(
    route =>
      route.enabled &&
      route.on.includes('work_item.opened') &&
      !route.target.joinClosedIssue &&
      route.target.boardKey === kind,
  );
  // Sources are connected and the routes loaded, but none places new cards on this board.
  const unrouted = readsIntakeRoutes && intakeRoutesQuery.isSuccess && !routePlacesCardsHere;
  // Whether anything files onto this board: a feed it browses, or a connected source routed here.
  // While routes load the column stays pending, and a failed load reports the error with a retry.
  const fed =
    available.length > 0 ||
    (sourceConnected && (defaultBoard || intakeRoutesPending || intakeRoutesFailed || routePlacesCardsHere));
  // The default board also lists the pull requests of its linked repositories, but they are
  // not an issue source: a default board without one still asks to connect one.
  const feedSources: IntakeSource[] = browsesPullRequests && repository ? [...available, pullRequestSource] : available;
  const pickedSources = sourceFilters ? pickedBoardSources(sourceFilters) : new Set<string>();
  const browsedSources = feedSources.filter(
    source =>
      pickedSources.size === 0 ||
      pickedSources.has(source.split('-')[0]) ||
      (source === pullRequestSource && pickedSources.has(PULL_REQUEST_SOURCE_FILTER)),
  );
  const browsesGithub = browsedSources.includes('github');

  // Fetch every configured source so person filters can include provider identities
  // even when a source filter hides its feed. Only browsed feeds affect loading.
  const issues = useProjectIssuesQuery(githubIntakeActive ? githubRepositoryIds : NO_REPOSITORIES);
  // Auto-triaged issues land in the default board's Triage, so only it browses the triaged feed.
  const triageIssues = useProjectIssuesQuery(
    triageColumn && browsesGithub ? githubRepositoryIds : NO_REPOSITORIES,
    AUTO_TRIAGED_LABEL,
  );
  const boardIssues = issues.data ?? [];
  const projectBindings = (bindingsQuery.data ?? []).filter(binding => binding.factoryProjectId === factoryProjectId);
  const pulls = useProjectPullRequestsQuery(
    browsesPullRequests && !gitlabRepository ? reviewRepositoryIds : NO_REPOSITORIES,
  );
  const mergeRequests = useGitLabMergeRequestsQuery(
    browsesPullRequests && gitlabRepository ? factoryProjectId : undefined,
    browsesPullRequests && gitlabRepository ? projectRepositoryId : undefined,
  );
  const gitlabIssues = useGitLabIssuesQuery(gitlabReady ? factoryProjectId : undefined);
  const boardGitLabIssues = issuesFromBoundSources(
    gitlabIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'gitlab'),
  );
  const linearIssues = useLinearIssuesQuery(linearReady ? factoryProjectId : undefined);
  const boardLinearIssues = issuesFromBoundSources(
    linearIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'linear'),
  );
  const jiraIssues = useJiraIssuesQuery(jiraReady ? factoryProjectId : undefined);
  const boardJiraIssues = issuesFromBoundSources(
    jiraIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'jira'),
  );
  const incidentioIssues = useIncidentioIssuesQuery(incidentioReady ? factoryProjectId : undefined);
  const boardIncidentioIssues = issuesFromBoundSources(
    incidentioIssues.data ?? [],
    projectBindings.filter(binding => binding.integrationId === 'incidentio'),
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
    ...(browsesPullRequests ? reviewCandidates : []),
  ];
  const participantCandidates = workCandidates;
  const browsedCandidates = browsedSources.flatMap(source => {
    const initialCandidates = participantCandidates
      .filter(candidate => {
        if (candidate.source !== INTAKE_CARD_SOURCES[source]) return false;
        return source !== 'github' || !triageColumn || candidate.column !== 'triage';
      })
      .map(candidate => ({ ...candidate, column: initialPhase }));
    if (source !== 'github' || !triageColumn) return initialCandidates;
    return [...initialCandidates, ...(triageIssues.data ?? []).map(issueCandidate)];
  });
  // A source materializes once per Factory, so items that already have a card are held back. The
  // server says which ones do, for the feed items alone: the board lists only the first cards of
  // each column. An item waits for that answer, or it would flash as new before leaving. A source
  // the view hides shows no item, so nothing is asked for it and its answer holds no feed back.
  const initialFeedLookups = filedLookupSources(
    browsedSources.map(source =>
      participantCandidates.filter(candidate => candidate.source === INTAKE_CARD_SOURCES[source]),
    ),
  );
  const triageFeedLookups = filedLookupSources([(triageIssues.data ?? []).map(issueCandidate)]);
  const filedLookups = useQueries({
    queries: [...initialFeedLookups, ...triageFeedLookups].map(sources => ({
      ...filedFromQueryOptions(baseUrl, factoryProjectId, sources),
      // A feed page added to a run asks again: what was answered for the shorter run holds meanwhile.
      placeholderData: () =>
        queryClient
          .getQueriesData<FiledFromAnswer>({ queryKey: queryKeys.workItemsFiledFromAny(factoryProjectId) })
          .flatMap(([, answer]) => (answer ? [answer] : []))
          .find(answer => answer.sources.every(source => sources.includes(source))),
    })),
  });
  const filedAnswers = filedLookups.flatMap(lookup => (lookup.data ? [lookup.data] : []));
  const lookedUpSources = new Set(filedAnswers.flatMap(answer => answer.sources));
  const filedCards = filedAnswers.flatMap(answer => answer.workItems);
  const knownSourceKeys = persistedSourceKeys(filedCards);
  // Only those carded on another board get counted: a card on this board is visible in a column,
  // so it needs no explanation.
  const elsewhereSourceKeys = persistedSourceKeys(filedCards.filter(card => itemBoard(card) !== kind));
  const candidates = browsedCandidates.filter(
    candidate => lookedUpSources.has(candidate.sourceKey) && !isPersistedCandidate(knownSourceKeys, candidate),
  );
  const alreadyMaterialized = browsedCandidates.filter(candidate =>
    isPersistedCandidate(elsewhereSourceKeys, candidate),
  ).length;

  const gitlabFeed = feedWithRoutingFailure(gitlabIssues, bindingsQuery, bindingsFailed);
  const linearFeed = feedWithRoutingFailure(linearIssues, bindingsQuery, bindingsFailed);
  const jiraFeed = feedWithRoutingFailure(jiraIssues, bindingsQuery, bindingsFailed);
  const incidentioFeed = feedWithRoutingFailure(incidentioIssues, bindingsQuery, bindingsFailed);
  const browsed = {
    github: issues,
    'github-prs': pulls,
    'gitlab-prs': mergeRequests,
    gitlab: gitlabFeed,
    linear: linearFeed,
    jira: jiraFeed,
    incidentio: incidentioFeed,
  };
  const failedSource = browsedSources.find(source => browsed[source].error);
  const browsedFeed = intakeRoutesFailed
    ? {
        error: intakeRoutesQuery.error,
        isPending: false,
        fetchNextPage: () => undefined,
        refetch: () => intakeRoutesQuery.refetch(),
      }
    : combineIntakeFeeds(browsedSources.map(source => browsed[source]));
  const feed = browsedFeed && feedOnceItemsAreLookedUp(browsedFeed, filedLookups.slice(0, initialFeedLookups.length));
  // Triage is fed by its own labelled query, so it fails (and retries) on its own.
  const triageFeed = feedOnceItemsAreLookedUp(triageIssues, filedLookups.slice(initialFeedLookups.length));
  const feedByColumn: Partial<Record<BoardStageId, IntakeFeed>> = {
    [initialPhase]: feed,
    ...(triageColumn && browsesGithub ? { triage: triageFeed } : {}),
  };

  // Keep an unresolved board pending while discovering its routed sources.
  const discoveringSources =
    ((config?.gitlab.enabled ?? false) && gitlabStatusQuery.isPending) ||
    ((config?.linear.enabled ?? false) && linearStatusQuery.isPending) ||
    ((config?.jira.enabled ?? false) && jiraStatusQuery.isPending) ||
    ((config?.incidentio?.enabled ?? false) && incidentioStatusQuery.isPending) ||
    bindingsPending ||
    intakeRoutesPending;
  const isConfigurationPending = configQuery.isPending;
  const isPending = isConfigurationPending || discoveringSources || Boolean(feed?.isPending);

  return {
    active: failedSource ?? browsedSources[0],
    available,
    fed,
    unrouted,
    candidates,
    alreadyMaterialized,
    participantCandidates,
    /** The sources of the browsed feeds' items already filed as a card, on this board or another. */
    knownSourceKeys,
    feedByColumn,
    isPending,
    isTriagePending: triageColumn && browsesGithub && triageFeed.isPending,
  };
}
