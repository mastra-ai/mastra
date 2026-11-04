import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useIntakeBindingsQuery } from '../../../../hooks/useIntakeConfig';
import { useLinearProjectListingQuery, useLinearTeamListingQuery } from '../../../../hooks/useLinearData';
import {
  isLinearReauthError,
  isLinearTeamSourceId,
  linearSourceWorkspaceId,
  linearTeamSourceId,
} from '../../factory/services/linear';
import type { LinearStatus } from '../../factory/services/linear';
import { useLinearReconnectResult } from '../hooks/useLinearReconnectResult';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';
import { groupLinearSourcesByTeam, partitionLinearSources } from './intakeSourceGroups';
import { DisconnectedLinearWorkspaces } from './DisconnectedLinearWorkspaces';
import { LinearRepositoryMappings } from './LinearRepositoryMappings';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';
import { PausedLinearWorkspace } from './PausedLinearWorkspace';

export function LinearIntakeSection({
  config,
  busy,
  update,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<LinearStatus> }) {
  const factories = useFactoriesQuery().data ?? [];
  const status = statusQuery.data;
  const reconnect = useLinearReconnectResult(statusQuery);
  const connected = Boolean(status?.enabled && status.connected);
  const projectsQuery = useLinearProjectListingQuery(connected);
  const teamsQuery = useLinearTeamListingQuery(connected);
  const bindingsQuery = useIntakeBindingsQuery();
  const projects = projectsQuery.data?.projects ?? [];
  const teams = teamsQuery.data?.teams ?? [];
  const workspaceErrors = new Map(
    [...(projectsQuery.data?.workspaceErrors ?? []), ...(teamsQuery.data?.workspaceErrors ?? [])].map(error => [
      error.workspaceId,
      error,
    ]),
  );
  const bindings = bindingsQuery.data ?? [];
  const reauthRequired = isLinearReauthError(projectsQuery.error) || isLinearReauthError(teamsQuery.error);
  const sourceError = projectsQuery.isError || teamsQuery.isError;
  const paused = (status?.workspaces ?? [])
    .filter(workspace => !workspace.connected)
    .map(workspace => ({
      workspace,
      sourceIds: (config.linear.sourceIds ?? []).filter(id => linearSourceWorkspaceId(id) === workspace.id),
    }))
    .filter(group => group.sourceIds.length > 0);
  const pausedIds = new Set(paused.flatMap(group => group.sourceIds));
  const groups = groupLinearSourcesByTeam(projects, teams, config.linear.sourceIds);
  const sourcesLoaded = projectsQuery.isSuccess && teamsQuery.isSuccess && workspaceErrors.size === 0;
  // Direct-OAuth and older Platform servers send no workspace inventory, so a
  // saved source's workspace counts as disconnected once the listings omit it.
  const inferredSources =
    status?.workspaces === undefined && sourcesLoaded
      ? partitionLinearSources(config.linear.sourceIds, groups)
      : { selectedIds: config.linear.sourceIds ?? [], disconnected: [] };
  const selectedIds =
    status?.workspaces === undefined
      ? inferredSources.selectedIds
      : (config.linear.sourceIds ?? []).filter(id => !pausedIds.has(id));
  const listedIds = new Set(groups.flatMap(group => group.items.map(item => item.id)));
  const missingIds = selectedIds.filter(id => !listedIds.has(id));
  function missingSourceLabel(id: string) {
    const team = isLinearTeamSourceId(id);
    const sameKind = missingIds.filter(missing => isLinearTeamSourceId(missing) === team);
    const kind = team ? 'Linear team' : 'Linear project';
    const label = sourcesLoaded ? `Unknown ${kind}` : kind;
    return sameKind.length > 1 ? `${label} ${sameKind.indexOf(id) + 1}` : label;
  }
  const statusUnavailable = statusQuery.isError || status?.reason === 'unavailable';
  const description = connectionDescription();
  function connectionDescription() {
    if (statusUnavailable) return "Couldn't load Linear status.";
    if (status?.enabled === false) return 'Linear is not configured on this server.';
    if (reauthRequired) return 'Linear authorization expired. Reconnect to keep syncing issues.';
    if (!connected && paused.length > 0) return 'Intake is paused until you reconnect your Linear workspace.';
    if (!connected) return 'Connect a Linear workspace to sync its issues.';
    return undefined;
  }
  const routedProjects = projects.flatMap(project => {
    const sourceIds = config.linear.sourceIds?.includes(project.id)
      ? [project.id]
      : teams
          .filter(team =>
            project.teams.some(
              member => member.id === team.id && config.linear.sourceIds?.includes(linearTeamSourceId(team)),
            ),
          )
          .map(linearTeamSourceId);
    const factoryIds = [
      ...new Set(
        bindings
          .filter(binding => binding.integrationId === 'linear' && sourceIds.includes(binding.sourceId))
          .map(binding => binding.factoryProjectId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (factoryIds.length !== 1) return [];
    const factory = factories.find(candidate => candidate.id === factoryIds[0]);
    const repositorySlugs = [...new Set(factory?.repositories.map(repository => repository.slug) ?? [])];
    return repositorySlugs.length ? [{ project, repositorySlugs }] : [];
  });

  return (
    <IntakeProviderCard
      name="Linear"
      icon={<SettingsIntegrationIcon provider="linear" />}
      account={status?.workspace?.name ?? undefined}
      listed={listed}
      connectable={status?.enabled !== false}
      description={description}
      syncControl={
        <IntakeSyncControl
          accessibleLabel="Sync Linear issues"
          description="Active issues from selected projects and teams feed your board. Whole teams include projectless issues."
          checked={config.linear.enabled}
          disabled={busy || !connected}
          onCheckedChange={enabled => update({ ...config, linear: { ...config.linear, enabled } })}
        />
      }
      action={
        statusUnavailable && (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        )
      }
    >
      {connected && config.linear.enabled && !reauthRequired && inferredSources.disconnected.length > 0 && (
        <DisconnectedLinearWorkspaces
          workspaces={inferredSources.disconnected}
          pending={busy}
          onRemove={sourceIds => {
            const next = (config.linear.sourceIds ?? []).filter(id => !sourceIds.includes(id));
            void update({ ...config, linear: { ...config.linear, sourceIds: next.length ? next : null } });
          }}
        />
      )}
      {[...workspaceErrors.values()].map(error => (
        <SettingsRow
          key={error.workspaceId}
          label={`Couldn't load sources from ${error.name}.`}
          description="Sources from other workspaces remain available. Your saved selections and routing are kept."
        >
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            onClick={() => {
              void projectsQuery.refetch();
              void teamsQuery.refetch();
            }}
          >
            Retry
          </Button>
        </SettingsRow>
      ))}
      {paused.map(({ workspace, sourceIds }) => (
        <PausedLinearWorkspace
          key={workspace.id}
          workspace={workspace}
          count={sourceIds.length}
          pending={busy}
          reconnect={reconnect.resultFor(workspace)}
          onRetry={() => void reconnect.retry()}
          onRemove={() => {
            const remaining = (config.linear.sourceIds ?? []).filter(id => !sourceIds.includes(id));
            void update({ ...config, linear: { ...config.linear, sourceIds: remaining.length ? remaining : null } });
          }}
        />
      ))}
      {connected && config.linear.enabled && !reauthRequired && (
        <RoutedSourcePicker
          integrationId="linear"
          routingLabel="Linear"
          factories={factories}
          label="Linear projects and teams"
          addLabel="Add project or team"
          itemIcon={<SettingsIntegrationIcon provider="linear" />}
          groups={groups}
          selectedIds={projectsQuery.isPending || teamsQuery.isPending ? [] : selectedIds}
          fallbackLabel={missingSourceLabel}
          pending={busy}
          loading={projectsQuery.isPending}
          error={sourceError ? "Couldn't load Linear projects and teams." : undefined}
          onRetry={() => {
            void projectsQuery.refetch();
            void teamsQuery.refetch();
          }}
          onToggleItem={id =>
            update({
              ...config,
              linear: { ...config.linear, sourceIds: toggleSourceId(config.linear.sourceIds, id) },
            })
          }
        />
      )}
      {routedProjects.length > 0 && (
        <LinearRepositoryMappings
          projects={routedProjects}
          mapping={config.linear.repositoryByLinearProject}
          pending={busy}
          onChange={repositoryByLinearProject =>
            update({ ...config, linear: { ...config.linear, repositoryByLinearProject } })
          }
        />
      )}
    </IntakeProviderCard>
  );
}
