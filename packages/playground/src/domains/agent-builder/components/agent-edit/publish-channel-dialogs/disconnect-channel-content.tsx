import { toast } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@mastra/playground-ui/components/Dialog';
import { useDisconnectChannel } from '@/domains/agents/hooks/use-channels';
import type { ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface DisconnectChannelContentProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  onCancel: () => void;
  onClose: () => void;
}

export function DisconnectChannelContent({ platform, agentId, onCancel, onClose }: DisconnectChannelContentProps) {
  const { mutateAsync: disconnect, isPending } = useDisconnectChannel(platform.id);

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
          Your agent will be removed from <span className="text-neutral6">{platform.name}</span>.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button
          variant="default"
          onClick={handleConfirm}
          disabled={isPending}
          data-testid={`publish-channel-dialog-${platform.id}-disconnect-confirm`}
        >
          {isPending ? 'Disconnecting…' : 'Confirm'}
        </Button>
      </DialogFooter>
    </>
  );
}
