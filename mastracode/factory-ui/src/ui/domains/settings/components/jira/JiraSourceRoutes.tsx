import { toast } from '@mastra/playground-ui/components/Toaster';
import { useState } from 'react';

import { useDeleteIntakeBindingMutation, useSaveIntakeBindingMutation } from '../../../../../hooks/useIntakeConfig';
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
  const save = useSaveIntakeBindingMutation();
  const remove = useDeleteIntakeBindingMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const saving = save.isPending || remove.isPending;
  const unbound = factories.filter(factory => !bindings.some(binding => binding.factoryProjectId === factory.id));
  const labelledWithBoard = bindings.filter(binding => binding.board !== null && !takesAllIssues(binding));

  const settle = (factoryProjectId: string, error?: unknown) =>
    setErrors(current => {
      const { [factoryProjectId]: _, ...rest } = current;
      if (error === undefined) return rest;
      return { ...rest, [factoryProjectId]: routingErrorMessage(error, factories) };
    });

  const route = (
    factoryProjectId: string,
    change: { board?: string | null; labels?: string[] | null },
    onSaved?: () => void,
  ) => {
    const current = bindings.find(binding => binding.factoryProjectId === factoryProjectId);
    save.mutate(
      { integrationId: 'jira', sourceId, factoryProjectId, board: current?.board ?? null, ...change },
      {
        onSuccess: () => {
          settle(factoryProjectId);
          toast.success('Jira routing updated');
          onSaved?.();
        },
        onError: error => settle(factoryProjectId, error),
      },
    );
  };

  const unroute = (factoryProjectId: string) =>
    remove.mutate(
      { integrationId: 'jira', sourceId, factoryProjectId },
      {
        onSuccess: () => {
          settle(factoryProjectId);
          toast.success('Jira routing updated');
        },
        onError: error => settle(factoryProjectId, error),
      },
    );

  return (
    <ul aria-label={`Factories for ${project}`} className="border-border mt-1 flex flex-col gap-2 border-l pl-3">
      {bindings.map(binding => (
        <JiraBindingRow
          key={binding.factoryProjectId}
          project={project}
          factory={factoryName(factories, binding.factoryProjectId)}
          binding={binding}
          othersTakeLabels={labelledWithBoard.some(other => other.factoryProjectId !== binding.factoryProjectId)}
          error={errors[binding.factoryProjectId]}
          saving={saving}
          onBoardChange={board => route(binding.factoryProjectId, { board })}
          onLabelsChange={labels => route(binding.factoryProjectId, { labels })}
          onTakeAllIssues={() => route(binding.factoryProjectId, { labels: null })}
          onRemove={() => unroute(binding.factoryProjectId)}
        />
      ))}
      {unbound.length > 0 && (
        <AddJiraFactory
          project={project}
          unbound={unbound}
          anotherTakesAll={bindings.some(takesAllIssues)}
          errors={errors}
          saving={saving}
          onAdd={({ factoryProjectId, board, labels }, onAdded) =>
            route(factoryProjectId, { board, labels: labels.length > 0 ? labels : null }, onAdded)
          }
        />
      )}
    </ul>
  );
}
