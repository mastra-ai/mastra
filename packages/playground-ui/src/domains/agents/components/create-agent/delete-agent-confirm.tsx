'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/ds/components/Dialog';
import { Button } from '@/ds/components/Button';
import { toast } from '@/lib/toast';
import { AlertTriangle } from 'lucide-react';
import { useStoredAgentMutations } from '../../hooks/use-stored-agents';

export interface DeleteAgentConfirmProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function DeleteAgentConfirm({
  agentId,
  agentName,
  open,
  onOpenChange,
  onSuccess,
}: DeleteAgentConfirmProps) {
  const { deleteStoredAgent } = useStoredAgentMutations(agentId);

  const handleDelete = async () => {
    try {
      await deleteStoredAgent.mutateAsync();
      toast.success(`Agent "${agentName}" deleted successfully`);
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(`Failed to delete agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Agent</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium">"{agentName}"</span>?
          </p>

          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm text-destructive">
              <p className="font-medium">This action cannot be undone.</p>
              <p className="mt-1 text-xs">
                This will permanently delete the agent and all of its version history. Any workflows
                or configurations using this agent will need to be updated.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={handleCancel} disabled={deleteStoredAgent.isPending}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleDelete}
            disabled={deleteStoredAgent.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteStoredAgent.isPending ? 'Deleting...' : 'Delete Agent'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
