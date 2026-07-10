import { Button } from '@mastra/playground-ui/components/Button';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../../shared/api/config';
import { useToast } from '../../../ui';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../factory/hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../factory/hooks/useLinearData';
import { connectLinear } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useProjectsQuery } from '../../workspaces/hooks/useProjects';

/**
 * Toggle `id` in an explicit selection list. `null` means "default selection"
 * (GitHub: the active project; Linear: all projects) — the first explicit pick
 * starts from an empty list, and clearing the last pick returns to `null`.
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
    <label className="flex items-center gap-2 py-1 cursor-pointer text-ui-md text-neutral6 has-disabled:opacity-50 has-disabled:cursor-not-allowed">
      <input
        type="checkbox"
        className="size-3.5 accent-accent1"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="truncate">{label}</span>
    </label>
  );
}

/**
 * Settings › General › Intake sources: choose which sources feed the Factory
 * Intake page. GitHub syncs issues from the selected projects (default: the
 * active project); Linear syncs issues from the selected projects (default:
 * all projects). Every change persists immediately.
 */
export function IntakeSection() {
  const { baseUrl } = useApiConfig();
  const { toast } = useToast();
  const configQuery = useIntakeConfigQuery();
  const saveMutation = useSaveIntakeConfigMutation();
  const projectsQuery = useProjectsQuery();
  const linearStatusQuery = useLinearStatusQuery();

  const linearStatus = linearStatusQuery.data;
  const linearConnected = Boolean(linearStatus?.enabled && linearStatus.connected);
  const linearProjectsQuery = useLinearProjectsQuery(linearConnected);

  const config = configQuery.data;
  const githubProjects = (projectsQuery.data ?? []).filter(p => p.source === 'github' && p.githubProjectId);

  const heading = (
    <Txt variant="ui-lg" className="text-icon6 font-medium">
      Intake sources
    </Txt>
  );

  if (configQuery.isPending) {
    return (
      <div className="mt-6 pt-4 border-t border-border1/40">
        {heading}
        <SkeletonRows label="Loading intake sources" rows={4} />
      </div>
    );
  }
  if (configQuery.isError || !config) {
    return (
      <div className="mt-6 pt-4 border-t border-border1/40">
        {heading}
        <Txt as="p" variant="ui-sm" className="text-icon3 py-4">
          Intake configuration is unavailable. Connect GitHub or Linear first.
        </Txt>
      </div>
    );
  }

  const update = (next: IntakeConfig) => {
    saveMutation.mutate(next, {
      onSuccess: () => toast('Intake sources updated', 'success'),
      onError: err => toast(err instanceof Error ? err.message : 'Failed to save intake sources', 'error'),
    });
  };
  const busy = saveMutation.isPending;

  return (
    <div className="mt-6 pt-4 border-t border-border1/40 flex flex-col gap-6">
      {heading}
      <section className="flex flex-col gap-2" aria-label="GitHub intake">
        <SourceHeader
          title="GitHub"
          hint="Sync open issues from the selected projects. None selected — the active project."
          enabled={config.github.enabled}
          disabled={busy}
          onToggle={enabled => update({ ...config, github: { ...config.github, enabled } })}
        />
        {config.github.enabled && (
          <div className="flex flex-col pl-1">
            {githubProjects.length === 0 ? (
              <Txt as="span" variant="ui-xs" className="text-icon3">
                No GitHub projects yet — open a repo from GitHub to add one.
              </Txt>
            ) : (
              githubProjects.map(project => (
                <SourceCheckbox
                  key={project.githubProjectId}
                  label={project.name}
                  checked={config.github.projectIds?.includes(project.githubProjectId!) ?? false}
                  disabled={busy}
                  onChange={() =>
                    update({
                      ...config,
                      github: { ...config.github, projectIds: toggleId(config.github.projectIds, project.githubProjectId!) },
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
          title="Linear"
          hint="Sync active issues from the selected projects. None selected — all projects."
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
        ) : (
          config.linear.enabled && (
            <div className="flex flex-col pl-1">
              {(linearProjectsQuery.data ?? []).map(project => (
                <SourceCheckbox
                  key={project.id}
                  label={project.teamKeys.length ? `${project.name} (${project.teamKeys.join(', ')})` : project.name}
                  checked={config.linear.projectIds?.includes(project.id) ?? false}
                  disabled={busy}
                  onChange={() =>
                    update({
                      ...config,
                      linear: { ...config.linear, projectIds: toggleId(config.linear.projectIds, project.id) },
                    })
                  }
                />
              ))}
            </div>
          )
        )}
      </section>
    </div>
  );
}
