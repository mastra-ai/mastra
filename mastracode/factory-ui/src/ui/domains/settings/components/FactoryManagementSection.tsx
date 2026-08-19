import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Trash2 } from 'lucide-react';
import { useParams } from 'react-router';

import { useFactoryQuery, useRemoveFactoryMutation } from '../../../../hooks/useFactories';
import { SettingsCard, SettingsRow } from './SettingsCard';
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
    <SettingsSubsection title="Danger zone">
      <SettingsCard>
        <SettingsRow label={`Remove ${factory.name}`} hint="Also unlinks its repositories.">
          <AlertDialog>
            <AlertDialog.Trigger asChild>
              <Button
                size="xs"
                variant="outline"
                className="text-notice-destructive border-notice-destructive/25 hover:bg-notice-destructive/10 hover:text-notice-destructive"
                disabled={removeMutation.isPending}
                aria-label={`Remove ${factory.name}`}
              >
                <Trash2 size={14} />
                Remove
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Remove {factory.name}?</AlertDialog.Title>
                <AlertDialog.Description>
                  This deletes the Factory and unlinks its repositories. It cannot be undone.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action onClick={() => removeMutation.mutate(factory.id)}>Remove</AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog>
        </SettingsRow>
        {removeMutation.isError && (
          <div className="p-4">
            <Notice variant="destructive">
              {removeMutation.error instanceof Error ? removeMutation.error.message : 'Failed to remove factory'}
            </Notice>
          </div>
        )}
      </SettingsCard>
    </SettingsSubsection>
  );
}
