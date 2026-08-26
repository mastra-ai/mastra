import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router';

import { useDeleteFactoryMutation, useFactoryQuery } from '../../../../hooks/useFactories';
import { SettingsRow } from '@mastra/playground-ui/components/SettingsRow';
import { SettingsCard } from './SettingsCard';
import { SettingsSubsection } from './SettingsSubsection';

export function FactoryManagementSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const factory = factoryQuery.data;
  const deleteMutation = useDeleteFactoryMutation();

  if (!factory) {
    return <Notice variant="info">Select a factory to manage its settings.</Notice>;
  }

  return (
    <SettingsSubsection title="Danger zone">
      <SettingsCard>
        <SettingsRow variant="factory" label={`Delete ${factory.name}`} description="Also unlinks its repositories.">
          <AlertDialog>
            <AlertDialog.Trigger asChild>
              <Button
                size="xs"
                variant="outline"
                className="text-notice-destructive border-notice-destructive/25 hover:bg-notice-destructive/10 hover:text-notice-destructive"
                disabled={deleteMutation.isPending}
                aria-label={`Delete ${factory.name}`}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Delete {factory.name}?</AlertDialog.Title>
                <AlertDialog.Description>
                  This deletes the Factory and unlinks its repositories. It cannot be undone.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action onClick={() => deleteMutation.mutate(factory.id)}>Delete</AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog>
        </SettingsRow>
        {deleteMutation.isError && (
          <div className="p-4">
            <Notice variant="destructive">
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete Factory'}
            </Notice>
          </div>
        )}
      </SettingsCard>
    </SettingsSubsection>
  );
}
