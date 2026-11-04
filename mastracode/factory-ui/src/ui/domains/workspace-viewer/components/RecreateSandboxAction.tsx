import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RotateCcw } from 'lucide-react';
import { useState } from 'react';

import type { WorkspaceChanges } from '../../../../api/types';
import { useRecreateSessionSandbox } from '../../workspaces/hooks/useRecreateSessionSandbox';
import type { RecreateSandboxTarget } from '../../workspaces/hooks/useRecreateSessionSandbox';

export type { RecreateSandboxTarget };

interface RecreateSandboxActionProps {
  target: RecreateSandboxTarget;
  changes?: WorkspaceChanges;
  changesLoading: boolean;
  changesError?: Error;
}

function changesWarning({ changes, changesLoading, changesError }: Omit<RecreateSandboxActionProps, 'target'>) {
  if (changesLoading) return 'Checking for uncommitted changes…';
  // A stuck sandbox often can't report its changes, so assume they exist.
  if (changesError || !changes?.available) return "Uncommitted changes couldn't be checked and will be lost.";
  const count = changes.changes.length;
  if (count === 0) return undefined;
  return `${count} uncommitted ${count === 1 ? 'change' : 'changes'} will be lost.`;
}

export function RecreateSandboxAction({ target, ...changesState }: RecreateSandboxActionProps) {
  const [open, setOpen] = useState(false);
  const recreate = useRecreateSessionSandbox(target, { onSuccess: () => setOpen(false) });
  const warning = changesWarning(changesState);

  const setDialogOpen = (next: boolean) => {
    if (recreate.isPending) return;
    if (next) recreate.reset();
    setOpen(next);
  };

  return (
    <>
      <Button className="w-full justify-start" size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>
        <RotateCcw />
        <span>Recreate sandbox</span>
      </Button>
      <AlertDialog open={open} onOpenChange={setDialogOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Recreate sandbox?</AlertDialog.Title>
            <AlertDialog.Description>
              This destroys the current sandbox. The next message boots a fresh one from the template.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Body className="flex flex-col gap-1">
            {warning ? <Txt variant="body-sm">{warning}</Txt> : null}
            <Txt variant="body-sm">A running agent will be stopped.</Txt>
            {recreate.error ? (
              <Txt variant="body-sm" className="text-destructive-foreground" role="alert">
                {recreate.error.message}
              </Txt>
            ) : null}
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={recreate.isPending}>Cancel</AlertDialog.Cancel>
            <Button variant="destructive" size="md" disabled={recreate.isPending} onClick={() => recreate.mutate()}>
              {recreate.isPending ? 'Recreating…' : 'Recreate'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
