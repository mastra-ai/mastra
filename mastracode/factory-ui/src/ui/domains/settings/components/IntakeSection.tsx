import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsContainer, SettingsRow } from '@mastra/playground-ui/new/settings';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../../../hooks/useIntakeConfig';
import { useJiraProjectsQuery, useJiraStatusQuery } from '../../../../hooks/useJiraData';
import { useLinearProjectsQuery, useLinearStatusQuery, useLinearTeamsQuery } from '../../../../hooks/useLinearData';
import { isJiraAuthError } from '../../factory/services/jira';
import type { JiraProject, JiraStatus } from '../../factory/services/jira';
import { connectLinear, isLinearReauthError, linearTeamSourceId } from '../../factory/services/linear';
import type { LinearProject, LinearStatus, LinearTeam } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { SourcePicker } from './IntakeSourcePicker';
import type { SourcePickerGroup } from './IntakeSourcePicker';
import { GithubLabelRouting } from './GithubLabelRouting';
import { IntakeSourceRouting, LinearRouting } from './LinearRouting';

import { SettingsSubsection } from './SettingsSubsection';

function toggleId(ids: string[] | null, id: string): string[] | null {
  const current = ids ?? [];
  const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
  return next.length ? next : null;
}

interface SourceSectionProps {
  config: IntakeConfig;
  busy: boolean;
  update: (next: IntakeConfig) => void;
}

