import { Button } from '@mastra/playground-ui/components/Button';
import {
  Dialog,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Link2 } from 'lucide-react';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';

export function LinearWorkspaceControl({
  workspace,
  targeted,
}: {
  workspace: LinearWorkspaceConnection;
  targeted: boolean;
}) {
  const { baseUrl } = useApiConfig();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon={<Link2 />} aria-label={`Reconnect ${workspace.name}`} onClick={() => setOpen(true)}>
        Reconnect
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconnect {workspace.name}</DialogTitle>
            <DialogDescription>Choose {workspace.name} on the Linear authorization screen.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Txt as="p" variant="caption" tone="muted">
              {targeted
                ? "Connecting a different workspace won't restore its intake."
                : 'Check the workspace in Linear before granting access.'}
            </Txt>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <Button onClick={() => connectLinear(baseUrl, targeted ? workspace.id : undefined)}>
              Continue to Linear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
