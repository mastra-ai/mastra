import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { useParams } from 'react-router';

import { useDeleteFactoryMutation, useFactoryQuery } from '../../../../hooks/useFactories';
import { SettingsContainer, SettingsNoticeRow, SettingsRow } from '@mastra/playground-ui/new/settings';
import type { ReactNode } from 'react';

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
  if (!factory) {
    return (
      <>
        <EnvironmentSection factoryId={factoryId} />
        <DangerZone
          name={
            <span role="status" aria-label="Loading Factory settings" className="inline-block align-middle">
              <SkeletonText line="text-label" className="w-24 motion-reduce:before:animate-none" />
            </span>
          }
          action={deleteButton({ inert: true })}
        />
      </>
    );
  }

  return (
    <>
      <EnvironmentSection factoryId={factory.id} />
      <DangerZone
        name={factory.name}
        action={
          <AlertDialog>
            <AlertDialog.Trigger
              render={deleteButton({ disabled: deleteMutation.isPending, label: `Delete ${factory.name}` })}
            />
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
        }
      >
        {deleteMutation.isError && (
          <SettingsNoticeRow>
            <Notice variant="destructive">
              {deleteMutation.error instanceof Error ? deleteMutation.error.message : 'Failed to delete Factory'}
            </Notice>
          </SettingsNoticeRow>
        )}
      </DangerZone>
    </>
  );
}

function DangerZone({ name, action, children }: { name: ReactNode; action: ReactNode; children?: ReactNode }) {
  return (
    <SettingsSubsection scope="factory" title="Danger zone">
      <SettingsContainer>
        <SettingsRow label={<>Delete {name}</>} description="Also unlinks its repositories.">
          {action}
        </SettingsRow>
        {children}
      </SettingsContainer>
    </SettingsSubsection>
  );
}

function deleteButton({
  disabled = false,
  inert = false,
  label,
}: {
  disabled?: boolean;
  inert?: boolean;
  label?: string;
}) {
  return (
    <Button size="sm" variant="destructive-ghost" disabled={disabled} inert={inert} aria-label={label}>
      <TrashIcon />
      Delete
    </Button>
  );
}
