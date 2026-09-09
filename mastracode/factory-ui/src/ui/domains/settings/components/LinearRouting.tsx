import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';
import type { LinearProject } from '../../factory/services/linear';

const UNROUTED = '__unrouted__';
const NO_BOARD = '__no_board__';

/**
 * Routing for the selected Linear projects. A Linear project feeds exactly one
 * board of one Factory; until both are chosen its issues are not picked up
 * anywhere. Nothing is routed implicitly.
 */
export function LinearRouting({
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

  const route = (sourceId: string, factoryProjectId: string | null, board: string | null) => {
    saveBinding.mutate(
      { integrationId: 'linear', sourceId, factoryProjectId, board },
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
        const binding = bindings.find(
          candidate => candidate.integrationId === 'linear' && candidate.sourceId === sourceId,
        );
        // A binding can outlive the factory it points at; such a project is unrouted again.
        const routedFactory = factories.find(candidate => candidate.id === binding?.factoryProjectId);
        const board = binding?.board ?? null;
        const description = !routedFactory
          ? "Not routed — this project's issues won't be picked up."
          : board === null
            ? "Choose a board — this project's issues won't be picked up until one is set."
            : undefined;
        return (
          <SettingsRow variant="factory" key={sourceId} label={name} description={description}>
            <div className="flex items-center gap-2">
              <Select
                value={routedFactory?.id ?? UNROUTED}
                disabled={busy || factories.length === 0}
                onValueChange={value => route(sourceId, value === UNROUTED ? null : value, board)}
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

/** Which installed board of the routed Factory the project's issues land on. */
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
  // Review takes pull requests, not issues.
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
