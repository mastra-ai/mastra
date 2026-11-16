import { Button } from '@mastra/playground-ui/components/Button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/new/settings';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';
import type { IntakeSourceBinding } from '../../factory/services/intake';
import { SourcePicker, sourcePickerItemText } from './IntakeSourcePicker';
import type { SourcePickerItem, SourcePickerProps } from './IntakeSourcePicker';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';

const UNROUTED = '__unrouted__';

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
  const saveBinding = useSaveIntakeBindingMutation({
    onSaved: () => toast.success(`${routingLabel} routing updated`, { id: `${integrationId}-routing-saved` }),
    onFailed: error => toast.error(error.message, { id: `${integrationId}-routing-failed` }),
  });
  const bindings = bindingsQuery.data;
  const bindingBySource = new Map(
    bindings?.filter(binding => binding.integrationId === integrationId).map(binding => [binding.sourceId, binding]),
  );

  return (
    <>
      <SourcePicker
        {...picker}
        itemDescription={sourceId => {
          if (!bindings) return undefined;
          const binding = bindingBySource.get(sourceId);
          if (!factories.some(factory => factory.id === binding?.factoryProjectId))
            return "Not routed. This source's issues won't be picked up.";
          return undefined;
        }}
        itemActions={item =>
          bindings && (
            <SourceRoute
              item={item}
              binding={bindingBySource.get(item.id)}
              factories={factories}
              onRoute={factoryProjectId => saveBinding.mutate({ integrationId, sourceId: item.id, factoryProjectId })}
            />
          )
        }
      />
      {bindingsQuery.isError && (
        <SettingsRow label="Routing is unavailable" description="Your source routes could not be loaded.">
          <Button
            size="sm"
            variant="ghost"
            icon={<IconArrowRotateCounterClockwise />}
            onClick={() => void bindingsQuery.refetch()}
          >
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
  onRoute,
}: {
  item: SourcePickerItem;
  binding: IntakeSourceBinding | undefined;
  factories: Factory[];
  onRoute: (factoryProjectId: string | null) => void;
}) {
  const routedFactory = factories.find(candidate => candidate.id === binding?.factoryProjectId);
  return (
    <Select
      value={routedFactory?.id ?? UNROUTED}
      disabled={factories.length === 0}
      onValueChange={value => onRoute(value === UNROUTED ? null : value)}
    >
      <SelectTrigger
        size="sm"
        aria-label={`Factory for ${sourcePickerItemText(item)}`}
        className="w-auto max-w-full min-w-0"
      >
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
  );
}
