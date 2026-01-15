'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/ds/components/Dialog';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScorerForm } from '../create-scorer/scorer-form';
import { DeleteScorerConfirm } from './delete-scorer-confirm';
import { useStoredScorer, useStoredScorerMutations, useScorerVersions } from '../../hooks/use-stored-scorers';
import type { ScorerFormValues } from '../create-scorer/scorer-form-validation';

export interface EditScorerDialogProps {
  scorerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

export function EditScorerDialog({ scorerId, open, onOpenChange, onSuccess, onDelete }: EditScorerDialogProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { data: scorer, isLoading } = useStoredScorer(scorerId);
  const { data: versionsData } = useScorerVersions(scorerId, {
    perPage: 1,
    orderBy: 'versionNumber',
    orderDirection: 'DESC',
  });
  const { updateStoredScorer, deleteStoredScorer } = useStoredScorerMutations(scorerId);

  const handleSubmit = async (values: ScorerFormValues) => {
    await updateStoredScorer.mutateAsync({
      name: values.name,
      description: values.description,
      model: values.model,
      prompt: values.prompt,
      scoreRange: values.scoreRange,
      metadata: values.metadata,
      ownerId: values.ownerId,
    });
    onOpenChange(false);
    onSuccess?.();
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    await deleteStoredScorer.mutateAsync();
    setShowDeleteConfirm(false);
    onOpenChange(false);
    onDelete?.();
  };

  // Transform scorer data to form values format
  const initialValues: Partial<ScorerFormValues> | undefined = scorer
    ? {
        name: scorer.name,
        description: scorer.description,
        model: scorer.model,
        prompt: scorer.prompt,
        scoreRange: scorer.scoreRange,
        metadata: scorer.metadata,
        ownerId: scorer.ownerId,
      }
    : undefined;

  // Get version info for display
  const versionInfo =
    versionsData?.versions?.[0]?.versionNumber || scorer?.updatedAt
      ? {
          versionNumber: versionsData?.versions?.[0]?.versionNumber,
          updatedAt: scorer?.updatedAt ? new Date(scorer.updatedAt) : undefined,
        }
      : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-surface1 border-border1 sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Scorer</DialogTitle>
            <DialogDescription>Update your scorer configuration.</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-28" />
              </div>
            </div>
          ) : (
            <ScorerForm
              mode="edit"
              scorerId={scorerId}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onCancel={() => onOpenChange(false)}
              onDelete={handleDeleteClick}
              isSubmitting={updateStoredScorer.isPending}
              isDeleting={deleteStoredScorer.isPending}
              versionInfo={versionInfo}
            />
          )}
        </DialogContent>
      </Dialog>

      <DeleteScorerConfirm
        scorerName={scorer?.name || 'this scorer'}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteStoredScorer.isPending}
      />
    </>
  );
}
