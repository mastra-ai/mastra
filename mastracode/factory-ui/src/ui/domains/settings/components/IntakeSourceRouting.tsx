import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RotateCcw } from 'lucide-react';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';
import type { IntakeSourceBinding } from '../../factory/services/intake';
import { SourcePicker } from './IntakeSourcePicker';
import type { SourcePickerItem, SourcePickerProps } from './IntakeSourcePicker';

const UNROUTED = '__unrouted__';
const NO_BOARD = '__no_board__';

interface Factory {
  id: string;
  name: string;
}

export function RoutedSourcePicker({
  integrationId,
  routingLabel,
  factories,
  ...picker
}: SourcePickerProps & { integrationId: string; routingLabel: string; factories: Factory[] }) {
  const bindingsQuery = useIntakeBindingsQuery();
  const saveBinding = useSaveIntakeBindingMutation();
  const bindings = bindingsQuery.data;
  const bindingBySource = new Map(
    bindings?.filter(binding => binding.integrationId === integrationId).map(binding => [binding.sourceId, binding]),
  );

  const route = (sourceId: string, factoryProjectId: string | null, board: string | null) => {
    saveBinding.mutate(
      { integrationId, sourceId, factoryProjectId, board },
      {
        onSuccess: () => toast.success(`${routingLabel} routing updated`),
        onError: err => toast.error(err instanceof Error ? err.message : `Failed to save ${routingLabel} routing`),
      },
    );
  };

  return (
    <>
      <SourcePicker
        {...picker}
        itemDescription={sourceId => {
          if (!bindings) return undefined;
          const binding = bindingBySource.get(sourceId);
          if (!factories.some(factory => factory.id === binding?.factoryProjectId))
            return "Not routed — this source's issues won't be picked up.";
          if (binding?.board == null)
            return "Choose a board — this source's issues won't be picked up until one is set.";
          return undefined;
        }}
        itemActions={item =>
          bindings && (
            <SourceRoute
              item={item}
              binding={bindingBySource.get(item.id)}
              factories={factories}
              disabled={saveBinding.isPending}
              onRoute={(factoryProjectId, board) => route(item.id, factoryProjectId, board)}
            />
          )
        }
      />
      {bindingsQuery.isError && (
        <SettingsRow label="Routing is unavailable" description="Your source routes could not be loaded.">
          <Button size="sm" variant="ghost" icon={<RotateCcw />} onClick={() => void bindingsQuery.refetch()}>
            Retry
          </Button>
        </SettingsRow>
      )}
    </>
  );
}

function SourceRoute({
  item,
  binding,
  factories,
  disabled,
  onRoute,
}: {
  item: SourcePickerItem;
  binding: IntakeSourceBinding | undefined;
  factories: Factory[];
  disabled: boolean;
  onRoute: (factoryProjectId: string | null, board: string | null) => void;
}) {
  const routedFactory = factories.find(candidate => candidate.id === binding?.factoryProjectId);
  const board = binding?.board ?? null;
  return (
    <>
      <Select
        value={routedFactory?.id ?? UNROUTED}
        disabled={disabled || factories.length === 0}
        onValueChange={value => {
          const next = value === UNROUTED ? null : value;
          onRoute(next, next === routedFactory?.id ? board : null);
        }}
      >
        <SelectTrigger size="sm" aria-label={`Factory for ${item.label}`} className="w-auto">
          <Txt as="span" variant="caption">
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
          name={item.label}
          factoryProjectId={routedFactory.id}
          board={board}
          disabled={disabled}
          onChange={next => onRoute(routedFactory.id, next)}
        />
      )}
    </>
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
  const label = catalog.isError
    ? 'Boards unavailable'
    : (current?.title ?? (board ? `${board} (not installed)` : 'Choose a board'));
  return (
    <Select
      value={current?.id ?? NO_BOARD}
      disabled={disabled || catalog.isPending || catalog.isError}
      onValueChange={value => onChange(value === NO_BOARD ? null : value)}
    >
      <SelectTrigger size="sm" aria-label={`Board for ${name}`} className="w-auto">
        <Txt as="span" variant="caption">
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
