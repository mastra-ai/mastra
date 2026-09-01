import { Card, CardContent, CardHeader, CardTitle } from '@mastra/playground-ui/components/Card';
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
    <div className="h-full w-full min-w-0" data-testid="agent-settings-view">
      <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
        <div className="grid grid-cols-1 items-start gap-4 px-5 py-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <AgentMetadata agentId={agentId} />

          <div className="flex flex-col gap-4">
            <Card elevation="elevated" className="bg-surface3">
              <CardHeader>
                <CardTitle>Memory</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <AgentMemoryConfig agentId={agentId} />
              </CardContent>
            </Card>

            {hasChannels && (
              <Card elevation="elevated" className="bg-surface3">
                <CardHeader>
                  <CardTitle>Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  <AgentChannels agentId={agentId} />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
