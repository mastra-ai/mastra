import type { DatasetExperiment } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { RenameExperimentDialog } from '@/domains/experiments/components/rename-experiment-dialog';

export interface RenameExperimentButtonProps {
  experiment: DatasetExperiment;
}

export function RenameExperimentButton({ experiment }: RenameExperimentButtonProps) {
  const [open, setOpen] = useState(false);

  // The rename route is dataset-scoped, so caller-run experiments without a dataset can't be renamed.
  if (!experiment.datasetId) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)} tooltip="Rename this experiment" variant="ghost" size="icon-sm">
        <Pencil />
      </Button>
      {open && <RenameExperimentDialog experiment={experiment} open onOpenChange={setOpen} />}
    </>
  );
}
