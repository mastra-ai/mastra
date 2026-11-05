import {
  useAgent,
  useReorderModelList,
  useUpdateModelInModelList,
  useChannelPlatforms,
} from '@mastra/react/hooks/agents';
import { Boxes, Brain, Cpu, Folder, Gauge, Globe, Radio, Sparkles, Workflow, Wrench } from 'lucide-react';
import { useAgentChatSlots } from '../context/agent-chat-slots';
import { AgentMemoryConfig } from './agent-memory-config';
import { AgentSystemPrompt } from './agent-system-prompt';
import {
  AgentMetadataBrowserToolsList,
  AgentMetadataCombinedProcessorList,
  AgentMetadataNetworkList,
  AgentMetadataScorerList,
  AgentMetadataSkillList,
  AgentMetadataToolList,
  AgentMetadataWorkflowList,
  AgentMetadataWorkspaceToolsList,
} from './metadata/agent-metadata-lists';
import { AgentMetadataModelList } from './metadata/agent-metadata-model-list';
import { AgentMetadataSection } from './metadata/agent-metadata-section';
import { extractPrompt } from '@/domains/agents/utils';
import { useEntityRequestContext } from '@/domains/request-context/hooks/use-entity-request-context';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea';
import { Skeleton } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { frameSurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/utils/cn';
import { toast } from '@/utils/toast';

export interface AgentOverviewPanelProps {
  agentId: string;
  /** Skip the sections (and their data fetching) while the host keeps the panel collapsed. */
  collapsed?: boolean;
  /** Sections the host does not support (e.g. a runtime without workflows or scorers). */
  hiddenSections?: AgentOverviewSection[];
}

export type AgentOverviewSection = 'workflows' | 'scorers';

export function AgentOverviewPanel({ agentId, collapsed = false, hiddenSections = [] }: AgentOverviewPanelProps) {
  return (
    <div
      data-testid="agent-overview-panel"
      className={cn('grid h-full min-h-0 grid-rows-[auto_1fr] overflow-hidden rounded-studio-frame', frameSurfaceStyle)}
    >
      {/* The header route action owns the close control (see AgentDetailHeaderActions). */}
      <div className="flex h-10 min-h-10 items-center border-b border-border px-4">
        <Txt as="h2" variant="subheading" tone="ink">
          Config
        </Txt>
      </div>

      <ScrollArea className="min-h-0" mask={{ top: false }}>
        <ScrollAreaViewport className="h-full">
          {!collapsed && <AgentOverviewSections agentId={agentId} hiddenSections={hiddenSections} />}
        </ScrollAreaViewport>
      </ScrollArea>
    </div>
  );
}

function AgentOverviewSections({
  agentId,
  hiddenSections,
}: {
  agentId: string;
  hiddenSections: AgentOverviewSection[];
}) {
  const { OverviewModelList, OverviewModelsActions, OverviewChannels, SystemPromptNotice } = useAgentChatSlots();
  const { data: agent, isLoading } = useAgent({
    agentId: agentId,
    version: { status: 'draft' },
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { mutateAsync: reorderModelList } = useReorderModelList({ agentId: agentId });
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList({ agentId: agentId });

  const reportModelListError = (error: Error & { body?: { error?: string } }) => {
    toast.error(error.body?.error || error.message || 'Failed to update model list');
  };

  const handleReorderModelList = async (params: Parameters<typeof reorderModelList>[0]) => {
    try {
      return await reorderModelList(params);
    } catch (error) {
      reportModelListError(error as Error & { body?: { error?: string } });
      throw error;
    }
  };

  const handleUpdateModelInModelList = async (params: Parameters<typeof updateModelInModelList>[0]) => {
    try {
      return await updateModelInModelList(params);
    } catch (error) {
      reportModelListError(error as Error & { body?: { error?: string } });
      throw error;
    }
  };

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
      <Txt variant="body" tone="muted" className="p-4">
        Agent not found
      </Txt>
    );
  }

  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.entries(networkAgentsMap).map(([key, value]) => ({ ...value, id: key }));
  const agentTools = agent.tools ?? {};
  const tools = Object.values(agentTools);
  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.entries(agentWorkflows).map(([key, value]) => ({ id: key, ...value }));
  const skills = agent.skills ?? [];
  const workspaceTools = agent.workspaceTools ?? [];
  const browserTools = agent.browserTools ?? [];
  const inputProcessors = agent.inputProcessors ?? [];
  const outputProcessors = agent.outputProcessors ?? [];
  const hasChannels = Boolean(OverviewChannels && channelPlatforms?.length);

  return (
    <>
      {agent.modelList && (
        <AgentMetadataSection
          title="Models"
          accent="blue"
          icon={<Boxes />}
          actions={OverviewModelsActions ? <OverviewModelsActions /> : undefined}
        >
          {OverviewModelList ? (
            <OverviewModelList
              agentId={agentId}
              modelList={agent.modelList}
              editable={agent.modelListEditable !== false}
              fallback={
                <AgentMetadataModelList
                  modelList={agent.modelList}
                  editable={agent.modelListEditable !== false}
                  updateModelInModelList={handleUpdateModelInModelList}
                  reorderModelList={handleReorderModelList}
                />
              }
            />
          ) : (
            <AgentMetadataModelList
              modelList={agent.modelList}
              editable={agent.modelListEditable !== false}
              updateModelInModelList={handleUpdateModelInModelList}
              reorderModelList={handleReorderModelList}
            />
          )}
        </AgentMetadataSection>
      )}

      {networkAgents.length > 0 && (
        <AgentMetadataSection
          title="Agents"
          count={networkAgents.length}
          accent="green"
          icon={<AgentIcon />}
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
        <AgentMetadataToolList agentId={agentId} tools={tools} />
      </AgentMetadataSection>

      {!hiddenSections.includes('workflows') && (
        <AgentMetadataSection
          title="Workflows"
          count={workflows.length}
          accent="blue"
          icon={<Workflow />}
          hint={{ link: 'https://mastra.ai/en/docs/workflows/overview', title: 'Workflows documentation' }}
        >
          <AgentMetadataWorkflowList workflows={workflows} />
        </AgentMetadataSection>
      )}

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

      {!hiddenSections.includes('scorers') && (
        <AgentMetadataSection title="Scorers" accent="pink" icon={<Gauge />}>
          <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" />
        </AgentMetadataSection>
      )}
      <AgentMetadataSection title="Memory" accent="purple" icon={<Brain />}>
        <AgentMemoryConfig agentId={agentId} />
      </AgentMetadataSection>

      {hasChannels && (
        <AgentMetadataSection title="Channels" accent="cyan" icon={<Radio />}>
          {OverviewChannels && <OverviewChannels agentId={agentId} />}
        </AgentMetadataSection>
      )}

      <AgentSystemPrompt instructions={extractPrompt(agent.instructions)}>
        {SystemPromptNotice && <SystemPromptNotice />}
      </AgentSystemPrompt>
    </>
  );
}
