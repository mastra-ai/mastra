import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';
import { isLinearTeamSourceId, linearTeamSourceId } from '../../factory/services/linear';
import type { LinearProject, LinearTeam } from '../../factory/services/linear';

const UNROUTED = '__unrouted__';
const NO_BOARD = '__no_board__';

/**
 * Routing for one provider's selected intake sources. A source feeds exactly
 * one board of one Factory; until it is routed to both, its issues are not
 * picked up.
 */
export function IntakeSourceRouting({
  integrationId,
  label,
  sourceIds,
  sources,
  factories,
}: {
  integrationId: string;
  label: string;
  sourceIds: string[];
  sources: { id: string; name: string }[];
  factories: { id: string; name: string }[];
}) {
  const bindingsQuery = useIntakeBindingsQuery();
  const saveBinding = useSaveIntakeBindingMutation();
  const bindings = bindingsQuery.data ?? [];
  const busy = saveBinding.isPending;

  const route = (sourceId: string, factoryProjectId: string | null, board: string | null) => {
    saveBinding.mutate(
      { integrationId, sourceId, factoryProjectId, board },
      {
        onSuccess: () => toast.success(`${label} routing updated`),
        onError: err => toast.error(err instanceof Error ? err.message : `Failed to save ${label} routing`),
      },
    );
  };

  return (
    <div className="flex flex-col">
      {sourceIds.map(sourceId => {
        const name = sources.find(source => source.id === sourceId)?.name ?? sourceId;
        const binding = bindings.find(
          candidate => candidate.integrationId === integrationId && candidate.sourceId === sourceId,
        );

        const routedFactory = factories.find(candidate => candidate.id === binding?.factoryProjectId);
        const board = binding?.board ?? null;
        const description = !routedFactory
          ? "Not routed — this source's issues won't be picked up."
          : board === null
            ? "Choose a board — this source's issues won't be picked up until one is set."
            : undefined;
        return (
          <SettingsRow key={sourceId} label={name} description={description}>
            <div className="flex items-center gap-2">
              <Select
                value={routedFactory?.id ?? UNROUTED}
                disabled={busy || factories.length === 0}
                onValueChange={value => {
                  const next = value === UNROUTED ? null : value;
                  route(sourceId, next, next === routedFactory?.id ? board : null);
                }}
              >
                <SelectTrigger variant="outline" size="sm" aria-label={`Factory for ${name}`} className="w-auto">
                  <Txt as="span" variant="ui-sm">
                    {routedFactory?.name ?? 'Not routed'}
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
              {routedFactory && (
                <BoardPicker
                  name={name}
                  factoryProjectId={routedFactory.id}
                  board={board}
                  disabled={busy}
                  onChange={next => route(sourceId, routedFactory.id, next)}
                />
              )}
            </div>
          </SettingsRow>
        );
      })}
    </div>
  );
}

export function LinearRouting({
  sourceIds,
  projects,
  teams,
  factories,
}: {
  sourceIds: string[];
  projects: LinearProject[];
  teams: LinearTeam[];
  factories: { id: string; name: string }[];
}) {
  const teamBySourceId = new Map(teams.map(team => [linearTeamSourceId(team), team]));
  const labelFor = (sourceId: string): string => {
    if (isLinearTeamSourceId(sourceId)) {
      const team = teamBySourceId.get(sourceId);
      return team ? `All issues in ${team.name}` : sourceId;
    }
    return projects.find(project => project.id === sourceId)?.name ?? sourceId;
  };

  return (
    <IntakeSourceRouting
      integrationId="linear"
      label="Linear"
      sourceIds={sourceIds}
      sources={sourceIds.map(sourceId => ({ id: sourceId, name: labelFor(sourceId) }))}
      factories={factories}
    />
  );
}

function BoardPicker({
  name,
  factoryProjectId,
  board,
  disabled,
  onChange,
}: {
  name: string;
  factoryProjectId: string;
  board: string | null;
  disabled: boolean;
  onChange: (board: string | null) => void;
}) {
  const catalog = useBoardCatalog(factoryProjectId);

  const boards = (catalog.data ?? []).filter(candidate => candidate.id !== 'review');
  const current = boards.find(candidate => candidate.id === board);
  const label = current?.title ?? (board ? `${board} (not installed)` : 'Choose a board');
  return (
    <Select
      value={current?.id ?? NO_BOARD}
      disabled={disabled || catalog.isPending}
      onValueChange={value => onChange(value === NO_BOARD ? null : value)}
    >
      <SelectTrigger variant="outline" size="sm" aria-label={`Board for ${name}`} className="w-auto">
        <Txt as="span" variant="ui-sm">
          {label}
        </Txt>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_BOARD}>No board</SelectItem>
        {boards.map(candidate => (
          <SelectItem key={candidate.id} value={candidate.id}>
            {candidate.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
