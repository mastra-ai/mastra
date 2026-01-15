'use client';

import { useState } from 'react';
import { useScorerVersionMutations } from '../../hooks/use-stored-scorers';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { Label } from '@/ds/components/Label';
import { toast } from '@/lib/toast';

interface SaveScorerVersionDialogProps {
  scorerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveScorerVersionDialog({ scorerId, open, onOpenChange }: SaveScorerVersionDialogProps) {
  const [name, setName] = useState('');
  const [changeMessage, setChangeMessage] = useState('');

  const { createScorerVersion } = useScorerVersionMutations(scorerId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createScorerVersion.mutateAsync({
        name: name.trim() || undefined,
        changeMessage: changeMessage.trim() || undefined,
      });
      setName('');
      setChangeMessage('');
      onOpenChange(false);
      toast.success('Version saved successfully');
    } catch (error) {
      toast.error(`Failed to save version: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleClose = () => {
    if (!createScorerVersion.isPending) {
      setName('');
      setChangeMessage('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Version</DialogTitle>
          <DialogDescription>Create a snapshot of the current scorer configuration.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="version-name" className="text-icon5">
              Version Name (optional)
            </Label>
            <input
              id="version-name"
              type="text"
              placeholder="e.g., Production v1, Experiment with scoring"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              className="flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors border-sm border-border1 placeholder:text-icon3 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="change-message" className="text-icon5">
              Description (optional)
            </Label>
            <textarea
              id="change-message"
              placeholder="What changed in this version?"
              value={changeMessage}
              onChange={e => setChangeMessage(e.target.value)}
              maxLength={500}
              rows={3}
              className="flex w-full text-icon6 rounded-lg border bg-transparent shadow-sm transition-colors border-sm border-border1 placeholder:text-icon3 px-3 py-2 text-sm resize-y min-h-20 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={createScorerVersion.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createScorerVersion.isPending}>
              {createScorerVersion.isPending ? 'Saving...' : 'Save Version'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
