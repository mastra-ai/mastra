import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useEntityRequestContext } from '@mastra/playground-ui/domains/request-context/hooks/use-entity-request-context';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import {
  useAgent,
  useReorderModelList,
  useUpdateModelInModelList,
  useChannelPlatforms,
} from '@mastra/react/hooks/agents';
import { Boxes, Brain, Cpu, Folder, Gauge, Globe, Radio, Sparkles, Workflow, Wrench } from 'lucide-react';
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
import { AgentNetworkCards, AgentProcessorCards, AgentSkillCards } from '../agent-resource-cards';
import { AgentMemoryConfig } from '../agent-settings/agent-memory-config';
import { AgentToolCards } from '../agent-tool-cards';
import { AgentSystemPrompt } from './agent-system-prompt';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';

export function AgentOverviewSections({
  agentId,
  section,
  detailed = false,
}: {
  agentId: string;
  section?: string;
  detailed?: boolean;
}) {
  const { data: agent, isLoading } = useAgent({
    agentId: agentId,
    requestContext: useEntityRequestContext('agent', agentId)[0],
    queryOptions: { enabled: Boolean(agentId) },
  });
  const { mutate: reorderModelList } = useReorderModelList({ agentId: agentId });
  const { mutateAsync: updateModelInModelList } = useUpdateModelInModelList({ agentId: agentId });
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
      <Txt variant="body" tone="muted" className="p-4">
        Agent not found
      </Txt>
    );
  }

  const show = (name: string) => !section || section === name;
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
      {section === 'models' && !agent.modelList && (
        <AgentMetadataSection title="Model" accent="blue" icon={<Boxes />}>
          <Txt>{agent.modelId || 'Dynamic model'}</Txt>
          <Txt variant="caption" tone="muted">
            {agent.provider}
          </Txt>
        </AgentMetadataSection>
      )}
      {section === 'channels' && !hasChannels && (
        <AgentMetadataSection title="Channels" accent="cyan" icon={<Radio />}>
          <Txt tone="muted">No channel platforms configured for this project.</Txt>
        </AgentMetadataSection>
      )}
      {show('models') && agent.modelList && (
        <AgentMetadataSection title="Models" accent="blue" icon={<Boxes />}>
          <AgentMetadataModelList
            modelList={agent.modelList}
            updateModelInModelList={updateModelInModelList}
            reorderModelList={reorderModelList}
          />
        </AgentMetadataSection>
      )}

      {show('agents') && (
        <AgentMetadataSection
          title="Agents"
          count={networkAgents.length}
          accent="green"
          icon={<AgentIcon />}
          hint={{ link: 'https://mastra.ai/en/docs/agents/overview', title: 'Agents documentation' }}
        >
          {detailed ? <AgentNetworkCards agent={agent} /> : <AgentMetadataNetworkList agents={networkAgents} />}
        </AgentMetadataSection>
      )}

      {show('tools') && (
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
          {detailed ? <AgentToolCards tools={tools} /> : <AgentMetadataToolList agentId={agentId} tools={tools} />}
        </AgentMetadataSection>
      )}

      {show('workflows') && (
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

      {show('tools') && workspaceTools.length > 0 && (
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

      {show('tools') && browserTools.length > 0 && (
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

      {show('processors') && (
        <AgentMetadataSection
          title="Processors"
          accent="orange"
          icon={<Cpu />}
          hint={{ link: 'https://mastra.ai/docs/agents/processors', title: 'Processors documentation' }}
        >
          {detailed ? (
            <AgentProcessorCards agent={agent} />
          ) : (
            <AgentMetadataCombinedProcessorList inputProcessors={inputProcessors} outputProcessors={outputProcessors} />
          )}
        </AgentMetadataSection>
      )}

      {show('skills') && (
        <AgentMetadataSection
          title="Skills"
          count={skills.length}
          accent="purple"
          icon={<Sparkles />}
          hint={{ link: 'https://mastra.ai/en/docs/workspace/skills', title: 'Skills documentation' }}
        >
          {detailed ? (
            <AgentSkillCards agent={agent} agentId={agentId} />
          ) : (
            <AgentMetadataSkillList skills={skills} agentId={agentId} workspaceId={agent.workspaceId} />
          )}
        </AgentMetadataSection>
      )}

      {show('scorers') && (
        <AgentMetadataSection title="Scorers" accent="pink" icon={<Gauge />}>
          <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" detailed={detailed} />
        </AgentMetadataSection>
      )}
      {show('memory') && (
        <AgentMetadataSection title="Memory" accent="purple" icon={<Brain />}>
          <AgentMemoryConfig agentId={agentId} />
        </AgentMetadataSection>
      )}

      {show('channels') && hasChannels && (
        <AgentMetadataSection title="Channels" accent="cyan" icon={<Radio />}>
          <AgentChannels agentId={agentId} />
        </AgentMetadataSection>
      )}

      {show('prompt') && (
        <AgentSystemPrompt instructions={extractPrompt(agent.instructions)}>
          {!isCmsLoading && !isCmsAvailable && (
            <Notice variant="warning" title="Read-only">
              <Notice.Message>
                To edit the system prompt in Studio, add <InlineCode>@mastra/editor</InlineCode> to your project. See
                the{' '}
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
      )}
    </>
  );
}
