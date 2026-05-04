import { AlertDialog, Txt, toast } from '@mastra/playground-ui';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useDisconnectChannel
  
  
} from '@/domains/agents/hooks/use-channels';
import type {ChannelInstallationInfo, ChannelPlatformInfo} from '@/domains/agents/hooks/use-channels';

export interface DisconnectChannelConfirmDialogProps {
  platform: ChannelPlatformInfo;
  agentId: string;
  installation: ChannelInstallationInfo | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DisconnectChannelConfirmDialog({
  platform,
  agentId,
  installation,
  open,
  onOpenChange,
}: DisconnectChannelConfirmDialogProps) {
  const { mutate: disconnect, isPending } = useDisconnectChannel(platform.id);

  const handleConfirm = () => {
    disconnect(agentId, {
      onSuccess: () => onOpenChange(false),
      onError: (err: Error & { body?: { error?: string } }) => {
        toast.error(err.body?.error || err.message || 'Failed to disconnect channel');
      },
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Disconnect {platform.name}</AlertDialog.Title>
          <AlertDialog.Description>
            Disconnect this agent from {installation?.displayName || `your ${platform.name} workspace`}.
          </AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Body className="grid gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border1 p-3">
            <PlatformIcon platform={platform.id} className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <Txt variant="ui-md" className="font-medium text-neutral1 truncate">
                {platform.name}
              </Txt>
              {installation?.displayName ? (
                <Txt variant="ui-xs" className="text-neutral5 truncate">
                  {installation.displayName}
                </Txt>
              ) : null}
            </div>
          </div>
          <Txt variant="ui-sm" className="text-neutral3">
            This removes the connection between this agent and {platform.name}. You can reconnect later.
          </Txt>
        </AlertDialog.Body>
        <AlertDialog.Footer>
          <AlertDialog.Action
            onClick={event => {
              event.preventDefault();
              handleConfirm();
            }}
            disabled={isPending}
            data-testid={`publish-channel-dialog-${platform.id}-disconnect-confirm`}
          >
            {isPending ? 'Disconnecting…' : 'Disconnect'}
          </AlertDialog.Action>
          <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog>
  );
}
