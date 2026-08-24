import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import {
  useIntakeBindingsQuery,
  useIntakeConfigQuery,
  useSaveIntakeBindingMutation,
  useSaveIntakeConfigMutation,
} from '../../../../hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../hooks/useLinearData';
import { connectLinear, isLinearReauthError } from '../../factory/services/linear';
import type { LinearProject } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useFactoriesQuery } from '../../../../hooks/useFactories';
import { SettingsCard, SettingsRow } from './SettingsCard';
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

interface SourcePickerItem {
  id: string;
  label: string;
}

function SourcePickerGroup({ children }: { children: ReactNode }) {
  return <div className="divide-border1 divide-y">{children}</div>;
}

/**
 * Collapsible picker for one source section (a Linear team or the GitHub
 * repository list). Collapsed by default with a "n selected" hint; expanded it
 * shows a client-side search bar scoped to this section plus a checkbox row
 * per item. Collapsing resets the search (the panel unmounts, so the input
 * remounts empty on reopen).
 */
function SourcePickerSection({
  label,
  items,
  selectedIds,
  disabled,
  pending,
  onToggleItem,
}: {
  label: string;
  items: SourcePickerItem[];
  selectedIds: string[] | null;
  disabled: boolean;
  /** True while the selection save is in flight — shows the section spinner. */
  pending: boolean;
  onToggleItem: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedCount = items.filter(item => selectedIds?.includes(item.id)).length;
  const normalizedQuery = query.trim().toLowerCase();
  const visibleItems = items.filter(item => item.label.toLowerCase().includes(normalizedQuery));

  const toggle = (id: string) => {
    if (disabled) return;
    onToggleItem(id);
  };

  return (
    <div role="group" aria-label={label}>
      <Collapsible
        open={open}
        onOpenChange={next => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <CollapsibleTrigger className="text-icon4 flex w-full items-center gap-1.5 py-2">
          <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          <Txt as="span" variant="ui-sm">
            {label}
          </Txt>
          {selectedCount > 0 && (
            <Txt as="span" variant="ui-xs" className="text-accent1">
              {selectedCount} selected
            </Txt>
          )}
          {pending && (
            // Wrapped in a span so the trigger's `[&>svg]` chevron-rotation
            // rules don't apply to the spinner svg.
            <span className="ml-auto flex shrink-0">
              <Spinner size="sm" aria-label={`Saving ${label} selection`} />
            </span>
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 pb-3">
          <ListSearch label={`Search ${label}`} placeholder="Search…" size="sm" value={query} onSearch={setQuery} />
          <DataList columns="auto minmax(0,1fr)" variant="lined" className="max-h-64">
            {visibleItems.length === 0 ? (
              <DataList.NoMatch message="No matches" />
            ) : (
              visibleItems.map(item => (
                <DataList.RowWrapper key={item.id}>
                  <DataList.SelectCell
                    checked={selectedIds?.includes(item.id) ?? false}
                    onToggle={() => toggle(item.id)}
                    disabled={disabled}
                    aria-label={item.label}
                  />
                  <DataList.RowButton
                    flushLeft
                    colStart={2}
                    disabled={disabled}
                    onClick={() => toggle(item.id)}
                    // The whole row is one action here, so drop the button's own
                    // hover/focus fill and let the root's uniform `.data-list-row`
                    // hover overlay be the only highlight (no stacked fills).
                    className="hover:bg-transparent focus-visible:bg-transparent"
                  >
                    <DataList.NameCell>{item.label}</DataList.NameCell>
                  </DataList.RowButton>
                </DataList.RowWrapper>
              ))
            )}
          </DataList>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

const UNROUTED = '__unrouted__';

/**
 * Routing for the selected Linear projects. A Linear project feeds exactly one
 * Factory; until it is routed its issues are not picked up by any board.
 */
function LinearRouting({
  sourceIds,
  projects,
  factories,
}: {
  sourceIds: string[];
  projects: LinearProject[];
  factories: { id: string; name: string }[];
}) {
  const bindingsQuery = useIntakeBindingsQuery();
  const saveBinding = useSaveIntakeBindingMutation();
  const bindings = bindingsQuery.data ?? [];
  const busy = saveBinding.isPending;

  const route = (sourceId: string, value: string) => {
    saveBinding.mutate(
      { integrationId: 'linear', sourceId, factoryProjectId: value === UNROUTED ? null : value },
      {
        onSuccess: () => toast.success('Linear routing updated'),
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to save Linear routing'),
      },
    );
  };

  return (
    <div className="flex flex-col">
      {sourceIds.map(sourceId => {
        const name = projects.find(project => project.id === sourceId)?.name ?? sourceId;
        const factoryProjectId = bindings.find(
          binding => binding.integrationId === 'linear' && binding.sourceId === sourceId,
        )?.factoryProjectId;
        return (
          <SettingsRow
            key={sourceId}
            label={name}
            hint={factoryProjectId ? undefined : "Not routed — this project's issues won't be picked up."}
          >
            <Select
              value={factoryProjectId ?? UNROUTED}
              disabled={busy || factories.length === 0}
              onValueChange={value => route(sourceId, value)}
            >
              <SelectTrigger variant="outline" size="sm" aria-label={`Factory for ${name}`} className="w-auto">
                <Txt as="span" variant="ui-sm">
                  {factories.find(factory => factory.id === factoryProjectId)?.name ?? 'Not routed'}
                </Txt>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNROUTED}>Not routed</SelectItem>
                {factories.map(factory => (
                  <SelectItem key={factory.id} value={factory.id}>
                    {factory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        );
      })}
    </div>
  );
}

const INTAKE_INTRO =
  'Which sources feed issues into Intake, for your whole account. Code access is set under Repositories.';

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
  const linkedRepositories = (factoriesQuery.data ?? []).flatMap(factory => factory.repositories);

  if (configQuery.isPending) {
    return (
      <SettingsSubsection title="Issue sources" description={INTAKE_INTRO}>
        <SkeletonRows label="Loading intake sources" rows={4} />
      </SettingsSubsection>
    );
  }
  if (configQuery.isError || !config) {
    return (
      <SettingsSubsection title="Issue sources" description={INTAKE_INTRO}>
        <Txt as="p" variant="ui-sm" className="text-icon3">
          Intake configuration is unavailable. Connect GitHub or Linear first.
        </Txt>
      </SettingsSubsection>
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
    <SettingsSubsection title="Issue sources" description={INTAKE_INTRO}>
      <SettingsCard>
        <SettingsRow
          label="GitHub issues"
          hint="Open issues from the selected repositories. Pull requests always appear in Review."
        >
          <Switch
            aria-label="Sync GitHub issues"
            checked={config.github.enabled}
            disabled={busy}
            onCheckedChange={enabled => update({ ...config, github: { ...config.github, enabled } })}
          />
        </SettingsRow>

        {config.github.enabled && (
          <div className="px-4">
            {linkedRepositories.length === 0 ? (
              <Txt as="p" variant="ui-sm" className="text-icon3 py-3">
                No linked repositories yet — link a repository to a factory to add one.
              </Txt>
            ) : (
              <SourcePickerGroup>
                <SourcePickerSection
                  label="Repositories"
                  items={linkedRepositories.map(repository => ({ id: repository.slug, label: repository.slug }))}
                  selectedIds={config.github.sourceIds}
                  disabled={busy}
                  pending={busy}
                  onToggleItem={slug =>
                    update({
                      ...config,
                      github: {
                        ...config.github,
                        sourceIds: toggleId(config.github.sourceIds, slug),
                      },
                    })
                  }
                />
              </SourcePickerGroup>
            )}
          </div>
        )}

        <SettingsRow label="Linear issues" hint="Active issues from the selected projects.">
          <Switch
            aria-label="Sync Linear issues"
            checked={config.linear.enabled}
            disabled={busy || !linearConnected}
            onCheckedChange={enabled => update({ ...config, linear: { ...config.linear, enabled } })}
          />
        </SettingsRow>

        {!linearConnected ? (
          <div className="flex flex-col items-start gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-3">
            <Txt as="span" variant="ui-sm" className="text-icon3">
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
          // Expired token still reports connected; offer OAuth again.
          <div className="flex flex-col items-start gap-2 px-4 py-3 lg:flex-row lg:items-center lg:gap-3">
            <Txt as="span" variant="ui-sm" className="text-icon3">
              Linear authorization expired. Reconnect to keep syncing issues.
            </Txt>
            <Button size="xs" onClick={() => connectLinear(baseUrl)}>
              Reconnect Linear
            </Button>
          </div>
        ) : (
          config.linear.enabled && (
            <div className="flex flex-col gap-2.5 px-4 py-3">
              <div className="flex items-center gap-2">
                <Txt as="span" variant="ui-sm" className="text-icon3">
                  Connected to {linearStatus?.workspace?.name ?? 'a Linear workspace'}
                </Txt>
                <Button size="xs" variant="ghost" onClick={() => connectLinear(baseUrl)}>
                  Reconnect
                </Button>
              </div>
              {(linearProjectsQuery.data ?? []).length > 0 && (
                <SourcePickerGroup>
                  {groupLinearProjectsByTeam(linearProjectsQuery.data ?? []).map(group => (
                    <SourcePickerSection
                      key={group.id}
                      label={group.label}
                      items={group.projects.map(project => ({ id: project.id, label: project.name }))}
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
                  ))}
                </SourcePickerGroup>
              )}
              {(config.linear.sourceIds?.length ?? 0) > 0 && (
                <LinearRouting
                  sourceIds={config.linear.sourceIds ?? []}
                  projects={linearProjectsQuery.data ?? []}
                  factories={factoriesQuery.data ?? []}
                />
              )}
            </div>
          )
        )}
      </SettingsCard>
    </SettingsSubsection>
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
