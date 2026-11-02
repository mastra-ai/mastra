import { useState } from 'react';
import { CreateReplayDatasetDialog } from './create-replay-dataset-dialog';
import type { ReplaySource } from './create-replay-dataset-dialog';
import { Button } from '@/ds/components/Button';

export function CreateReplayDatasetButton({ source }: { source: ReplaySource }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        Create replay dataset
      </Button>
      {open && <CreateReplayDatasetDialog source={source} onClose={() => setOpen(false)} />}
    </>
  );
}
