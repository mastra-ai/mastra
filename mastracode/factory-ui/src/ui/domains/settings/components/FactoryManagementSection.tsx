import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router';

import { useFactoryQuery, useRemoveFactoryMutation } from '../../../../hooks/useFactories';
import { SettingsSubsection } from './SettingsSubsection';

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
      <SettingsSubsection title="Danger zone" description="Removing a Factory cannot be undone.">
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
      </SettingsSubsection>
    </div>
  );
}
