import { Icon, ScrollArea } from '@mastra/playground-ui';
import { Tab, TabContent, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Brain, Radio, Settings2 } from 'lucide-react';
import { useSearchParams } from 'react-router';

import { useChannelPlatforms } from '../../hooks/use-channels';
import { AgentChannels } from '../agent-channels/agent-channels';
import { AgentMetadata } from '../agent-metadata/agent-metadata';
import { AgentMemoryConfig } from './agent-memory-config';

export type AgentSettingsTab = 'overview' | 'memory' | 'channels';

const parseTab = (value: string | null, hasChannels: boolean): AgentSettingsTab => {
  if (value === 'memory') return 'memory';
  if (value === 'channels' && hasChannels) return 'channels';
  return 'overview';
};

export interface AgentSettingsViewProps {
  agentId: string;
}

export function AgentSettingsView({ agentId }: AgentSettingsViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: channelPlatforms } = useChannelPlatforms();
  const hasChannels = Boolean(channelPlatforms?.length);
  const selectedTab = parseTab(searchParams.get('tab'), hasChannels);

  const handleTabChange = (tab: AgentSettingsTab) => {
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true });
  };

  return (
    <div
      className="h-full w-full min-w-0"
      data-testid="agent-settings-view"
      style={{ viewTransitionName: 'agent-settings-view' }}
    >
      <ScrollArea className="h-full w-full" viewPortClassName="h-full" mask={{ top: false }}>
        <Tabs value={selectedTab} defaultTab="overview" onValueChange={handleTabChange}>
          <div className="sticky top-0 z-10 px-3 py-1.5">
            <TabList variant="pill-ghost">
              <Tab value="overview">
                <Icon size="sm">
                  <Settings2 />
                </Icon>
                General
              </Tab>
              <Tab value="memory">
                <Icon size="sm">
                  <Brain />
                </Icon>
                Memory
              </Tab>
              {hasChannels && (
                <Tab value="channels">
                  <Icon size="sm">
                    <Radio />
                  </Icon>
                  Channels
                </Tab>
              )}
            </TabList>
          </div>

          <TabContent value="overview">
            <AgentMetadata agentId={agentId} />
          </TabContent>

          <TabContent value="memory">
            <AgentMemoryConfig agentId={agentId} />
          </TabContent>

          {hasChannels && (
            <TabContent value="channels">
              <AgentChannels agentId={agentId} />
            </TabContent>
          )}
        </Tabs>
      </ScrollArea>
    </div>
  );
}
