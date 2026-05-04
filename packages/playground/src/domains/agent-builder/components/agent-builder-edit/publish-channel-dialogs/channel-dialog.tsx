import { Dialog, DialogContent } from '@mastra/playground-ui';
import { useEffect, useState } from 'react';
import { DisconnectChannelContent } from './disconnect-channel-content';
import { PublishChannelContent } from './publish-channel-content';
import type { ChannelInstallationInfo, ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export type ChannelDialogView = 'publish' | 'confirm-disconnect';

export interface ChannelDialogProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  installation?: ChannelInstallationInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Test/storybook hook — production code always opens on the publish view. */
  initialView?: ChannelDialogView;
}

export function ChannelDialog({
  platform,
  agentId,
  installation,
  open,
  onOpenChange,
  initialView = 'publish',
}: ChannelDialogProps) {
  const [view, setView] = useState<ChannelDialogView>(initialView);

  // Reset back to the publish view whenever the dialog reopens, so the next
  // open does not flash the disconnect-confirm content.
  useEffect(() => {
    if (open) setView(initialView);
  }, [open, initialView]);

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`publish-channel-dialog-${platform.id}`}>
        {view === 'publish' ? (
          <PublishChannelContent
            platform={platform}
            agentId={agentId}
            installation={installation}
            onClose={close}
            onDisconnectRequest={() => setView('confirm-disconnect')}
          />
        ) : (
          <DisconnectChannelContent
            platform={platform}
            agentId={agentId}
            onCancel={() => setView('publish')}
            onClose={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
