import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';

const UNROUTED = '__unrouted__';

/**
 * Routing for one provider's selected intake sources. A source feeds exactly
 * one Factory; until it is routed its issues are not picked up by any board.
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

  const route = (sourceId: string, value: string) => {
    saveBinding.mutate(
      { integrationId, sourceId, factoryProjectId: value === UNROUTED ? null : value },
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
        const boundFactoryId = bindings.find(
          binding => binding.integrationId === integrationId && binding.sourceId === sourceId,
        )?.factoryProjectId;
        const routedFactory = factories.find(candidate => candidate.id === boundFactoryId);
        return (
          <SettingsRow
            variant="factory"
            key={sourceId}
            label={name}
            description={routedFactory ? undefined : "Not routed — this project's issues won't be picked up."}
          >
            <Select
              value={routedFactory?.id ?? UNROUTED}
              disabled={busy || factories.length === 0}
              onValueChange={value => route(sourceId, value)}
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
          </SettingsRow>
        );
      })}
    </div>
  );
}
