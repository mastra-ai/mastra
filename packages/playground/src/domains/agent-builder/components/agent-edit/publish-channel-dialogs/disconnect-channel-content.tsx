import { Button } from '@mastra/playground-ui/components/Button';
import {
  DialogAction,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useDisconnectChannel } from '@mastra/react/hooks/agents';
import type { ChannelPlatformInfo } from '@mastra/react/hooks/agents';

export interface DisconnectChannelContentProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  onCancel: () => void;
  onClose: () => void;
}

export function DisconnectChannelContent({ platform, agentId, onCancel, onClose }: DisconnectChannelContentProps) {
  const { mutateAsync: disconnect, isPending } = useDisconnectChannel({ platform: platform.id });

  const handleConfirm = async () => {
    try {
      await disconnect(agentId);
      toast.success(`${platform.name} disconnected`);
      onClose();
    } catch (err) {
      const e = err as Error & { body?: { error?: string } };
      toast.error(e.body?.error || e.message || 'Failed to disconnect channel');
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Are you sure?</DialogTitle>
        <DialogDescription>
          Your agent will be removed from <span className="text-foreground">{platform.name}</span>.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <DialogAction
          onConfirm={handleConfirm}
          disabled={isPending}
          data-testid={`publish-channel-dialog-${platform.id}-disconnect-confirm`}
        >
          {isPending ? 'Disconnecting…' : 'Confirm'}
        </DialogAction>
      </DialogFooter>
    </>
  );
}
