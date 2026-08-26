import { Button } from '@mastra/playground-ui/components/Button';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../../../hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { connectLinear, isLinearReauthError } from '../../factory/services/linear';
import type { LinearProject, LinearStatus } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { SourcePicker } from './IntakeSourcePicker';
import type { SourcePickerGroup } from './IntakeSourcePicker';
import { LinearRouting } from './LinearRouting';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

/**
 * Toggle `id` in the selection list. `null` means "nothing selected" (nothing
 * syncs) — the first pick starts from an empty list, and clearing the last
 * pick returns to `null`.
 */
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
      title="GitHub issues"
      description="Open issues from the selected repositories. Pull requests always appear in Review."
    >
      <SettingsCard>
        <SettingsRow variant="factory" label="Sync GitHub issues">
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
      </SettingsCard>
    </SettingsSubsection>
  );
}

/**
 * Linear needs an OAuth workspace before anything can sync, so the connection
 * state is the section header: the description says what is missing and the
 * action connects or reconnects.
 */
function LinearIntakeSection({
  config,
  busy,
  update,
  status,
  connected,
  projects,
  reauthRequired,
  showPickers,
  baseUrl,
}: SourceSectionProps & {
  status: LinearStatus | undefined;
  connected: boolean;
  projects: LinearProject[];
  reauthRequired: boolean;
  /** Projects can only be picked — and routed — once Linear answers with them. */
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
        : 'Active issues from the selected projects.';

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
    <SettingsSubsection title="Linear issues" description={description} action={action}>
      <SettingsCard>
        <SettingsRow variant="factory" label="Sync Linear issues">
          <Switch
            aria-label="Sync Linear issues"
            checked={config.linear.enabled}
            disabled={busy || !connected}
            onCheckedChange={enabled => update({ ...config, linear: { ...config.linear, enabled } })}
          />
        </SettingsRow>

        {showPickers && (
          <SourcePicker
            label="Linear projects"
            groups={groupLinearProjectsByTeam(projects)}
            selectedIds={config.linear.sourceIds}
            disabled={busy}
            pending={busy}
            onToggleItem={projectId =>
              update({
                ...config,
                linear: { ...config.linear, sourceIds: toggleId(config.linear.sourceIds, projectId) },
              })
            }
          />
        )}
      </SettingsCard>
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

  const config = configQuery.data;
  // The same repository can be linked to several factories; Intake picks it once.
  const linkedSlugs = [
    ...new Set((factoriesQuery.data ?? []).flatMap(factory => factory.repositories.map(r => r.slug))),
  ];

  if (configQuery.isPending) {
    return <SkeletonRows label="Loading intake sources" rows={4} />;
  }
  if (configQuery.isError || !config) {
    return (
      <Txt as="p" variant="ui-sm" className="text-icon3">
        Intake configuration is unavailable. Connect GitHub or Linear first.
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
  const reauthRequired = isLinearReauthError(linearProjectsQuery.error);
  const routedProjectIds = config.linear.sourceIds ?? [];
  const linearReady = linearConnected && config.linear.enabled && !reauthRequired && linearProjects.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <GithubIntakeSection config={config} busy={busy} update={update} slugs={linkedSlugs} />
      <LinearIntakeSection
        config={config}
        busy={busy}
        update={update}
        status={linearStatus}
        connected={linearConnected}
        projects={linearProjects}
        reauthRequired={reauthRequired}
        showPickers={linearReady}
        baseUrl={baseUrl}
      />
      {linearReady && routedProjectIds.length > 0 && (
        <SettingsSubsection
          title="Linear routing"
          description="Each selected project feeds one factory. Until a project is routed, its issues are not picked up."
        >
          <SettingsCard>
            <LinearRouting
              sourceIds={routedProjectIds}
              projects={linearProjects}
              factories={factoriesQuery.data ?? []}
            />
          </SettingsCard>
        </SettingsSubsection>
      )}
    </div>
  );
}
/**
 * Group Linear projects under each team they belong to (shared projects appear
 * in every team), sorted by team name. Team-less projects land in a trailing
 * "No team" group.
 */
function groupLinearProjectsByTeam(projects: LinearProject[]): SourcePickerGroup[] {
  const byTeam = new Map<string, SourcePickerGroup>();
  const orphans: LinearProject[] = [];
  for (const project of projects) {
    if (project.teams.length === 0) {
      orphans.push(project);
      continue;
    }
    for (const team of project.teams) {
      const group = byTeam.get(team.id) ?? { id: team.id, label: team.name, items: [] };
      group.items.push({ id: project.id, label: project.name });
      byTeam.set(team.id, group);
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
