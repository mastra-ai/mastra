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
import type { ReactNode } from 'react';

import { useApiConfig } from '../../../../api/config';
import { connectLinear } from '../../factory/services/linear';
import type { LinearWorkspaceConnection } from '../../factory/services/linear';

export function LinearWorkspaceControl({
  workspace,
  targeted,
  icon = <Link2 />,
}: {
  workspace: LinearWorkspaceConnection;
  targeted: boolean;
  icon?: ReactNode;
}) {
  const { baseUrl } = useApiConfig();
  const [open, setOpen] = useState(false);
  const action = workspace.connected ? 'Manage' : 'Reconnect';
  return (
    <>
      <Button
        size="sm"
        variant={workspace.connected ? 'ghost' : 'default'}
        icon={icon}
        aria-label={`${action} ${workspace.name}`}
        onClick={() => setOpen(true)}
      >
        {action}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action} {workspace.name}
            </DialogTitle>
            <DialogDescription>
              {workspace.connected
                ? 'This workspace is connected. Your saved intake sources and routing are kept when you reauthorize.'
                : 'Intake from this workspace is paused. Reconnect to resume your saved sources and routing.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Txt as="p" variant="caption">
              Choose {workspace.name} on the Linear authorization screen.
            </Txt>
            <Txt as="p" variant="caption" tone="muted">
              {targeted && !workspace.connected
                ? "After you return, we'll check that this workspace is connected. Connecting a different workspace won't restore its intake."
                : 'Check the workspace in Linear before granting access.'}
            </Txt>
          </DialogBody>
          <DialogFooter>
            <DialogCancel>{workspace.connected ? 'Done' : 'Cancel'}</DialogCancel>
            <Button onClick={() => connectLinear(baseUrl, targeted ? workspace.id : undefined)}>
              {workspace.connected ? 'Reauthorize in Linear' : 'Continue to Linear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
