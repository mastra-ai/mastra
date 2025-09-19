import { Badge } from '@/ds/components/Badge';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { providerMapToIcon } from '../provider-map-icon';
import { useLinkComponent } from '@/lib/framework';
import { GetAgentResponse, GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { AgentMetadataSection } from './agent-metadata-section';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { AgentMetadataWrapper } from './agent-metadata-wrapper';
import { ReactNode, useState } from 'react';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { useScorers } from '@/domains/scores';
import { AgentIcon, Icon } from '@/ds/icons';
import { EditIcon, GaugeIcon } from 'lucide-react';
import { AgentMetadataModelSwitcher, AgentMetadataModelSwitcherProps } from './agent-metadata-model-switcher';
import { LoadingBadge } from '@/components/assistant-ui/tools/badges/loading-badge';

export interface AgentMetadataProps {
  agentId: string;
  agent: GetAgentResponse;
  promptSlot: ReactNode;
  hasMemoryEnabled: boolean;
  modelProviders: string[];
  updateModel: AgentMetadataModelSwitcherProps['updateModel'];
}

export interface AgentMetadataNetworkListProps {
  agents: { id: string; name: string }[];
}

export const AgentMetadataNetworkList = ({ agents }: AgentMetadataNetworkListProps) => {
  const { Link, paths } = useLinkComponent();

  if (agents.length === 0) {
    return <AgentMetadataListEmpty>No agents</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {agents.map(agent => (
        <AgentMetadataListItem key={agent.id}>
          <Link href={paths.agentLink(agent.id)}>
            <Badge variant="success" icon={<AgentIcon />}>
              {agent.name}
            </Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

export const AgentMetadata = ({
  agentId,
  agent,
  promptSlot,
  hasMemoryEnabled,
  updateModel,
  modelProviders,
}: AgentMetadataProps) => {
  const [isEditingModel, setIsEditingModel] = useState(false);
  const providerIcon = providerMapToIcon[(agent.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.values(networkAgentsMap);

  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);

  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));

  return (
    <AgentMetadataWrapper>
      <AgentMetadataSection title="Model">
        {isEditingModel ? (
          <AgentMetadataModelSwitcher
            defaultProvider={agent.provider}
            defaultModel={agent.modelId}
            updateModel={updateModel}
            closeEditor={() => setIsEditingModel(false)}
            modelProviders={modelProviders}
          />
        ) : (
          <div className="flex items-center gap-2">
            <Badge icon={providerIcon} className="font-medium">
              {agent.modelId || 'N/A'}
            </Badge>
            <button
              title="Edit model"
              type="button"
              onClick={() => setIsEditingModel(true)}
              className="text-icon3 hover:text-icon6"
            >
              <Icon>
                <EditIcon />
              </Icon>
            </button>
          </div>
        )}
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Memory"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/agent-memory',
          title: 'Agent Memory documentation',
        }}
      >
        <Badge icon={<MemoryIcon />} variant={hasMemoryEnabled ? 'success' : 'error'} className="font-medium">
          {hasMemoryEnabled ? 'On' : 'Off'}
        </Badge>
      </AgentMetadataSection>

      {networkAgents.length > 0 && (
        <AgentMetadataSection
          title="Agents"
          hint={{
            link: 'https://mastra.ai/en/docs/agents/overview',
            title: 'Agents documentation',
          }}
        >
          <AgentMetadataNetworkList agents={networkAgents} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Tools"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
          title: 'Using Tools and MCP documentation',
        }}
      >
        <AgentMetadataToolList tools={tools} agentId={agentId} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Workflows"
        hint={{
          link: 'https://mastra.ai/en/docs/workflows/overview',
          title: 'Workflows documentation',
        }}
      >
        <AgentMetadataWorkflowList workflows={workflows} />
      </AgentMetadataSection>

      <AgentMetadataSection title="Scorers">
        <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" />
      </AgentMetadataSection>
      <AgentMetadataSection title="System Prompt">{promptSlot}</AgentMetadataSection>
    </AgentMetadataWrapper>
  );
};

export interface AgentMetadataToolListProps {
  tools: GetToolResponse[];
  agentId: string;
}

export const AgentMetadataToolList = ({ tools, agentId }: AgentMetadataToolListProps) => {
  const { Link, paths } = useLinkComponent();

  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {tools.map(tool => (
        <AgentMetadataListItem key={tool.id}>
          <Link href={paths.agentToolLink(agentId, tool.id)}>
            <Badge icon={<ToolsIcon className="text-[#ECB047]" />}>{tool.id}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

export interface AgentMetadataWorkflowListProps {
  workflows: Array<{ id: string } & GetWorkflowResponse>;
}

export const AgentMetadataWorkflowList = ({ workflows }: AgentMetadataWorkflowListProps) => {
  const { Link, paths } = useLinkComponent();

  if (workflows.length === 0) {
    return <AgentMetadataListEmpty>No workflows</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {workflows.map(workflow => (
        <AgentMetadataListItem key={workflow.id}>
          <Link href={paths.workflowLink(workflow.id)}>
            <Badge icon={<WorkflowIcon className="text-accent3" />}>{workflow.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

interface AgentMetadataScorerListProps {
  entityId: string;
  entityType: string;
}

export const AgentMetadataScorerList = ({ entityId, entityType }: AgentMetadataScorerListProps) => {
  const { Link, paths } = useLinkComponent();
  const { scorers, isLoading } = useScorers();

  const scorerList = Object.keys(scorers)
    .filter(scorerKey => {
      const scorer = scorers[scorerKey];
      if (entityType === 'AGENT') {
        return scorer.agentIds.includes(entityId);
      }

      return scorer.workflowIds.includes(entityId);
    })
    .map(scorerKey => ({ ...scorers[scorerKey], id: scorerKey }));

  if (isLoading) {
    return <LoadingBadge />;
  }

  if (scorerList.length === 0) {
    return <AgentMetadataListEmpty>No Scorers</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {scorerList.map(scorer => (
        <AgentMetadataListItem key={scorer.id}>
          <Link href={paths.scorerLink(scorer.id)}>
            <Badge icon={<GaugeIcon className="text-icon3" />}>{scorer.scorer.config.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};
