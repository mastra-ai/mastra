import { Select, SelectContent, SelectItem, SelectTrigger } from '@mastra/playground-ui/components/Select';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useIntakeBindingsQuery, useSaveIntakeBindingMutation } from '../../../../hooks/useIntakeConfig';
import type { LinearProject } from '../../factory/services/linear';

const UNROUTED = '__unrouted__';

/**
 * Routing for the selected Linear projects. A Linear project feeds exactly one
 * Factory; until it is routed its issues are not picked up by any board.
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
        const boundFactoryId = bindings.find(
          binding => binding.integrationId === 'linear' && binding.sourceId === sourceId,
        )?.factoryProjectId;
        // A binding can outlive the factory it points at; such a project is unrouted again.
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
