import { Button, StatusBadge, Txt } from '@mastra/playground-ui';
import { useState } from 'react';
import { ChannelDialog } from './publish-channel-dialogs';
import { PlatformIcon } from '@/domains/agents/components/agent-channels/platform-icons';
import {
  useChannelInstallations,
  useChannelPlatforms,
  useConnectChannelAction,
} from '@/domains/agents/hooks/use-channels';

export interface ConnectChannelMessageProps {
  platformId: string;
  agentId: string | undefined;
}

export function ConnectChannelMessage({ platformId, agentId }: ConnectChannelMessageProps) {
  const { data: platforms = [], isLoading: arePlatformsLoading } = useChannelPlatforms();
  const platform = platforms.find(p => p.id === platformId);
  const { data: installations = [] } = useChannelInstallations(platformId, agentId ?? '');
  const installation = installations.find(i => i.status === 'active');
  const { connect, isConnecting } = useConnectChannelAction(platformId);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!agentId || arePlatformsLoading || !platform) {
    return null;
  }

  const handleConnect = () => {
    connect(agentId);
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
