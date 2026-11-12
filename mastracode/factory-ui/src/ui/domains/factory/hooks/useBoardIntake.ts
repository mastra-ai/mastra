import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { AUTO_TRIAGED_LABEL } from '@mastra/factory/rules/types';
import { pickedBoardSources, PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIntakeCandidatesQuery } from '../../../../hooks/useIntakeCandidates';
import { useIntakeBindingsQuery, useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { intakeCandidate } from '../boardCandidates';
import type { BoardCandidate, IntakeFeed, IntakeSource } from '../boardCandidates';
import type { BoardFilterState } from '../boardFilters';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { BoardStageId } from '../stages';

/**
 * The Intake swimlane: the records the server offers for filing, and whether
 * anything feeds this board at all.
 *
 * Every new card is filed on the default board before the project's intake
 * routes place it, so only the default board lists records that have no card
 * yet. The server keeps that list (GitHub issues from the selected
 * repositories, the linked repositories' pull requests, and the issues of
 * provider sources bound to the project), so no provider is asked from here.
 * One read serves every source; Triage and a source filter each read the list
 * again, narrowed by the server.
 */
const INTAKE_CARD_SOURCES: Record<IntakeSource, BoardCandidate['source']> = {
  github: 'github-issue',
  'github-prs': 'github-pr',
  'gitlab-prs': 'gitlab-pr',
  gitlab: 'gitlab-issue',
  linear: 'linear-issue',
  jira: 'jira-issue',
  incidentio: 'incidentio-follow-up',
};

/** The server pass that keeps each source's records. */
const INTAKE_PASSES: Record<IntakeSource, { integrationId: string; kind: 'issue' | 'pull-request' }> = {
  github: { integrationId: 'github', kind: 'issue' },
  'github-prs': { integrationId: 'github', kind: 'pull-request' },
  'gitlab-prs': { integrationId: 'gitlab', kind: 'pull-request' },
  gitlab: { integrationId: 'gitlab', kind: 'issue' },
  linear: { integrationId: 'linear', kind: 'issue' },
  jira: { integrationId: 'jira', kind: 'issue' },
  incidentio: { integrationId: 'incidentio', kind: 'issue' },
};

/** A source as the list route names it: the integration with the kind of record wanted of it. */
const passFilter = (source: IntakeSource) => `${INTAKE_PASSES[source].integrationId}:${INTAKE_PASSES[source].kind}`;

/** Sources a board gets only through a binding to its project. */
const BOUND_SOURCES: ReadonlySet<IntakeSource> = new Set(['gitlab', 'linear', 'jira', 'incidentio']);

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
  const kind = definition.id;
  const defaultBoard = kind === DEFAULT_BOARD_ID;
  const browsesPullRequests = defaultBoard;
  // Work without Triage (a project created now) offers auto-triaged issues in Intake with the rest.
  const triageColumn = defaultBoard && definition.phases.some(phase => phase.id === 'triage');
  const initialPhase = definition.initialPhase;
  const repository = repositories[0];
  const gitlabRepository = repository?.provider === 'gitlab';
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const jiraStatusQuery = useJiraStatusQuery();
  const incidentioStatusQuery = useIncidentioStatusQuery();

  const config = configQuery.data;
  const gitlabStatusQuery = useGitLabStatusQuery(true);
  const githubEnabled = config?.github.enabled ?? true;
  // Every linked GitHub repository feeds intake, not just the first one. Pull requests come from
  // all of them; issues only from the repositories selected as issue sources.
  const githubSelected = repositories
    .filter(linked => linked.provider !== 'gitlab')
    .some(linked => (config ? (config.github.sourceIds?.includes(linked.slug) ?? false) : true));
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
  // intake route that places its new cards there: enabled, run on `work_item.created`, and not
  // one that only joins a pull request to an existing card (the server's `resolveIntakeRoute`).
  const readsIntakeRoutes = !defaultBoard && sourceConnected && available.length === 0;
  const intakeRoutesQuery = useIntakeRoutesQuery(readsIntakeRoutes ? factoryProjectId : undefined);
  const intakeRoutesPending = readsIntakeRoutes && intakeRoutesQuery.isPending;
  const intakeRoutesFailed = readsIntakeRoutes && intakeRoutesQuery.isError;
  const routePlacesCardsHere = (intakeRoutesQuery.data?.intakeRoutes ?? []).some(
    route =>
      route.enabled &&
      route.on.includes('work_item.created') &&
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

  // The lists are asked for as soon as the board is known, beside the configuration above rather
  // than after it; only the default board lists records with no card. The server narrows each one
  // before it pages it, so no column waits on the pages another has loaded.
  const everything = useIntakeCandidatesQuery(defaultBoard ? factoryProjectId : undefined);
  // A source filter hides some sources: the first column then pages the picked ones alone.
  const narrowed = browsedSources.length < feedSources.length;
  const picked = useIntakeCandidatesQuery(
    defaultBoard && narrowed && browsedSources.length > 0 ? factoryProjectId : undefined,
    { sources: browsedSources.map(passFilter) },
  );
  // Auto-triaged issues land in the default board's Triage, which pages them alone.
  const triaged = useIntakeCandidatesQuery(triageColumn && browsesGithub ? factoryProjectId : undefined, {
    sources: [passFilter('github')],
    label: AUTO_TRIAGED_LABEL,
  });
  const list = narrowed ? picked : everything;
  const offers = (sources: readonly IntakeSource[], candidate: BoardCandidate) =>
    sources.some(source => INTAKE_CARD_SOURCES[source] === candidate.source);
  const loaded = (query: typeof everything) =>
    (query.data?.pages ?? []).flatMap(page => page.candidates).flatMap(record => intakeCandidate(record) ?? []);
  // Every configured source counts here, so person and label filters know the people and labels of
  // a source that a source filter hides. A record two lists hold counts once.
  const participantCandidates = [
    ...new Map(
      [everything, picked, triaged]
        .flatMap(loaded)
        .filter(candidate => offers(feedSources, candidate))
        .map(candidate => [`${candidate.source}:${candidate.sourceKey}`, candidate]),
    ).values(),
  ];
  const candidates = [
    // Work without Triage offers an auto-triaged issue in its first column; with Triage it is on the Triage list.
    ...loaded(list)
      .filter(candidate => offers(browsedSources, candidate) && !(triageColumn && candidate.column === 'triage'))
      .map(candidate => ({ ...candidate, column: initialPhase })),
    ...loaded(triaged).filter(candidate => candidate.column === 'triage'),
  ];

  // A pass that failed keeps what it last read, so the list still shows but may be behind.
  const passes = (list.data ?? everything.data ?? triaged.data)?.pages[0]?.passes ?? [];
  const failed = (source: IntakeSource) =>
    passes.some(
      pass =>
        pass.failed &&
        pass.integrationId === INTAKE_PASSES[source].integrationId &&
        pass.kind === INTAKE_PASSES[source].kind,
    );
  const staleSource = browsedSources.find(failed);
  const listFeedOf = (query: typeof everything, stale: boolean): IntakeFeed & { isPending: boolean } => ({
    error: query.error,
    isPending: query.isPending,
    isFetchNextPageError: query.isFetchNextPageError,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    // A column asked twice for its next page joins the read in flight.
    fetchNextPage: () => query.fetchNextPage({ cancelRefetch: false }),
    refetch: () => query.refetch(),
    stale,
  });
  // Routing failures retry discovery rather than the list: without bindings the board cannot tell
  // which provider sources are its own.
  const unroutedSource = bindingsFailed ? browsedSources.find(source => BOUND_SOURCES.has(source)) : undefined;
  const listFeed: IntakeFeed & { isPending: boolean } = unroutedSource
    ? {
        error: bindingsQuery.error,
        isPending: false,
        fetchNextPage: () => undefined,
        refetch: () => bindingsQuery.refetch(),
      }
    : listFeedOf(list, staleSource !== undefined);
  const feed = intakeRoutesFailed
    ? {
        error: intakeRoutesQuery.error,
        isPending: false,
        fetchNextPage: () => undefined,
        refetch: () => intakeRoutesQuery.refetch(),
      }
    : browsedSources.length > 0
      ? listFeed
      : undefined;
  // Triage reads its own list, so it pages, fails and retries on its own.
  const feedByColumn: Partial<Record<BoardStageId, IntakeFeed>> = {
    ...(triageColumn && browsesGithub ? { triage: listFeedOf(triaged, failed('github')) } : {}),
    [initialPhase]: feed,
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
    // Names the source a notice is about; a failed read of the list is about none of them.
    active: unroutedSource ?? (list.error ? undefined : (staleSource ?? browsedSources[0])),
    available,
    fed,
    unrouted,
    candidates,
    participantCandidates,
    feedByColumn,
    isPending,
    isTriagePending: triageColumn && browsesGithub && triaged.isPending,
  };
}
