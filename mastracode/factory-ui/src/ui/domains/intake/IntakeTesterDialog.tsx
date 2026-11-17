import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { useState } from 'react';

import { IntakeTesterPanel } from './IntakeTesterPanel';

/** A button opening the intake tester, testing `itemId` straight away when one is given. Nothing is filed. */
export function IntakeTesterDialog({
  factoryProjectId,
  itemId,
  label,
}: {
  factoryProjectId: string;
  itemId?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <Dialog open onOpenChange={next => !next && setOpen(false)}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Test intake</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <IntakeTesterPanel factoryProjectId={factoryProjectId} itemId={itemId} />
            </DialogBody>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
