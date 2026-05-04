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

export function DefaultChannelDialog({
  platform,
  agentId,
  installation,
  open,
  onOpenChange,
  onDisconnectRequest,
}: PublishChannelDialogProps) {
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platform.id);

  const handleConnect = () => {
    connect(
      { agentId },
      {
        onSuccess: result => {
          switch (result.type) {
            case 'oauth':
              window.location.href = result.authorizationUrl;
              break;
            case 'deep_link': {
              const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
              if (!popup) {
                toast.error('Popup blocked — please allow popups and try again');
              }
              onOpenChange(false);
              break;
            }
            case 'immediate':
              onOpenChange(false);
              break;
          }
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
          <DialogDescription>Manage the {platform.name} connection for this agent.</DialogDescription>
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
                ) : installation ? (
                  <StatusBadge variant="success" size="sm">
                    Connected
                  </StatusBadge>
                ) : null}
              </div>
              {installation?.displayName ? (
                <Txt variant="ui-xs" className="text-neutral5 truncate">
                  {installation.displayName}
                </Txt>
              ) : null}
            </div>
          </div>

          <Txt variant="ui-sm" className="text-neutral3">
            {!platform.isConfigured ? (
              'This platform is not configured on the server.'
            ) : installation ? (
              <>
                Connected to{' '}
                <span className="font-medium text-neutral1">{installation.displayName || 'Workspace'}</span>.
              </>
            ) : (
              `Publish this agent to ${platform.name}.`
            )}
          </Txt>
        </DialogBody>

        <DialogFooter>
          {platform.isConfigured && installation ? (
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
              {isConnecting ? 'Connecting…' : 'Connect'}
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
