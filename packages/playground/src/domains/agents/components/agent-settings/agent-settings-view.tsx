import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';

import { useChannelPlatforms } from '../../hooks/use-channels';
import { AgentChannels } from '../agent-channels/agent-channels';
import { AgentMetadata } from '../agent-metadata/agent-metadata';
import { AgentMemoryConfig } from './agent-memory-config';

export interface AgentSettingsViewProps {
  agentId: string;
}

export function AgentSettingsView({ agentId }: AgentSettingsViewProps) {
  const { data: channelPlatforms } = useChannelPlatforms();
  const hasChannels = Boolean(channelPlatforms?.length);

  return (
    <div
      className="h-full w-full min-w-0"
      data-testid="agent-settings-view"
      style={{ viewTransitionName: 'agent-settings-view' }}
    >
      <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
        <AgentMetadata agentId={agentId} />
        <AgentMemoryConfig agentId={agentId} />
        {hasChannels && <AgentChannels agentId={agentId} />}
      </ScrollArea>
    </div>
  );
}
