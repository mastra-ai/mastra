import { Card } from '@mastra/playground-ui/components/Card';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Bot, Boxes, Brain, Cpu, Folder, Gauge, Globe, Radio, Sparkles, Workflow, Wrench } from 'lucide-react';
import { useAgent } from '../../hooks/use-agent';
import { useReorderModelList, useUpdateModelInModelList } from '../../hooks/use-agents';
import { useChannelPlatforms } from '../../hooks/use-channels';
import { extractPrompt } from '../../utils/extractPrompt';
import { AgentChannels } from '../agent-channels/agent-channels';
import {
  AgentMetadataBrowserToolsList,
  AgentMetadataCombinedProcessorList,
  AgentMetadataNetworkList,
  AgentMetadataScorerList,
  AgentMetadataSkillList,
  AgentMetadataToolList,
  AgentMetadataWorkflowList,
  AgentMetadataWorkspaceToolsList,
} from '../agent-metadata/agent-metadata-lists';
import { AgentMetadataModelList } from '../agent-metadata/agent-metadata-model-list';
import { AgentMetadataSection } from '../agent-metadata/agent-metadata-section';
import { AgentMemoryConfig } from '../agent-settings/agent-memory-config';
import { AgentSystemPrompt } from './agent-system-prompt';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';
import { useRouteSidePanel } from '@/lib/route-side-panel';

export interface AgentOverviewPanelProps {
  agentId: string;
}

export function AgentOverviewPanel({ agentId }: AgentOverviewPanelProps) {
  const { isCollapsed } = useRouteSidePanel();

  return (
    <Card
      data-testid="agent-overview-panel"
      className="rounded-studio-frame grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden"
    >
      <div className="border-border1 flex h-10 min-h-10 items-center border-b px-4">
        <Txt as="h2" variant="header-md" className="text-neutral6 font-semibold">
          Config
        </Txt>
      </div>

      <ScrollArea className="min-h-0" viewPortClassName="h-full" mask={{ top: false }}>
        {!isCollapsed && <AgentOverviewSections agentId={agentId} />}
      </ScrollArea>
    </Card>
  );
}

function AgentOverviewSections({ agentId }: AgentOverviewPanelProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const { mutate: reorderModelList } = useReorderModelList(agentId);
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList(agentId);
  const { isCmsAvailable, isLoading: isCmsLoading } = useIsCmsAvailable();
  const { data: channelPlatforms } = useChannelPlatforms();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4" data-testid="agent-overview-panel-skeleton">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-16" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!agent) {
    return (
      <Txt variant="ui-md" className="text-neutral3 p-4">
        Agent not found
      </Txt>
    );
  }

  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.keys(networkAgentsMap).map(key => ({ ...networkAgentsMap[key], id: key }));
  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);
  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));
  const skills = agent.skills ?? [];
  const workspaceTools = agent.workspaceTools ?? [];
  const browserTools = agent.browserTools ?? [];
  const inputProcessors = agent.inputProcessors ?? [];
  const outputProcessors = agent.outputProcessors ?? [];
  const hasChannels = Boolean(channelPlatforms?.length);

  return (
    <>
      {agent.modelList && (
        <AgentMetadataSection title="Models" accent="blue" icon={<Boxes />}>
          <AgentMetadataModelList
            modelList={agent.modelList}
            updateModelInModelList={updateModelInModelList}
            reorderModelList={reorderModelList}
          />
        </AgentMetadataSection>
      )}

      {networkAgents.length > 0 && (
        <AgentMetadataSection
          title="Agents"
          count={networkAgents.length}
          accent="green"
          icon={<Bot />}
          hint={{ link: 'https://mastra.ai/en/docs/agents/overview', title: 'Agents documentation' }}
        >
          <AgentMetadataNetworkList agents={networkAgents} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Tools"
        count={tools.length}
        accent="amber"
        icon={<Wrench />}
        hint={{
          link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
          title: 'Using Tools and MCP documentation',
        }}
      >
        <AgentMetadataToolList tools={tools} agentId={agentId} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Workflows"
        count={workflows.length}
        accent="blue"
        icon={<Workflow />}
        hint={{ link: 'https://mastra.ai/en/docs/workflows/overview', title: 'Workflows documentation' }}
      >
        <AgentMetadataWorkflowList workflows={workflows} />
      </AgentMetadataSection>

      {workspaceTools.length > 0 && (
        <AgentMetadataSection
          title="Workspace Tools"
          count={workspaceTools.length}
          accent="green"
          icon={<Folder />}
          hint={{
            link: 'https://mastra.ai/en/reference/workspace/workspace-class#agent-tools',
            title: 'Workspace tools documentation',
          }}
        >
          <AgentMetadataWorkspaceToolsList tools={workspaceTools} />
        </AgentMetadataSection>
      )}

      {browserTools.length > 0 && (
        <AgentMetadataSection
          title="Browser Tools"
          count={browserTools.length}
          accent="cyan"
          icon={<Globe />}
          hint={{
            link: 'https://mastra.ai/en/docs/agents/adding-browser-control',
            title: 'Browser tools documentation',
          }}
        >
          <AgentMetadataBrowserToolsList tools={browserTools} />
        </AgentMetadataSection>
      )}

      {(inputProcessors.length > 0 || outputProcessors.length > 0) && (
        <AgentMetadataSection
          title="Processors"
          accent="orange"
          icon={<Cpu />}
          hint={{ link: 'https://mastra.ai/docs/agents/processors', title: 'Processors documentation' }}
        >
          <AgentMetadataCombinedProcessorList inputProcessors={inputProcessors} outputProcessors={outputProcessors} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Skills"
        count={skills.length}
        accent="purple"
        icon={<Sparkles />}
        hint={{ link: 'https://mastra.ai/en/docs/workspace/skills', title: 'Skills documentation' }}
      >
        <AgentMetadataSkillList skills={skills} agentId={agentId} workspaceId={agent.workspaceId} />
      </AgentMetadataSection>

      <AgentMetadataSection title="Scorers" accent="pink" icon={<Gauge />}>
        <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" />
      </AgentMetadataSection>
      <AgentMetadataSection title="Memory" accent="purple" icon={<Brain />}>
        <AgentMemoryConfig agentId={agentId} />
      </AgentMetadataSection>

      {hasChannels && (
        <AgentMetadataSection title="Channels" accent="cyan" icon={<Radio />}>
          <AgentChannels agentId={agentId} />
        </AgentMetadataSection>
      )}

      <AgentSystemPrompt instructions={extractPrompt(agent.instructions)}>
        {!isCmsLoading && !isCmsAvailable && (
          <Notice variant="warning" title="Read-only">
            <Notice.Message>
              To edit the system prompt in Studio, add <code className="font-medium">@mastra/editor</code> to your
              project. See the{' '}
              <a
                href="https://mastra.ai/docs/editor/overview"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                documentation
              </a>
              .
            </Notice.Message>
          </Notice>
        )}
      </AgentSystemPrompt>
    </>
  );
}
