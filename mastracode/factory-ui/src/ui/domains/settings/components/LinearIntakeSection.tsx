import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import type { UseQueryResult } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useIntakeBindingsQuery } from '../../../../hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearTeamsQuery } from '../../../../hooks/useLinearData';
import { isLinearReauthError, linearTeamSourceId } from '../../factory/services/linear';
import type { LinearStatus } from '../../factory/services/linear';
import type { FactoryProject } from '../../workspaces/services/github';
import { IntakeProviderCard, toggleSourceId } from './IntakeProviderCard';
import type { IntakeSectionProps } from './IntakeProviderCard';
import { SourcePicker } from './IntakeSourcePicker';
import { groupLinearSourcesByTeam } from './intakeSourceGroups';
import { LinearRouting } from './LinearRouting';
import { SettingsIntegrationIcon } from './brand-icons/SettingsIntegrationIcon';
import { IntakeSyncControl } from './common/IntakeSyncControl';

const NO_REPOSITORY_MAPPING = '__no_repository_mapping__';

export function LinearIntakeSection({
  config,
  busy,
  update,
  factories,
  statusQuery,
}: IntakeSectionProps & {
  factories: FactoryProject[];
  statusQuery: UseQueryResult<LinearStatus>;
}) {
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
    if (statusQuery.isPending) return 'Checking the Linear connection…';
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
      connected={connected || statusQuery.isPending || statusQuery.isError}
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
        <>
          <SourcePicker
            label="Linear projects and teams"
            addLabel="Add project or team"
            itemIcon={<SettingsIntegrationIcon provider="linear" />}
            groups={groupLinearSourcesByTeam(projects, teams, config.linear.sourceIds)}
            selectedIds={config.linear.sourceIds}
            disabled={busy}
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
          {!sourceError && (
            <LinearRouting
              sourceIds={config.linear.sourceIds ?? []}
              projects={projects}
              teams={teams}
              factories={factories}
            />
          )}
          {routedProjects.length > 0 && (
            <div className="flex flex-col">
              <Txt tone="muted" as="p" variant="caption">
                Map Linear projects to repositories so their issues start in the intended repository.
              </Txt>
              {routedProjects.map(({ project, repositorySlugs }) => {
                const mappedRepository = config.linear.repositoryByLinearProject?.[project.id];
                return (
                  <SettingsRow key={project.id} label={project.name}>
                    <Select
                      value={mappedRepository ?? NO_REPOSITORY_MAPPING}
                      disabled={busy}
                      onValueChange={value => {
                        const repositoryByLinearProject = { ...config.linear.repositoryByLinearProject };
                        if (value === NO_REPOSITORY_MAPPING) delete repositoryByLinearProject[project.id];
                        else repositoryByLinearProject[project.id] = value;
                        update({ ...config, linear: { ...config.linear, repositoryByLinearProject } });
                      }}
                    >
                      <SelectTrigger size="sm" aria-label={`Repository for ${project.name}`} className="w-auto">
                        <Txt as="span" variant="caption">
                          {mappedRepository ?? 'No repository mapping'}
                        </Txt>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_REPOSITORY_MAPPING}>No repository mapping</SelectItem>
                        {repositorySlugs.map(slug => (
                          <SelectItem key={slug} value={slug}>
                            {slug}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </SettingsRow>
                );
              })}
            </div>
          )}
        </>
      )}
    </IntakeProviderCard>
  );
}
