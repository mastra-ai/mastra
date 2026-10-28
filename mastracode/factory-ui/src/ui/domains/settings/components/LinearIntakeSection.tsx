import { Button } from '@mastra/playground-ui/components/Button';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { useIntakeBindingsQuery } from '../../../../hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearTeamsQuery } from '../../../../hooks/useLinearData';
import { isLinearReauthError, linearTeamSourceId } from '../../factory/services/linear';
import type { LinearStatus } from '../../factory/services/linear';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { RoutedSourcePicker } from './IntakeSourceRouting';
import { groupLinearSourcesByTeam } from './intakeSourceGroups';
import { LinearRepositoryMappings } from './LinearRepositoryMappings';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

export function LinearIntakeSection({
  config,
  busy,
  update,
  listed,
  statusQuery,
}: IntakeSectionProps & { statusQuery: UseQueryResult<LinearStatus> }) {
  const factories = useFactoriesQuery().data ?? [];
  const status = statusQuery.data;
  const connected = Boolean(status?.enabled && status.connected);
  const projectsQuery = useLinearProjectsQuery(connected);
  const teamsQuery = useLinearTeamsQuery(connected);
  const bindingsQuery = useIntakeBindingsQuery();
  const projects = projectsQuery.data ?? [];
  const teams = teamsQuery.data ?? [];
  const bindings = bindingsQuery.data ?? [];
  const reauthRequired = isLinearReauthError(projectsQuery.error) || isLinearReauthError(teamsQuery.error);
  const sourceError = projectsQuery.isError || teamsQuery.isError;
  const description = connectionDescription();
  function connectionDescription() {
    if (statusQuery.isError) return "Couldn't load Linear status.";
    if (status?.enabled === false) return 'Linear is not configured on this server.';
    if (reauthRequired) return 'Linear authorization expired. Reconnect to keep syncing issues.';
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
        statusQuery.isError && (
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void statusQuery.refetch()}>
            Retry
          </Button>
        )
      }
    >
      {connected && config.linear.enabled && !reauthRequired && (
        <RoutedSourcePicker
          integrationId="linear"
          routingLabel="Linear"
          factories={factories}
          label="Linear projects and teams"
          addLabel="Add project or team"
          itemIcon={<SettingsIntegrationIcon provider="linear" />}
          groups={groupLinearSourcesByTeam(projects, teams, config.linear.sourceIds)}
          selectedIds={projectsQuery.isPending ? [] : config.linear.sourceIds}
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
