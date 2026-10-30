import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { describePages, pagesTouched, plural } from '../runs';

export interface ImportNowDialogProps {
  label: string;
  open: boolean;
  lastPreview: KnowledgeImporterRunSummary | undefined;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function ImportNowDialog({ label, open, lastPreview, onOpenChange, onConfirm }: ImportNowDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Import {label} now?</AlertDialog.Title>
          <AlertDialog.Description>
            Writes into Knowledge with the saved settings. {describeLastPreview(lastPreview)}
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          <Button variant="primary" onClick={onConfirm}>
            Import now
          </Button>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}

const NAMED_DESTINATIONS = 3;

function describeLastPreview(run: KnowledgeImporterRunSummary | undefined): string {
  if (!run || run.status !== 'succeeded') return 'Run a preview first to see what lands where.';
  const destinations = run.preview?.destinations ?? [];
  if (destinations.length > 0) {
    const places = destinations
      .slice(0, NAMED_DESTINATIONS)
      .map(destination => `${destination.label} (${describePages(destination.nodes)})`);
    const rest = destinations.length - places.length;
    const more = rest > 0 ? `, and ${plural(rest, 'more destination')}` : '';
    return `The last preview put pages into ${places.join(', ')}${more}.`;
  }
  const pages = pagesTouched(run);
  return pages === undefined ? '' : `The last preview found ${describePages(pages)}.`;
}
