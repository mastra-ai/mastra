'use client';

import { useState } from 'react';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { Button } from '@/ds/components/Button';
import { TrashIcon } from '@/ds/icons/TrashIcon';
import { toast } from '@/utils/toast';

export interface DeleteExperimentsButtonProps {
  experimentIds: string[];
  /** Deletes one experiment; called once per selected id. */
  onDeleteExperiment: (experimentId: string) => Promise<void>;
  onDeleted: () => void;
}

const pluralize = (count: number) => `${count} experiment${count === 1 ? '' : 's'}`;

/** Deletes every given experiment after confirmation. On a partial failure the dialog stays open for a retry. */
export function DeleteExperimentsButton({
  experimentIds,
  onDeleteExperiment,
  onDeleted,
}: DeleteExperimentsButtonProps) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const count = experimentIds.length;

  const handleDelete = async () => {
    setIsDeleting(true);
    const outcomes = await Promise.allSettled(experimentIds.map(id => onDeleteExperiment(id)));
    setIsDeleting(false);

    const failed = outcomes.filter(outcome => outcome.status === 'rejected').length;
    if (failed > 0) {
      toast.error(`Failed to delete ${failed} of ${pluralize(count)}`);
      return;
    }
    toast.success(`Deleted ${pluralize(count)}`);
    setOpen(false);
    onDeleted();
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive-ghost"
        disabled={count === 0}
        icon={<TrashIcon />}
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete {pluralize(count)}</AlertDialog.Title>
            <AlertDialog.Description>
              {count === 1 ? 'Its' : 'Their'} results and traces will be deleted too. This can't be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <Button icon={<TrashIcon />} variant="destructive" onClick={handleDelete} loading={isDeleting}>
              {count === 1 ? 'Delete experiment' : 'Delete experiments'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
