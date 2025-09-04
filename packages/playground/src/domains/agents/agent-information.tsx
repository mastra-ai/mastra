import { useAgent, useModelProviders, useUpdateAgentModel } from '@/hooks/use-agents';
import { AgentLogs } from './agent-logs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AgentSettings,
  PlaygroundTabs,
  Tab,
  TabContent,
  TabList,
  AgentMetadata,
  AgentEntityHeader,
  useAgentSettings,
  EntityMainHeader,
  AgentIcon,
  ToolsIcon,
  WorkflowIcon,
  KeyValueList,
  Tabs,
  AgentDetails,
  MemoryIcon,
} from '@mastra/playground-ui';

import { useMemory } from '@/hooks/use-memory';
import { AgentMemory } from './agent-memory';
import { useState, useEffect } from 'react';
import { AgentPromptEnhancer } from './agent-instructions-enhancer';
import { Link } from 'react-router';
import { ArrowRightIcon, BrainIcon, GaugeIcon, HashIcon } from 'lucide-react';

export function AgentInformation({ agentId, chatInputValue }: { agentId: string; chatInputValue?: string }) {
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: modelProviders } = useModelProviders();
  const { mutateAsync: updateModel } = useUpdateAgentModel(agentId);
  const { memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { settings, setSettings } = useAgentSettings();
  const isRedesignedForCMS = true;

  // Persist tab selection
  const STORAGE_KEY = 'agent-info-selected-tab';
  const [selectedTab, setSelectedTab] = useState<string>(() => {
    return sessionStorage.getItem(STORAGE_KEY) || 'overview';
  });

  const handleTabChange = (value: string) => {
    setSelectedTab(value);
    sessionStorage.setItem(STORAGE_KEY, value);
  };

  useEffect(() => {
    if (agent?.modelId?.includes('gpt-5')) {
      setSettings({
        ...(settings || {}),
        modelSettings: {
          ...(settings?.modelSettings || {}),
          temperature: 1,
        },
      });
    }
  }, [agent]);

  // Switch away from memory tab if memory is disabled (not just loading)
  useEffect(() => {
    if (!isMemoryLoading && !memory?.result && selectedTab === 'memory') {
      // Switch to overview tab if memory is disabled
      handleTabChange('overview');
    }
  }, [isMemoryLoading, memory?.result, selectedTab]);

  const entityData = [
    {
      key: 'id',
      label: 'ID',
      value: <>{agentId}</>,
      icon: <HashIcon />,
    },
    {
      key: 'model',
      label: 'Model',
      value: (
        <>
          {agent?.provider} / {agent?.modelId}
        </>
      ),
      icon: <BrainIcon />,
    },
    {
      key: 'memory',
      label: 'Memory',
      value: memory?.result ? 'Enabled' : 'Disabled',
      icon: <MemoryIcon />,
    },
    {
      key: 'tools',
      label: 'Tools',
      icon: <ToolsIcon />,
      separator: <ArrowRightIcon />,
      value: [
        {
          id: 'tool1',
          name: 'cooking-tool',
          description: 'Description for Tool 1',
          path: '/tools/chefAgent/tool-a65397fb',
          icon: <ToolsIcon />,
        },
        {
          id: 'tool2',
          name: 'tool-a65397fb',
          description: 'Description for Tool 2',
          path: '/tools/chefAgent/cooking-tool',
          icon: <ToolsIcon />,
        },
      ],
    },
    {
      key: 'workflows',
      label: 'Workflows',
      icon: <WorkflowIcon />,
      separator: <ArrowRightIcon />,
      value: [
        {
          id: 'workflow1',
          name: 'my-workflow',
          description: 'Description for Workflow 1',
          path: '/workflows/myWorkflow/graph',
          icon: <WorkflowIcon />,
        },
      ],
    },
    {
      key: 'scorers',
      label: 'Scorers',
      icon: <GaugeIcon />,
      value: 'n/a',
    },
  ];

  return isRedesignedForCMS ? (
    <div className="grid h-full relative items-start overflow-y-auto border-l border-border1 pl-[1.5rem] content-start grid-rows-[auto_1fr] ">
      <EntityMainHeader title={agent?.name} icon={<AgentIcon />} placement="sidebar" />
      <div className="grid overflow-y-auto h-full pr-[1.5rem] content-start">
        <KeyValueList data={entityData} LinkComponent={Link} />

        <Tabs value={selectedTab} onValueChange={handleTabChange} defaultTab="overview" className="mt-[2rem]">
          <Tabs.List variant="buttons" className="sticky top-0 bg-surface2 z-[100]">
            <Tabs.Tab value="overview">Settings</Tabs.Tab>
            {memory?.result && <Tabs.Tab value="memory">Memory</Tabs.Tab>}
            <Tabs.Tab value="logs">Log Drains</Tabs.Tab>
          </Tabs.List>
          <Tabs.Content value="overview">
            <AgentDetails LinkComponent={Link} agentId={agentId} agent={agent} />
          </Tabs.Content>
          <TabContent value="memory">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <AgentMemory agentId={agentId} chatInputValue={selectedTab === 'memory' ? chatInputValue : undefined} />
            )}
          </TabContent>
          <TabContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabContent>
        </Tabs>
      </div>
    </div>
  ) : (
    <div className="grid grid-rows-[auto_1fr] h-full items-start overflow-y-auto border-l-sm border-border1">
      <AgentEntityHeader agentId={agentId} isLoading={isMemoryLoading} agentName={agent?.name || ''} />

      <div className="flex-1 overflow-hidden border-t-sm border-border1 flex flex-col">
        <PlaygroundTabs defaultTab="overview" value={selectedTab} onValueChange={handleTabChange}>
          <TabList>
            <Tab value="overview">Overview</Tab>
            <Tab value="model-settings">Model Settings</Tab>
            {memory?.result && <Tab value="memory">Memory</Tab>}
            <Tab value="logs">Log Drains</Tab>
          </TabList>
          <TabContent value="overview">
            {isLoading && <Skeleton className="h-full" />}
            {agent && (
              <AgentMetadata
                agent={agent}
                updateModel={updateModel}
                modelProviders={modelProviders || []}
                hasMemoryEnabled={Boolean(memory?.result)}
                computeToolLink={tool => `/tools/${agentId}/${tool.id}`}
                computeWorkflowLink={workflow => `/workflows/${workflow.name}/graph`}
                promptSlot={<AgentPromptEnhancer agentId={agentId} />}
              />
            )}
          </TabContent>
          <TabContent value="model-settings">
            {isLoading && <Skeleton className="h-full" />}
            {agent && <AgentSettings modelVersion={agent.modelVersion} />}
          </TabContent>
          <TabContent value="memory">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <AgentMemory agentId={agentId} chatInputValue={selectedTab === 'memory' ? chatInputValue : undefined} />
            )}
          </TabContent>
          <TabContent value="logs">
            {isLoading ? <Skeleton className="h-full" /> : <AgentLogs agentId={agentId} />}
          </TabContent>
        </PlaygroundTabs>
      </div>
    </div>
  );
}
