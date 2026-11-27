'use client';

import type { DatasetExperiment } from '@mastra/client-js';
import { useState } from 'react';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ds/components/Dialog';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Form } from '@/ds/components/Form';
import { Input } from '@/ds/components/Input';
import { toast } from '@/utils/toast';

export type RenameExperimentPatch = { name: string; description: string };

export interface RenameExperimentDialogProps {
  experiment: DatasetExperiment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Saves the trimmed name and description; a rejection keeps the dialog open. */
  onRename: (patch: RenameExperimentPatch) => Promise<void>;
}

/**
 * Edits an experiment's name and description. Mount it on demand (`{open && ...}`)
 * so the form state is seeded from the experiment each time it opens.
 */
export function RenameExperimentDialog({ experiment, open, onOpenChange, onRename }: RenameExperimentDialogProps) {
  const [name, setName] = useState(experiment.name ?? '');
  const [description, setDescription] = useState(experiment.description ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const canSave = Boolean(name.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || isSaving) return;

    setIsSaving(true);
    try {
      await onRename({ name: name.trim(), description: description.trim() });
      toast.success('Experiment renamed');
      onOpenChange(false);
    } catch (error) {
      toast.error(`Failed to rename experiment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={isSaving}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Experiment</DialogTitle>
        </DialogHeader>
        <Form onSubmit={handleSubmit}>
          <DialogBody>
            <Field>
              <FieldLabel required>Name</FieldLabel>
              <Input
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter experiment name"
                autoFocus
              />
            </Field>

            <Field>
              <FieldLabel>Description</FieldLabel>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Enter experiment description (optional)"
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction type="submit" disabled={!canSave}>
              Save
            </DialogAction>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
