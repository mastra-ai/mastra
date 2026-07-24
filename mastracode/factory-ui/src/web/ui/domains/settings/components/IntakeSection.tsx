import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { DataList } from '@mastra/playground-ui/components/DataList';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Switch } from '@mastra/playground-ui/components/Switch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../../shared/api/config';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { useIntakeConfigQuery, useSaveIntakeConfigMutation } from '../../../../../shared/hooks/useIntakeConfig';
import { useLinearProjectsQuery, useLinearStatusQuery } from '../../../../../shared/hooks/useLinearData';
import { connectLinear, isLinearReauthError } from '../../factory/services/linear';
import type { LinearProject } from '../../factory/services/linear';
import type { IntakeConfig } from '../../factory/services/intake';
import { useFactoriesQuery } from '../../../../../shared/hooks/useFactories';

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

interface SourcePickerItem {
  id: string;
  label: string;
}

/**
 * Card container for a stack of picker sections: one shared border, dividers
 * between sections, and rounding only on the group's outer edges.
 */
function SourcePickerGroup({ children }: { children: ReactNode }) {
  return <div className="border-border1 divide-border1 divide-y overflow-hidden rounded-lg border">{children}</div>;
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
    // Border/rounding live on the parent SourcePickerGroup so stacked cards
    // share dividers and only the group's first/last edges are rounded.
    <div role="group" aria-label={label}>
      <Collapsible
        open={open}
        onOpenChange={next => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <CollapsibleTrigger className="text-icon4 flex w-full items-center gap-1.5 px-3 py-2">
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
        <CollapsibleContent className="flex flex-col gap-2 px-3 pb-3">
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
  const linkedRepositories = (factoriesQuery.data ?? []).flatMap(factory => factory.repositories);

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
    <div className="mt-6 flex flex-col gap-6 pt-4">
      {heading}
      <section className="flex flex-col gap-2" aria-label="GitHub intake">
        <SourceHeader
          title="GitHub repositories"
          hint="Sync open issues from the selected connected repositories. Nothing syncs until you pick one."
          enabled={config.github.enabled}
          disabled={busy}
          onToggle={enabled => update({ ...config, github: { ...config.github, enabled } })}
        />
        {config.github.enabled &&
          (linkedRepositories.length === 0 ? (
            <Txt as="span" variant="ui-xs" className="text-icon3">
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
          ))}
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
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <Txt as="span" variant="ui-xs" className="text-icon3">
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
            </div>
          )
        )}
      </section>
    </div>
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
