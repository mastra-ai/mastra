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

import { useLinearConnect } from '../../../../hooks/useLinearConnect';
import type { LinearConnectOutcome } from '../../../../hooks/useLinearConnect';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';

export function LinearWorkspaceControl({
  workspace,
  onFinished,
}: {
  workspace: LinearWorkspaceConnection;
  onFinished?: (outcome: LinearConnectOutcome) => void;
}) {
  const linear = useLinearConnect();
  const [open, setOpen] = useState(false);
  const reconnect = async () => {
    const outcome = await linear.connect({ workspaceId: workspace.id });
    setOpen(false);
    onFinished?.(outcome);
  };
  return (
    <>
      <Button size="sm" icon={<Link2 />} aria-label={`Reconnect ${workspace.name}`} onClick={() => setOpen(true)}>
        Reconnect
      </Button>
      <Dialog open={open} onOpenChange={setOpen} pending={linear.pending}>
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
              {linear.platform
                ? "Linear opens in a new window. Connecting a different workspace won't restore this one's intake."
                : 'Check the workspace in Linear before granting access.'}
            </Txt>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>Cancel</DialogCancel>
            <Button disabled={linear.pending} onClick={() => void reconnect()}>
              {linear.pending ? 'Connecting…' : 'Continue to Linear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
