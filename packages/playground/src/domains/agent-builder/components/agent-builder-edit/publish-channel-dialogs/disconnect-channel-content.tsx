import { Button, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from '@mastra/playground-ui';
import { useDisconnectChannel } from '@/domains/agents/hooks/use-channels';
import type { ChannelPlatformInfo } from '@/domains/agents/hooks/use-channels';

export interface DisconnectChannelContentProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  onCancel: () => void;
  onClose: () => void;
}

export function DisconnectChannelContent({ platform, agentId, onCancel, onClose }: DisconnectChannelContentProps) {
  const { mutate: disconnect, isPending } = useDisconnectChannel(platform.id);

  const handleConfirm = () => {
    disconnect(agentId, {
      onSuccess: () => onClose(),
      onError: (err: Error & { body?: { error?: string } }) => {
        toast.error(err.body?.error || err.message || 'Failed to disconnect channel');
      },
    });
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
