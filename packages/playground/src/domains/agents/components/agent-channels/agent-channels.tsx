import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { toast } from '@mastra/playground-ui/utils/toast';
import {
  useChannelPlatforms,
  useChannelInstallations,
  useConnectChannelAction,
  useDisconnectChannel,
} from '../../hooks/use-channels';
import type { ChannelPlatformInfo } from '../../hooks/use-channels';
import { PlatformIcon } from './platform-icons';

export interface AgentChannelsProps {
  agentId: string;
}

export const AgentChannels = ({ agentId }: AgentChannelsProps) => {
  const { data: platforms, isLoading } = useChannelPlatforms();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (!platforms || platforms.length === 0) {
    return (
      <Txt variant="ui-sm" className="text-neutral6">
        No channel platforms configured.
      </Txt>
    );
  }

  return (
    <ul className="divide-border1 divide-y">
      {platforms.map(platform => (
        <ChannelRow key={platform.id} platform={platform} agentId={agentId} />
      ))}
    </ul>
  );
};

interface ChannelRowProps {
  platform: ChannelPlatformInfo;
  agentId: string;
}

function ChannelRow({ platform, agentId }: ChannelRowProps) {
  const { data: installations, isLoading } = useChannelInstallations(platform.id, agentId);
  const { connect, isConnecting } = useConnectChannelAction(platform.id);
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectChannel(platform.id);

  const activeInstallation = installations?.find(i => i.status === 'active');

  const handleConnect = () => {
    connect(agentId);
  };

  const handleDisconnect = () => {
    disconnect(agentId, {
      onError: (err: Error & { body?: { error?: string } }) => {
        toast.error(err.body?.error || err.message || 'Failed to disconnect channel');
      },
    });
  };

  return (
    <li className="flex items-center gap-3 py-2.5">
      <PlatformIcon platform={platform.id} className="h-5 w-5 shrink-0" />

      <span className="flex min-w-0 flex-1 flex-col">
        <Txt as="span" variant="ui-md" className="text-neutral5 truncate">
          {platform.name}
        </Txt>
        {activeInstallation ? (
          <Txt variant="ui-xs" className="text-neutral3 truncate">
            {activeInstallation.displayName || 'Workspace'}
          </Txt>
        ) : null}
      </span>

      {isLoading ? null : activeInstallation ? (
        <Badge variant="green" size="sm" indicator="dot">
          Connected
        </Badge>
      ) : !platform.isConfigured ? (
        <Badge variant="yellow" size="sm" indicator="dot">
          Not configured
        </Badge>
      ) : null}

      {isLoading ? null : activeInstallation ? (
        <Button size="sm" variant="ghost" onClick={handleDisconnect} disabled={isDisconnecting} className="shrink-0">
          {isDisconnecting ? 'Removing...' : 'Remove'}
        </Button>
      ) : platform.isConfigured ? (
        <Button size="sm" variant="default" onClick={handleConnect} disabled={isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </Button>
      ) : null}
    </li>
  );
}
