import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { IconArrowRotateCounterClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateCounterClockwise';

/** Puts a built-in or app board back to Factory's version, after asking. */
export function BoardResetButton({ name, pending, onReset }: { name: string; pending: boolean; onReset: () => void }) {
  return (
    <AlertDialog>
      <AlertDialog.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            icon={<IconArrowRotateCounterClockwise />}
            tooltip="Go back to Factory's version of this board"
            tooltipPosition="bottom"
            disabled={pending}
          >
            Reset
          </Button>
        }
      />
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Reset {name} to default?</AlertDialog.Title>
          <AlertDialog.Description>
            Every change made to this board's name and phases is replaced with Factory's version.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action onClick={onReset}>Reset</AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
