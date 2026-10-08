import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { useChannelPlatforms } from '@mastra/react/hooks/agents';
import { AgentChannels } from './agent-channels';

export const AgentChannelsCard = ({ agentId }: { agentId: string }) => {
  const { data: platforms } = useChannelPlatforms();

  if (!platforms?.length) return null;

  return (
    <Card elevation="flat" data-testid="agent-channels-card">
      <CardContent density="compact" className="px-4">
        <AgentChannels agentId={agentId} />
      </CardContent>
    </Card>
  );
};
