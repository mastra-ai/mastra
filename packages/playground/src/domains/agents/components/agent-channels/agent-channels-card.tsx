import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@mastra/playground-ui/components/Card';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMastraClient } from '@mastra/react';
import { useChannelPlatforms } from '@mastra/react/hooks/agents';
import type { ChannelPlatformInfo } from '@mastra/react/hooks/agents';
import { useQueries } from '@tanstack/react-query';
import { Plug } from 'lucide-react';
import { PlatformIcon } from './platform-icons';
import { useConnectChannelAction } from '@/domains/agents/hooks/use-connect-channel-action';
import { useReconcilePendingInstallOnFocus } from '@/domains/agents/hooks/use-reconcile-pending-install-on-focus';

export const AgentChannelsCard = ({ agentId }: { agentId: string }) => {
  const client = useMastraClient();
  const { data: platforms = [] } = useChannelPlatforms();
  const configured = platforms.filter(platform => platform.isConfigured);

  const installs = useQueries({
    queries: configured.map(platform => ({
      queryKey: ['channels', 'installations', platform.id, agentId],
      queryFn: () => client.channels.listInstallations(platform.id, agentId),
      staleTime: 10 * 1000,
      retry: false,
    })),
  });

  const actions = configured.flatMap((platform, index) => {
    const installations = installs[index]?.data;
    if (!installations || installations.some(i => i.status === 'active')) return [];
    return [{ platform, isPending: installations.some(i => i.status === 'pending') }];
  });

  if (actions.length === 0) return null;

  return (
    <Card elevation="flat" data-testid="agent-channels-card">
      <CardHeader>
        <CardTitle>Choose how to talk to your agent</CardTitle>
        <CardDescription>Add your agent to a channel to chat with it there.</CardDescription>
      </CardHeader>
      <CardContent density="compact" className="px-4">
        <ul className="divide-y divide-border">
          {actions.map(({ platform, isPending }) => (
            <ChannelAction key={platform.id} platform={platform} agentId={agentId} isPending={isPending} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

function ChannelAction({
  platform,
  agentId,
  isPending,
}: {
  platform: ChannelPlatformInfo;
  agentId: string;
  isPending: boolean;
}) {
  const { connect, isConnecting } = useConnectChannelAction(platform.id);
  useReconcilePendingInstallOnFocus({ platform: platform.id, agentId, hasPendingInstall: isPending });

  return (
    <li className="flex items-center gap-3 py-2.5">
      <PlatformIcon platform={platform.id} className="h-5 w-5 shrink-0" />
      <Txt as="span" variant="body" tone="ink" className="min-w-0 flex-1 truncate">
        {platform.name}
      </Txt>
      {isPending ? (
        <Badge variant="warning" size="sm" indicator="dot">
          Pending
        </Badge>
      ) : null}
      <Button icon={<Plug />} size="sm" variant="default" onClick={() => connect(agentId)} disabled={isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect'}
      </Button>
    </li>
  );
}
