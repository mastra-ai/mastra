import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import type { Blocker } from 'react-router';

export function DiscardChangesDialog({
  blocker,
  title,
  description,
}: {
  blocker: Blocker;
  title: string;
  description: string;
}) {
  return (
    <AlertDialog open={blocker.state === 'blocked'} onOpenChange={open => !open && blocker.reset?.()}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>{title}</AlertDialog.Title>
          <AlertDialog.Description>{description}</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Keep editing</AlertDialog.Cancel>
          <Button variant="destructive" size="md" onClick={() => blocker.proceed?.()}>
            Discard
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
