import { Button, Skeleton, StatusBadge, Txt, toast } from '@mastra/playground-ui';
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
    return <Skeleton className="h-full" />;
  }

  if (!platforms || platforms.length === 0) {
    return (
      <div className="py-2 overflow-y-auto h-full px-5">
        <Txt variant="ui-sm" className="text-neutral6">
          No channel platforms configured.
        </Txt>
      </div>
    );
  }

  return (
    <div className="py-2 overflow-y-auto h-full px-5 space-y-3">
      {platforms.map(platform => (
        <PlatformSection key={platform.id} platform={platform} agentId={agentId} />
      ))}
    </div>
  );
};

interface PlatformSectionProps {
  platform: ChannelPlatformInfo;
  agentId: string;
}

function PlatformSection({ platform, agentId }: PlatformSectionProps) {
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
    <section className="rounded-md border border-border1 p-3">
      {isLoading ? (
        <Skeleton className="h-10" />
      ) : activeInstallation ? (
        <div className="flex items-center gap-2.5">
          <PlatformIcon platform={platform.id} className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Txt variant="ui-sm" className="text-neutral3 truncate">
                {platform.name}
              </Txt>
              <StatusBadge variant="success" size="sm">
                Connected
              </StatusBadge>
            </div>
            <Txt variant="ui-xs" className="text-neutral5 truncate">
              {activeInstallation.displayName || 'Workspace'}
            </Txt>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="shrink-0 text-[11px] text-neutral5 hover:text-accent2 transition-colors disabled:opacity-50"
          >
            {isDisconnecting ? 'Removing...' : 'Remove'}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2.5">
          <PlatformIcon platform={platform.id} className="h-5 w-5 shrink-0" />
          <Txt variant="ui-sm" className="text-neutral3 flex-1">
            {platform.name}
          </Txt>
          {!platform.isConfigured ? (
            <StatusBadge variant="warning" size="sm">
              Not configured
            </StatusBadge>
          ) : (
            <Button size="sm" variant="default" onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
