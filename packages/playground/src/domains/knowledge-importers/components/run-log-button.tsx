import type { KnowledgeImporterRunSummary } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollText } from 'lucide-react';
import { useState } from 'react';
import { RunLogDrawer } from './run-log-drawer';

/** Opens a run's live log. */
export function RunLogButton({ importerKey, run }: { importerKey: string; run: KnowledgeImporterRunSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" icon={<ScrollText />} onClick={() => setOpen(true)}>
        View log
      </Button>
      <RunLogDrawer importerKey={importerKey} run={run} open={open} onOpenChange={setOpen} />
    </>
  );
}
