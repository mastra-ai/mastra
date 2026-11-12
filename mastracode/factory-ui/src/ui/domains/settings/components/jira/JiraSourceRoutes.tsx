import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import {
  useAddIntakeBindingMutation,
  useDeleteIntakeBindingMutation,
  useSaveIntakeBindingMutation,
} from '../../../../../hooks/useIntakeConfig';
import type { IntakeSourceBinding } from '../../../factory/services/intake';
import { AddJiraFactory } from './AddJiraFactory';
import { JiraBindingRow } from './JiraBindingRow';
import { factoryName, routingErrorMessage, takesAllIssues } from './routing';
import type { Factory } from './routing';

/** The factories one Jira project feeds, each taking all its issues or only labelled ones. */
export function JiraSourceRoutes({
  sourceId,
  project,
  bindings,
  factories,
}: {
  sourceId: string;
  project: string;
  bindings: IntakeSourceBinding[];
  factories: Factory[];
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const unbound = factories.filter(factory => !bindings.some(binding => binding.factoryProjectId === factory.id));
  const labelled = bindings.filter(binding => !takesAllIssues(binding));

  const settle = (factoryProjectId: string | null, error?: unknown) =>
    setErrors(current => {
      if (factoryProjectId === null) return current;
      const { [factoryProjectId]: _, ...rest } = current;
      if (error === undefined) return rest;
      return { ...rest, [factoryProjectId]: routingErrorMessage(error, factories) };
    });
  const onSaved = ({ factoryProjectId }: { factoryProjectId: string | null }) => {
    settle(factoryProjectId);
    toast.success('Jira routing updated', { id: 'jira-routing-saved' });
  };
  const onFailed = (error: Error, { factoryProjectId }: { factoryProjectId: string | null }) =>
    settle(factoryProjectId, error);
  const save = useSaveIntakeBindingMutation({ onSaved, onFailed });
  const remove = useDeleteIntakeBindingMutation({ onSaved, onFailed });
  const add = useAddIntakeBindingMutation({ onSaved, onFailed });

  const route = (factoryProjectId: string, labels: string[] | null) =>
    save.mutate({ integrationId: 'jira', sourceId, factoryProjectId, labels });

  const unroute = (factoryProjectId: string) => remove.mutate({ integrationId: 'jira', sourceId, factoryProjectId });

  return (
    <ul aria-label={`Factories for ${project}`} className="border-border mt-1 flex flex-col gap-2 border-l pl-3">
      {bindings.map(binding => (
        <JiraBindingRow
          key={binding.factoryProjectId}
          project={project}
          factory={factoryName(factories, binding.factoryProjectId)}
          binding={binding}
          othersTakeLabels={labelled.some(other => other.factoryProjectId !== binding.factoryProjectId)}
          error={errors[binding.factoryProjectId]}
          onLabelsChange={labels => route(binding.factoryProjectId, labels)}
          onTakeAllIssues={() => route(binding.factoryProjectId, null)}
          onRemove={() => unroute(binding.factoryProjectId)}
        />
      ))}
      {unbound.length > 0 && (
        <AddJiraFactory
          project={project}
          unbound={unbound}
          anotherTakesAll={bindings.some(takesAllIssues)}
          errors={errors}
          adding={add.isPending}
          onAdd={({ factoryProjectId, labels }, onAdded) =>
            add.mutate(
              { integrationId: 'jira', sourceId, factoryProjectId, labels: labels.length > 0 ? labels : null },
              { onSuccess: onAdded },
            )
          }
        />
      )}
    </ul>
  );
}
