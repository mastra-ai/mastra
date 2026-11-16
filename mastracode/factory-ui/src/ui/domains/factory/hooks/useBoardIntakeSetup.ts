import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { useGitLabStatusQuery } from '../../../../hooks/useGitLabData';
import { useIntakeBindingsQuery, useIntakeConfigQuery } from '../../../../hooks/useIntakeConfig';
import { useIntakeRoutesQuery } from '../../../../hooks/useIntakeRoutes';
import { useIncidentioStatusQuery } from '../../../../hooks/useIncidentioData';
import { useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearStatusQuery } from '../../../../hooks/useLinearData';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import type { InstalledBoardInfo } from '../../../../api/types';

/**
 * Whether anything files new cards onto a board, so its initial phase can ask for the setup it
 * misses: a connected source, or an intake route that sends cards here.
 *
 * The board shows cards only. The server files every new issue and pull request of a connected
 * source as a card, through the project's intake rules, so no provider's list is read here.
 */
export function useBoardIntakeSetup({
  factoryProjectId,
  repositories,
  definition,
}: {
  factoryProjectId: string;
  /** Every linked repository; the first decides between GitHub and GitLab. */
  repositories: readonly LinkedRepositoryPayload[];
  definition: InstalledBoardInfo;
}) {
  const kind = definition.id;
  const defaultBoard = kind === DEFAULT_BOARD_ID;
  const gitlabRepository = repositories[0]?.provider === 'gitlab';
  const configQuery = useIntakeConfigQuery();
  const linearStatusQuery = useLinearStatusQuery();
  const jiraStatusQuery = useJiraStatusQuery();
  const incidentioStatusQuery = useIncidentioStatusQuery();
  const gitlabStatusQuery = useGitLabStatusQuery(true);
  const bindingsQuery = useIntakeBindingsQuery();

  const config = configQuery.data;
  const githubEnabled = config?.github.enabled ?? false;
  // GitHub issues come from the linked repositories selected as issue sources.
  const githubSelected = repositories.some(
    linked =>
      linked.provider !== 'gitlab' && (config ? (config.github.sourceIds?.includes(linked.slug) ?? false) : true),
  );
  const gitlabConnected = Boolean(gitlabStatusQuery.data?.enabled && gitlabStatusQuery.data.configured);
  const linearConnected = Boolean(linearStatusQuery.data?.enabled && linearStatusQuery.data.connected);
  const jiraConfigured = Boolean(jiraStatusQuery.data?.enabled && jiraStatusQuery.data.configured);
  const incidentioConfigured = Boolean(incidentioStatusQuery.data?.enabled && incidentioStatusQuery.data.configured);
  const gitlabEligible =
    (config?.gitlab.enabled ?? false) && gitlabConnected && (config?.gitlab.sourceIds?.length ?? 0) > 0;
  const linearEligible =
    (config?.linear.enabled ?? false) && linearConnected && (config?.linear.sourceIds?.length ?? 0) > 0;
  const jiraEligible = (config?.jira.enabled ?? false) && jiraConfigured && (config?.jira.sourceIds?.length ?? 0) > 0;
  const incidentioEligible =
    (config?.incidentio?.enabled ?? false) && incidentioConfigured && (config?.incidentio?.sourceIds?.length ?? 0) > 0;
  // Bindings decide whether a provider feeds the default board at all, so it stays pending until
  // they load rather than asking for a source it has.
  const providerEligible = defaultBoard && (gitlabEligible || linearEligible || jiraEligible || incidentioEligible);
  const bindingsPending = providerEligible && bindingsQuery.isPending;

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
  // A connected source files onto the default board, and onto another board only through an
  // intake route that places its new cards there: enabled, run on `work_item.created`, and not
  // one that only joins a pull request to an existing card (the server's `resolveIntakeRoute`).
  const readsIntakeRoutes = !defaultBoard && sourceConnected;
  const intakeRoutesQuery = useIntakeRoutesQuery(readsIntakeRoutes ? factoryProjectId : undefined);
  const intakeRoutesPending = readsIntakeRoutes && intakeRoutesQuery.isPending;
  const routePlacesCardsHere = (intakeRoutesQuery.data?.intakeRoutes ?? []).some(
    route =>
      route.enabled &&
      route.on.includes('work_item.created') &&
      !route.target.joinClosedIssue &&
      route.target.boardKey === kind,
  );
  // Sources are connected and the routes loaded, but none places new cards on this board.
  const unrouted = readsIntakeRoutes && intakeRoutesQuery.isSuccess && !routePlacesCardsHere;
  // Whether anything files onto this board. Routes that failed to load ask for no setup.
  const fed = sourceConnected && (defaultBoard || !intakeRoutesQuery.isSuccess || routePlacesCardsHere);

  // Keep an unresolved board pending while discovering its routed sources.
  const discoveringSources =
    ((config?.gitlab.enabled ?? false) && gitlabStatusQuery.isPending) ||
    ((config?.linear.enabled ?? false) && linearStatusQuery.isPending) ||
    ((config?.jira.enabled ?? false) && jiraStatusQuery.isPending) ||
    ((config?.incidentio?.enabled ?? false) && incidentioStatusQuery.isPending) ||
    bindingsPending ||
    intakeRoutesPending;

  // Failed bindings or routes leave the board unable to tell whether anything files here.
  const failedRead =
    providerEligible && bindingsQuery.isError
      ? bindingsQuery
      : readsIntakeRoutes && intakeRoutesQuery.isError
        ? intakeRoutesQuery
        : undefined;
  const failure = failedRead?.error
    ? { message: failedRead.error.message, retry: () => void failedRead.refetch() }
    : undefined;

  return { fed, unrouted, failure, isPending: configQuery.isPending || discoveringSources };
}
