import { Button } from '@mastra/playground-ui/components/Button';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../../../../shared/hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { connectLinear, isLinearReauthError } from '../../factory/services/linear';
import type { LinearProject } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';
import { isServerFactory } from '../../workspaces/services/factories';

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

function SourceHeader({
  title,
  hint,
  enabled,
  onToggle,
  disabled,
}: {
  title: string;
  hint: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col">
        <Txt as="span" variant="ui-sm" className="text-icon5">
          {title}
        </Txt>
        <Txt as="span" variant="ui-xs" className="text-icon3">
          {hint}
        </Txt>
      </div>
      <Switch aria-label={`Sync ${title}`} checked={enabled} disabled={disabled} onCheckedChange={onToggle} />
    </div>
  );
}

/**
 * Compact pill toggle backed by a real (visually hidden) checkbox so it stays
 * a `role="checkbox"` for assistive tech. Pills wrap horizontally, keeping
 * large project lists short instead of one row per project.
 */
function SourceCheckbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`inline-flex max-w-64 items-center gap-1 rounded-full border px-2.5 py-0.5 cursor-pointer text-ui-sm transition-colors has-disabled:opacity-50 has-disabled:cursor-not-allowed ${
        checked
          ? 'border-accent1 bg-accent1/10 text-icon6'
          : 'border-border1 text-icon4 hover:border-border2 hover:text-icon5'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onChange} />
      {checked && <span aria-hidden="true">✓</span>}
      <span className="truncate">{label}</span>
    </label>
  );
}

/**
 * Settings › General › Intake sources: choose which sources feed the Factory
 * Intake page. GitHub syncs selected connected repositories; Linear syncs
 * selected Linear projects (grouped by team). Nothing is synced until
 * something is picked. Every change persists immediately.
 */
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
  const linkedRepositories = (factoriesQuery.data ?? [])
    .filter(isServerFactory)
    .flatMap(factory => factory.binding.repositories);

  const heading = (
    <Txt variant="ui-lg" className="text-icon6 font-medium">
      Intake sources
    </Txt>
  );

  if (configQuery.isPending) {
    return (
      <div className="mt-6 pt-4">
        {heading}
        <SkeletonRows label="Loading intake sources" rows={4} />
      </div>
    );
  }
  if (configQuery.isError || !config) {
    return (
      <div className="mt-6 pt-4">
        {heading}
        <Txt as="p" variant="ui-sm" className="text-icon3 py-4">
          Intake configuration is unavailable. Connect GitHub or Linear first.
        </Txt>
      </div>
    );
  }

  const update = (next: IntakeConfig) => {
    saveMutation.mutate(next, {
      onSuccess: () => toast.success('Intake sources updated'),
      onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save intake sources'),
    });
  };
  const busy = saveMutation.isPending;

  return (
    <div className="mt-6 pt-4 flex flex-col gap-6">
      {heading}
      <section className="flex flex-col gap-2" aria-label="GitHub intake">
        <SourceHeader
          title="GitHub repositories"
          hint="Sync open issues from the selected connected repositories. Nothing syncs until you pick one."
          enabled={config.github.enabled}
          disabled={busy}
          onToggle={enabled => update({ ...config, github: { ...config.github, enabled } })}
        />
        {config.github.enabled && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {linkedRepositories.length === 0 ? (
              <Txt as="span" variant="ui-xs" className="text-icon3">
                No linked repositories yet — link a repository to a factory to add one.
              </Txt>
            ) : (
              linkedRepositories.map(repository => (
                <SourceCheckbox
                  key={repository.projectRepositoryId}
                  label={repository.slug}
                  checked={config.github.sourceIds?.includes(repository.slug) ?? false}
                  disabled={busy}
                  onChange={() =>
                    update({
                      ...config,
                      github: {
                        ...config.github,
                        sourceIds: toggleId(config.github.sourceIds, repository.slug),
                      },
                    })
                  }
                />
              ))
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2" aria-label="Linear intake">
        <SourceHeader
          title="Linear projects"
          hint="Sync active issues from the Linear projects picked per team. Nothing syncs until you pick one."
          enabled={config.linear.enabled}
          disabled={busy || !linearConnected}
          onToggle={enabled => update({ ...config, linear: { ...config.linear, enabled } })}
        />
        {!linearConnected ? (
          <div className="flex items-center gap-3 pl-1">
            <Txt as="span" variant="ui-xs" className="text-icon3">
              {linearStatus?.enabled === false
                ? 'Linear is not configured on this server.'
                : 'Connect a Linear workspace to sync its issues.'}
            </Txt>
            {linearStatus?.enabled !== false && (
              <Button size="xs" onClick={() => connectLinear(baseUrl)}>
                Connect Linear
              </Button>
            )}
          </div>
        ) : config.linear.enabled && isLinearReauthError(linearProjectsQuery.error) ? (
          // Connected on paper, but the token is expired/revoked: offer the
          // OAuth flow again instead of a silently empty project picker.
          <div className="flex items-center gap-3 pl-1">
            <Txt as="span" variant="ui-xs" className="text-icon3">
              Linear authorization expired. Reconnect to keep syncing issues.
            </Txt>
            <Button size="xs" onClick={() => connectLinear(baseUrl)}>
              Reconnect Linear
            </Button>
          </div>
        ) : (
          config.linear.enabled && (
            <div className="flex flex-col gap-2.5 pl-1">
              <div className="flex items-center gap-2">
                <Txt as="span" variant="ui-xs" className="text-icon3">
                  Connected to {linearStatus?.workspace?.name ?? 'a Linear workspace'}
                </Txt>
                <Button size="xs" variant="ghost" onClick={() => connectLinear(baseUrl)}>
                  Reconnect
                </Button>
              </div>
              {groupLinearProjectsByTeam(linearProjectsQuery.data ?? []).map(group => (
                <div key={group.id} className="flex flex-col gap-1" role="group" aria-label={group.label}>
                  <div className="flex items-baseline gap-2">
                    <Txt as="span" variant="ui-xs" className="font-medium uppercase tracking-wide text-icon3">
                      {group.label}
                    </Txt>
                    <SelectedCount ids={config.linear.sourceIds} projects={group.projects} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.projects.map(project => (
                      <SourceCheckbox
                        key={project.id}
                        label={project.name}
                        checked={config.linear.sourceIds?.includes(project.id) ?? false}
                        disabled={busy}
                        onChange={() =>
                          update({
                            ...config,
                            linear: { ...config.linear, sourceIds: toggleId(config.linear.sourceIds, project.id) },
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </div>
  );
}

/** Tiny "n selected" hint next to a team header; hidden when nothing is picked. */
function SelectedCount({ ids, projects }: { ids: string[] | null; projects: LinearProject[] }) {
  const count = projects.filter(p => ids?.includes(p.id)).length;
  if (!count) return null;
  return (
    <Txt as="span" variant="ui-xs" className="text-accent1">
      {count} selected
    </Txt>
  );
}

interface LinearTeamGroup {
  id: string;
  label: string;
  projects: LinearProject[];
}

/**
 * Group Linear projects under each team they belong to (shared projects appear
 * in every team), sorted by team key. Team-less projects land in a trailing
 * "No team" group.
 */
function groupLinearProjectsByTeam(projects: LinearProject[]): LinearTeamGroup[] {
  const byTeam = new Map<string, LinearTeamGroup>();
  const orphans: LinearProject[] = [];
  for (const project of projects) {
    if (project.teams.length === 0) {
      orphans.push(project);
      continue;
    }
    for (const team of project.teams) {
      const group = byTeam.get(team.id) ?? { id: team.id, label: `${team.key} · ${team.name}`, projects: [] };
      group.projects.push(project);
      byTeam.set(team.id, group);
    }
  }
  const groups = [...byTeam.values()].sort((a, b) => a.label.localeCompare(b.label));
  if (orphans.length) groups.push({ id: 'no-team', label: 'No team', projects: orphans });
  return groups;
}
