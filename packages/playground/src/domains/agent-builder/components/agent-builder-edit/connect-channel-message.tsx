import { Button, StatusBadge, Txt, toast } from '@mastra/playground-ui';
import { useState } from 'react';
import { ChannelDialog } from './publish-channel-dialogs';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import { useChannelInstallations, useChannelPlatforms, useConnectChannel } from '@/domains/agents/hooks/use-channels';

export interface ConnectChannelMessageProps {
  platformId: string;
  agentId: string | undefined;
}

export function ConnectChannelMessage({ platformId, agentId }: ConnectChannelMessageProps) {
  const { data: platforms = [], isLoading: arePlatformsLoading } = useChannelPlatforms();
  const platform = platforms.find(p => p.id === platformId);
  const { data: installations = [] } = useChannelInstallations(platformId, agentId ?? '');
  const installation = installations.find(i => i.status === 'active');
  const { mutate: connect, isPending: isConnecting } = useConnectChannel(platformId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!agentId || arePlatformsLoading || !platform) {
    return null;
  }

  const handleConnect = () => {
    connect(
      { agentId },
      {
        onSuccess: result => {
          if (result.type === 'oauth') {
            window.location.href = result.authorizationUrl;
            return;
          }
          if (result.type === 'deep_link') {
            const popup = window.open(result.url, '_blank', 'noopener,noreferrer');
            if (!popup) {
              toast.error('Popup blocked — please allow popups and try again');
            }
          }
          // 'immediate' → installation list will be invalidated by the hook;
          // no further UI action needed.
        },
        onError: (err: Error & { body?: { error?: string } }) => {
          toast.error(err.body?.error || err.message || 'Failed to connect channel');
        },
      },
    );
  };

  return (
    <>
      <div
        className="border border-1 p-3 rounded-xl flex items-center gap-3"
        data-testid={`agent-builder-chat-connect-channel-${platformId}`}
      >
        <PlatformIcon platform={platform.id} className="h-5 w-5 shrink-0" />
        <Txt variant="ui-md" className="flex-1 text-neutral4" as="div">
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

        {!platform.isConfigured ? (
          <Button
            size="sm"
            variant="ghost"
            disabled
            data-testid={`agent-builder-chat-connect-channel-${platformId}-button`}
          >
            Not configured
          </Button>
        ) : installation ? (
          <Button
            size="sm"
            variant="default"
            onClick={() => setDialogOpen(true)}
            data-testid={`agent-builder-chat-connect-channel-${platformId}-button`}
          >
            Manage
          </Button>
        ) : (
          <Button
            size="sm"
            variant="default"
            onClick={handleConnect}
            disabled={isConnecting}
            data-testid={`agent-builder-chat-connect-channel-${platformId}-button`}
          >
            {isConnecting ? 'Connecting…' : platformId === 'slack' ? 'Continue with Slack' : `Connect ${platform.name}`}
          </Button>
        )}
      </div>

      {dialogOpen ? (
        <ChannelDialog
          platform={platform}
          agentId={agentId}
          installation={installation}
          open
          onOpenChange={setDialogOpen}
        />
      ) : null}
    </>
  );
}
