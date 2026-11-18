import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { useParams } from 'react-router';

import { useDeleteFactoryMutation, useFactoryQuery } from '../../../../hooks/useFactories';
import { SettingsContainer, SettingsNoticeRow, SettingsRow } from '@mastra/playground-ui/new/settings';

import { EnvironmentSection } from './EnvironmentSection';
import { SettingsSubsection } from './SettingsSubsection';
import { TrashIcon } from '@mastra/playground-ui/icons/TrashIcon';

export function FactoryManagementSection() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const factory = factoryQuery.data;
  const deleteMutation = useDeleteFactoryMutation();

  if (!factoryId || (factoryQuery.isSuccess && !factory)) {
    return <Notice variant="info">Select a factory to manage its settings.</Notice>;
  }
  if (factoryQuery.isError && !factory) {
    return <Notice variant="destructive">{factoryQuery.error.message}</Notice>;
  }

  return (
    <>
      <EnvironmentSection factoryId={factoryId} />
      <SettingsSubsection scope="factory" title="Danger zone">
        <SettingsContainer>
          <SettingsRow
            label={
              <>
                Delete{' '}
                {factory ? (
                  factory.name
                ) : (
                  <span role="status" aria-label="Loading Factory settings" className="inline-block align-middle">
                    <SkeletonText line="text-label" className="w-24 motion-reduce:before:animate-none" />
                  </span>
                )}
              </>
            }
            description="Also unlinks its repositories."
          >
            <AlertDialog>
              <AlertDialog.Trigger
                render={
                  <Button
                    size="sm"
                    variant="destructive-ghost"
                    disabled={deleteMutation.isPending}
                    inert={!factory}
                    aria-label={factory && `Delete ${factory.name}`}
                  >
                    <TrashIcon />
                    Delete
                  </Button>
                }
              />
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>Delete {factory?.name}?</AlertDialog.Title>
                  <AlertDialog.Description>
                    This deletes the Factory and unlinks its repositories. It cannot be undone.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                <AlertDialog.Footer>
                  <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                  <AlertDialog.Action onClick={() => deleteMutation.mutate(factoryId)}>Delete</AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </AlertDialog>
          </SettingsRow>
          {deleteMutation.isError && (
            <SettingsNoticeRow>
              <Notice variant="destructive">
                {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete Factory'}
              </Notice>
            </SettingsNoticeRow>
          )}
        </SettingsContainer>
      </SettingsSubsection>
    </>
  );
}
