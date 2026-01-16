'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { toast } from '@/lib/toast';

import { ScorerForm } from './scorer-form';
import type { ScorerFormValues } from './scorer-form-validation';
import { useStoredScorerMutations } from '../../hooks/use-stored-scorers';

export interface CreateScorerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (scorerId: string) => void;
}

export function CreateScorerDialog({ open, onOpenChange, onSuccess }: CreateScorerDialogProps) {
  const { createStoredScorer } = useStoredScorerMutations();

  const handleSubmit = async (values: ScorerFormValues) => {
    const scorerId = crypto.randomUUID();
    try {
      await createStoredScorer.mutateAsync({
        id: scorerId,
        name: values.name,
        description: values.description,
        model: values.model,
        prompt: values.prompt,
        scoreRange: values.scoreRange,
        metadata: values.metadata,
        // Convert null to undefined since the server schema expects string | undefined, not null
        ownerId: values.ownerId ?? undefined,
      });
      onOpenChange(false);
      onSuccess?.(scorerId);
    } catch (error) {
      toast.error(`Failed to create scorer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface1 border-border1 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Scorer</DialogTitle>
        </DialogHeader>
        <ScorerForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={createStoredScorer.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
