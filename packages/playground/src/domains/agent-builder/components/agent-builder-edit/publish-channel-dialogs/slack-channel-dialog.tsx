import {
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
import type { PublishChannelDialogProps } from './types';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import { useConnectChannel } from '@/domains/agents/hooks/use-channels';

export function SlackChannelDialog({
  platform,
  agentId,
  installation,
  open,
  onOpenChange,
  onDisconnectRequest,
}: PublishChannelDialogProps) {
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platform.id);

  const activeInstallation = installation?.status === 'active' ? installation : undefined;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={`publish-channel-dialog-${platform.id}`}>
        <DialogHeader>
          <DialogTitle>Publish to {platform.name}</DialogTitle>
          <DialogDescription>Manage the Slack connection for this agent.</DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-border1 p-3">
            <PlatformIcon platform={platform.id} className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Txt variant="ui-md" className="font-medium text-neutral1 truncate">
                  {platform.name}
                </Txt>
                {!platform.isConfigured ? (
                  <StatusBadge variant="warning" size="sm">
                    Not configured
                  </StatusBadge>
                ) : activeInstallation ? (
                  <StatusBadge variant="success" size="sm">
                    Connected
                  </StatusBadge>
                ) : null}
              </div>
              {activeInstallation?.displayName ? (
                <Txt variant="ui-xs" className="text-neutral5 truncate">
                  {activeInstallation.displayName}
                </Txt>
              ) : null}
            </div>
          </div>

          <Txt variant="ui-sm" className="text-neutral3">
            {!platform.isConfigured ? (
              'Slack is not configured on the server.'
            ) : activeInstallation ? (
              <>
                Connected to{' '}
                <span className="font-medium text-neutral1">{activeInstallation.displayName || 'Slack workspace'}</span>
                .
              </>
            ) : (
              'You will be redirected to Slack to choose a workspace and approve permissions.'
            )}
          </Txt>
        </DialogBody>

        <DialogFooter>
          {platform.isConfigured && activeInstallation ? (
            <Button
              variant="default"
              onClick={() => onDisconnectRequest?.()}
              data-testid={`publish-channel-dialog-${platform.id}-disconnect`}
            >
              Disconnect
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
  );
}
