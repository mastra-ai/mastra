import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router';

import { useFactoryQuery, useRemoveFactoryMutation } from '../../../../hooks/useFactories';

export function FactoryManagementSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const factory = factoryQuery.data;
  const removeMutation = useRemoveFactoryMutation();

  if (!factory) {
    return <Notice variant="info">Select a factory to manage its settings.</Notice>;
  }

  return (
    <div className="flex flex-col gap-8">
      <Txt as="p" variant="ui-sm" className="text-icon3">
        Settings on this page apply to {factory.name}.
      </Txt>

      <section aria-labelledby="factory-danger-zone" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Txt id="factory-danger-zone" variant="ui-lg" className="text-icon6 font-medium">
            Danger zone
          </Txt>
          <Txt as="p" variant="ui-sm" className="text-icon3">
            Removing a Factory cannot be undone.
          </Txt>
        </div>
        <div className="border-border1 flex items-center justify-between gap-4 border-y py-4">
          <div className="flex min-w-0 flex-col">
            <Txt variant="ui-md" className="truncate font-medium">
              Remove {factory.name}
            </Txt>
            <Txt variant="ui-xs">Deletes this Factory from the organization, including its repository links.</Txt>
          </div>
          <Button
            size="xs"
            variant="ghost"
            disabled={removeMutation.isPending}
            aria-label={`Remove ${factory.name}`}
            onClick={() => removeMutation.mutate(factory.id)}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        </div>
        {removeMutation.isError && (
          <Notice variant="destructive">
            {removeMutation.error instanceof Error ? removeMutation.error.message : 'Failed to remove factory'}
          </Notice>
        )}
      </section>
    </div>
  );
}
