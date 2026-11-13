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
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';
import { IconChainLink1 } from '@mastra/playground-ui/icons/central/IconChainLink1';

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
      <Button
        size="sm"
        icon={<IconChainLink1 />}
        aria-label={`Reconnect ${workspace.name}`}
        onClick={() => setOpen(true)}
      >
        Reconnect
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reconnect {workspace.name}</DialogTitle>
            <DialogDescription>
              Intake from this workspace is paused. Reconnect to resume your saved sources and routing.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Txt as="p" variant="caption">
              Choose {workspace.name} on the Linear authorization screen.
            </Txt>
            <Txt as="p" variant="caption" tone="muted">
              {targeted
                ? "After you return, we'll check that this workspace is connected. Connecting a different workspace won't restore its intake."
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
