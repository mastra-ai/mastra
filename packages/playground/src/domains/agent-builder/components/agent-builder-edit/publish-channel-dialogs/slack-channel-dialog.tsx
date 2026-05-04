import {
  AlertDialog,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  StatusBadge,
  Txt,
  toast,
} from '@mastra/playground-ui';
import { useState } from 'react';
import { useConnectChannel, useDisconnectChannel } from '@/domains/agents/hooks/use-channels';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import type { PublishChannelDialogProps } from './types';

export function SlackChannelDialog({ platform, agentId, installation, open, onOpenChange }: PublishChannelDialogProps) {
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platform.id);
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectChannel(platform.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConnect = () => {
    connect(
      { agentId },
      {
        onSuccess: result => {
          if (result.type === 'oauth') {
            window.location.href = result.authorizationUrl;
            return;
          }
          // Slack should always return an OAuth result, but fall back gracefully.
          if (result.type === 'deep_link') {
            const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
            if (!popup) {
              toast.error('Popup blocked — please allow popups and try again');
            }
          }
          onOpenChange(false);
        },
        onError: (err: Error & { body?: { error?: string } }) => {
          toast.error(err.body?.error || err.message || 'Failed to connect channel');
        },
      },
    );
  };

  const openDisconnectConfirm = () => {
    // Close the publish dialog before opening the confirm dialog so only one
    // dialog is ever visible at a time — matches the rest of the playground's
    // destructive-confirm pattern (e.g. DeleteDatasetDialog).
    onOpenChange(false);
    setConfirmOpen(true);
  };

  const handleDisconnect = () => {
    disconnect(agentId, {
      onSuccess: () => {
        setConfirmOpen(false);
      },
      onError: (err: Error & { body?: { error?: string } }) => {
        toast.error(err.body?.error || err.message || 'Failed to disconnect channel');
      },
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-testid={`publish-channel-dialog-${platform.id}`}>
          <DialogHeader>
            <DialogTitle>Publish to {platform.name}</DialogTitle>
            <DialogDescription>Connect this agent to Slack.</DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-3">
            <div className="flex items-center gap-2">
              <PlatformIcon platform={platform.id} className="h-5 w-5" />
              <Txt variant="ui-md" className="font-medium">
                {platform.name}
              </Txt>
              {!platform.isConfigured ? (
                <StatusBadge variant="warning" size="sm">
                  Not configured
                </StatusBadge>
              ) : installation ? (
                <StatusBadge variant="success" size="sm">
                  Connected
                </StatusBadge>
              ) : null}
            </div>

            {!platform.isConfigured ? (
              <Txt variant="ui-sm" className="text-neutral3">
                Slack is not configured on the server.
              </Txt>
            ) : installation ? (
              <Txt variant="ui-sm" className="text-neutral3 truncate">
                {installation.displayName || 'Slack workspace'}
              </Txt>
            ) : (
              <Txt variant="ui-sm" className="text-neutral3">
                You will be redirected to Slack to choose a workspace and approve permissions.
              </Txt>
            )}
          </DialogBody>

          <DialogFooter>
            {platform.isConfigured && installation ? (
              <Button
                variant="default"
                onClick={openDisconnectConfirm}
                disabled={isDisconnecting}
                data-testid={`publish-channel-dialog-${platform.id}-disconnect`}
              >
                {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            ) : platform.isConfigured ? (
              <Button
                variant="default"
                onClick={handleConnect}
                disabled={isConnecting}
                data-testid={`publish-channel-dialog-${platform.id}-connect`}
              >
                {isConnecting ? 'Connecting…' : 'Continue with Slack'}
              </Button>
            ) : (
              <Button variant="default" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Disconnect Slack</AlertDialog.Title>
            <AlertDialog.Description>
              This will remove the Slack app from your workspace and stop the bot from responding for this agent. You
              can reconnect later.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Action
              onClick={event => {
                event.preventDefault();
                handleDisconnect();
              }}
              disabled={isDisconnecting}
              data-testid={`publish-channel-dialog-${platform.id}-disconnect-confirm`}
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
            </AlertDialog.Action>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