function GithubIntakeSection({ config, busy, update, slugs }: SourceSectionProps & { slugs: string[] }) {
  return (
    <SettingsSubsection
      scope="org"
      title="GitHub issues"
      description="Open issues from the selected repositories feed every member's board. Pull requests always appear in Review."
    >
      <SettingsContainer>
        <SettingsRow label="Sync GitHub issues">
          <Switch
            aria-label="Sync GitHub issues"
            checked={config.github.enabled}
            disabled={busy}
            onCheckedChange={enabled => update({ ...config, github: { ...config.github, enabled } })}
          />
        </SettingsRow>

        {config.github.enabled &&
          (slugs.length === 0 ? (
            <Txt as="p" variant="ui-sm" className="text-icon3 px-4 py-3">
              No linked repositories yet — link a repository to a factory to add one.
            </Txt>
          ) : (
            <SourcePicker
              label="Repositories"
              groups={[
                {
                  id: 'repositories',
                  items: slugs.map(slug => ({ id: slug, label: slug })),
                },
              ]}
              selectedIds={config.github.sourceIds}
              disabled={busy}
              pending={busy}
              onToggleItem={slug =>
                update({
                  ...config,
                  github: { ...config.github, sourceIds: toggleId(config.github.sourceIds, slug) },
                })
              }
            />
          ))}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function LinearIntakeSection({
  config,
  busy,
  update,
  status,
  connected,
  projects,
  teams,
  reauthRequired,
  showPickers,
  baseUrl,
}: SourceSectionProps & {
  status: LinearStatus | undefined;
  connected: boolean;
  projects: LinearProject[];
  teams: LinearTeam[];
  reauthRequired: boolean;

  showPickers: boolean;
  baseUrl: string;
}) {
  const serverConfigured = status?.enabled !== false;
  const description = !serverConfigured
    ? 'Linear is not configured on this server.'
    : !connected
      ? 'Connect a Linear workspace to sync its issues.'
      : reauthRequired
        ? 'Linear authorization expired. Reconnect to keep syncing issues.'
        : "Active issues from the selected projects and teams feed every member's board. Selecting a whole team also covers its projectless issues.";

  const action = !serverConfigured ? undefined : !connected ? (
    <Button size="sm" onClick={() => connectLinear(baseUrl)}>
      Connect Linear
    </Button>
  ) : reauthRequired ? (
    <Button size="sm" onClick={() => connectLinear(baseUrl)}>
      Reconnect Linear
    </Button>
  ) : (
    <span className="flex items-center gap-2">
      <Txt as="span" variant="ui-sm" className="text-icon3">
        Connected to {status?.workspace?.name ?? 'a Linear workspace'}
      </Txt>
      <Button size="xs" variant="ghost" onClick={() => connectLinear(baseUrl)}>
        Reconnect
      </Button>
    </span>
  );

  return (
    <SettingsSubsection scope="org" title="Linear issues" description={description} action={action}>
      <SettingsContainer>
        <SettingsRow label="Sync Linear issues">
          <Switch
            aria-label="Sync Linear issues"
            checked={config.linear.enabled}
            disabled={busy || !connected}
            onCheckedChange={enabled => update({ ...config, linear: { ...config.linear, enabled } })}
          />
        </SettingsRow>

        {showPickers && (
          <SourcePicker
            label="Linear projects and teams"
            groups={groupLinearSourcesByTeam(projects, teams, config.linear.sourceIds)}
            selectedIds={config.linear.sourceIds}
            disabled={busy}
            pending={busy}
            onToggleItem={sourceId =>
              update({
                ...config,
                linear: { ...config.linear, sourceIds: toggleId(config.linear.sourceIds, sourceId) },
              })
            }
          />
        )}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function JiraIntakeSection({
  config,
  busy,
  update,
  status,
  projects,
  authError,
  reauthRequired,
  showPickers,
}: SourceSectionProps & {
  status: JiraStatus | undefined;
  projects: JiraProject[];
  authError: boolean;
  reauthRequired: boolean;
  showPickers: boolean;
}) {
  const configured = Boolean(status?.enabled && status.configured);
  const platformManaged = status?.mode === 'platform' || status?.connections !== undefined;
  const description = reauthRequired
    ? 'A Jira account needs to be reconnected in Mastra Platform.'
    : !configured
      ? platformManaged
        ? 'Connect Jira in Mastra Platform to sync issues from this organization.'
        : 'Jira is not configured on this server. Set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN to enable it.'
      : authError
        ? platformManaged
          ? 'Jira rejected a connected account. Reconnect it in Mastra Platform.'
          : 'Jira rejected the configured credentials. Ask the operator to check the Jira API token.'
        : 'Active issues from the selected projects.';
  const sites = status?.sites ?? (status?.site ? [status.site] : []);
  let connectionLabel = 'Jira connected';
  if (sites.length === 1) {
    connectionLabel = `Connected to ${sites[0]}`;
  } else if (sites.length > 1) {
    connectionLabel = `${sites.length} Jira sites connected`;
  } else if (platformManaged) {
    connectionLabel = 'Connected through Mastra Platform';
  }
  const needsReconnect = reauthRequired || authError;
  const manageUrl = platformManaged ? status?.manageUrl : undefined;
  const manageButton = manageUrl ? (
    <Button as="a" href={manageUrl} size={configured ? 'xs' : 'sm'} variant={configured ? 'ghost' : 'default'}>
      {needsReconnect ? 'Reconnect Jira' : configured ? 'Manage Jira' : 'Connect Jira'}
    </Button>
  ) : undefined;
  const action = configured ? (
    <span className="flex items-center gap-2">
      <Txt as="span" variant="ui-sm" className="text-icon3">
        {connectionLabel}
      </Txt>
      {manageButton}
    </span>
  ) : (
    manageButton
  );

  return (
    <SettingsSubsection scope="org" title="Jira issues" description={description} action={action}>
      <SettingsContainer>
        <SettingsRow label="Sync Jira issues">
          <Switch
            aria-label="Sync Jira issues"
            checked={config.jira.enabled}
            disabled={busy || !configured}
            onCheckedChange={enabled => update({ ...config, jira: { ...config.jira, enabled } })}
          />
        </SettingsRow>

        {showPickers && (
          <SourcePicker
            label="Jira projects"
            groups={groupJiraProjectsBySite(projects)}
            selectedIds={config.jira.sourceIds}
            disabled={busy}
            pending={busy}
            onToggleItem={projectId =>
              update({
                ...config,
                jira: { ...config.jira, sourceIds: toggleId(config.jira.sourceIds, projectId) },
              })
            }
          />
        )}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

export function IntakeSection() {
  const { baseUrl } = useApiConfig();
  const configQuery = useIntakeConfigQuery();
  const saveMutation = useSaveIntakeConfigMutation();
  const factoriesQuery = useFactoriesQuery();
  const linearStatusQuery = useLinearStatusQuery();

  const linearStatus = linearStatusQuery.data;
  const linearConnected = Boolean(linearStatus?.enabled && linearStatus.connected);
  const linearProjectsQuery = useLinearProjectsQuery(linearConnected);
  const linearTeamsQuery = useLinearTeamsQuery(linearConnected);
  const jiraStatusQuery = useJiraStatusQuery();
  const jiraStatus = jiraStatusQuery.data;
  const jiraConfigured = Boolean(jiraStatus?.enabled && jiraStatus.configured);
  const jiraReauthRequired = Boolean(jiraStatus?.connections?.some(connection => connection.status === 'needs_reauth'));
  const jiraProjectsQuery = useJiraProjectsQuery(jiraConfigured);

  const config = configQuery.data;

  const linkedSlugs = [
    ...new Set((factoriesQuery.data ?? []).flatMap(factory => factory.repositories.map(r => r.slug))),
  ];

  if (configQuery.isPending) {
    return <SkeletonRows label="Loading intake sources" rows={4} />;
  }
  if (configQuery.isError || !config) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3">
        Intake configuration is unavailable. Connect GitHub, Linear, or Jira first.
      </Txt>
    );
  }

  const update = (next: IntakeConfig) => {
    saveMutation.mutate(next, {
      onSuccess: () => toast.success('Intake sources updated'),
      onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save intake sources'),
    });
  };
  const busy = saveMutation.isPending;
  const linearProjects = linearProjectsQuery.data ?? [];
  const linearTeams = linearTeamsQuery.data ?? [];
  const reauthRequired = isLinearReauthError(linearProjectsQuery.error);
  const routedProjectIds = config.linear.sourceIds ?? [];
  const linearReady =
    linearConnected &&
    config.linear.enabled &&
    !reauthRequired &&
    (linearProjects.length > 0 || linearTeams.length > 0);
  const jiraProjects = jiraProjectsQuery.data ?? [];
  const jiraAuthError = isJiraAuthError(jiraProjectsQuery.error);
  const jiraSourceIds = config.jira.sourceIds ?? [];
  const jiraReady = jiraConfigured && config.jira.enabled && !jiraAuthError && jiraProjects.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <GithubIntakeSection config={config} busy={busy} update={update} slugs={linkedSlugs} />
      {config.github.enabled && linkedSlugs.length > 0 && (factoriesQuery.data?.length ?? 0) > 0 && (
        <SettingsSubsection
          scope="org"
          title="GitHub routing"
          description="Issues carrying a routed label file onto that board in the Factory; everything else stays on Work."
        >
          {(factoriesQuery.data ?? [])
            .filter(factory => factory.repositories.length > 0)
            .map(factory => (
              <SettingsContainer key={factory.id}>
                <GithubLabelRouting
                  factoryProjectId={factory.id}
                  name={factory.name}
                  repositories={factory.repositories.map(r => r.slug)}
                />
              </SettingsContainer>
            ))}
        </SettingsSubsection>
      )}
      <LinearIntakeSection
        config={config}
        busy={busy}
        update={update}
        status={linearStatus}
        connected={linearConnected}
        projects={linearProjects}
        teams={linearTeams}
        reauthRequired={reauthRequired}
        showPickers={linearReady}
        baseUrl={baseUrl}
      />
      {linearReady && routedProjectIds.length > 0 && (
        <SettingsSubsection
          scope="org"
          title="Linear routing"
          description="Each selected source feeds one factory. Until a source is routed, its issues are not picked up."
        >
          <SettingsContainer>
            <LinearRouting
              sourceIds={routedProjectIds}
              projects={linearProjects}
              teams={linearTeams}
              factories={factoriesQuery.data ?? []}
            />
          </SettingsContainer>
        </SettingsSubsection>
      )}
      <JiraIntakeSection
        config={config}
        busy={busy}
        update={update}
        status={jiraStatus}
        projects={jiraProjects}
        authError={jiraAuthError}
        reauthRequired={jiraReauthRequired}
        showPickers={jiraReady}
      />
      {jiraReady && jiraSourceIds.length > 0 && (
        <SettingsSubsection
          scope="org"
          title="Jira routing"
          description="Each selected project feeds one factory. Until a project is routed, its issues are not picked up."
        >
          <SettingsContainer>
            <IntakeSourceRouting
              integrationId="jira"
              label="Jira"
              sourceIds={jiraSourceIds}
              sources={jiraProjects.map(project => ({ id: project.id, name: `${project.key} · ${project.name}` }))}
              factories={factoriesQuery.data ?? []}
            />
          </SettingsContainer>
        </SettingsSubsection>
      )}
    </div>
  );
}

/**
 * Group Jira projects by connection (labelled with the site host) so duplicate
 * project keys stay distinguishable — including two connections to the same
 * site, which get numbered labels instead of being merged.
 */
function groupJiraProjectsBySite(projects: JiraProject[]): SourcePickerGroup[] {
  const byConnection = new Map<string, SourcePickerGroup>();
  for (const project of projects) {
    const site = project.site ?? 'Jira';
    const key = project.connectionId ?? site;
    const group = byConnection.get(key) ?? { id: key, label: site, items: [] };
    group.items.push({ id: project.id, label: `${project.key} · ${project.name}` });
    byConnection.set(key, group);
  }
  const groups = [...byConnection.values()].toSorted((left, right) =>
    (left.label ?? '').localeCompare(right.label ?? ''),
  );
  const labelCounts = new Map<string, number>();
  for (const group of groups) labelCounts.set(group.label ?? '', (labelCounts.get(group.label ?? '') ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const group of groups) {
    const label = group.label ?? '';
    if ((labelCounts.get(label) ?? 0) > 1) {
      const ordinal = (seen.get(label) ?? 0) + 1;
      seen.set(label, ordinal);
      group.label = `${label} · connection ${ordinal}`;
    }
  }
  return groups;
}

function groupLinearSourcesByTeam(
  projects: LinearProject[],
  teams: LinearTeam[],
  selectedIds: string[] | null,
): SourcePickerGroup[] {
  const selected = new Set(selectedIds ?? []);
  const teamById = new Map(teams.map(team => [team.id, team]));
  const byTeam = new Map<string, SourcePickerGroup>();
  const orphans: LinearProject[] = [];

  const ensureGroup = (teamId: string, teamName: string): SourcePickerGroup => {
    const existing = byTeam.get(teamId);
    if (existing) return existing;
    // Only a returned team DTO can mint a selectable team source. Project
    // metadata may arrive first, but it does not carry the backend's opaque id.
    const team = teamById.get(teamId);
    const group: SourcePickerGroup = {
      id: teamId,
      label: teamName,
      items: team ? [{ id: linearTeamSourceId(team), label: `All issues in ${teamName}` }] : [],
    };
    byTeam.set(teamId, group);
    return group;
  };

  // Seed a group per known team so a team with no projects is still selectable.
  for (const team of teams) ensureGroup(team.id, team.name);

  for (const project of projects) {
    if (project.teams.length === 0) {
      orphans.push(project);
      continue;
    }
    for (const team of project.teams) {
      const group = ensureGroup(team.id, teamById.get(team.id)?.name ?? team.name);
      // A project is redundant when its whole team is already selected.
      const knownTeam = teamById.get(team.id);
      const teamSelected = knownTeam ? selected.has(linearTeamSourceId(knownTeam)) : false;
      const projectSelected = selected.has(project.id);
      group.items.push({
        id: project.id,
        label: project.name,
        ...(teamSelected ? { hint: projectSelected ? 'project takes precedence' : 'included via team' } : {}),
      });
    }
  }

  const groups = [...byTeam.values()].sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
  if (orphans.length) {
    groups.push({
      id: 'no-team',
      label: 'No team',
      items: orphans.map(project => ({ id: project.id, label: project.name })),
    });
  }
  return groups;
}
