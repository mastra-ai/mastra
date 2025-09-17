import { Badge } from '@/ds/components/Badge';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { providerMapToIcon } from '../provider-map-icon';
import { useLinkComponent } from '@/lib/framework';
import { GetAgentResponse, GetScorerResponse, GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
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
  agent: GetAgentResponse;
  promptSlot: ReactNode;
  hasMemoryEnabled: boolean;
  computeAgentLink: (agent: { id: string; name: string }) => string;
  computeToolLink: (tool: GetToolResponse) => string;
  computeWorkflowLink: (workflowId: string, workflow: GetWorkflowResponse) => string;
  computeScorerLink: (scorerId: string) => string;
  modelProviders: string[];
  updateModel: AgentMetadataModelSwitcherProps['updateModel'];
}

export interface AgentMetadataNetworkListProps {
  agents: { id: string; name: string }[];
  computeAgentLink: (agent: { id: string; name: string }) => string;
}

export const AgentMetadataNetworkList = ({ agents, computeAgentLink }: AgentMetadataNetworkListProps) => {
  const { Link } = useLinkComponent();

  if (agents.length === 0) {
    return <AgentMetadataListEmpty>No tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {agents.map(agent => (
        <AgentMetadataListItem key={agent.id}>
          <Link href={computeAgentLink(agent)}>
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
  agent,
  promptSlot,
  hasMemoryEnabled,
  computeAgentLink,
  computeToolLink,
  computeWorkflowLink,
  computeScorerLink,
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
          <AgentMetadataNetworkList agents={networkAgents} computeAgentLink={computeAgentLink} />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Tools"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/using-tools-and-mcp',
          title: 'Using Tools and MCP documentation',
        }}
      >
        <AgentMetadataToolList tools={tools} computeToolLink={computeToolLink} />
      </AgentMetadataSection>

      <AgentMetadataSection
        title="Workflows"
        hint={{
          link: 'https://mastra.ai/en/docs/workflows/overview',
          title: 'Workflows documentation',
        }}
      >
        <AgentMetadataWorkflowList workflows={workflows} computeWorkflowLink={computeWorkflowLink} />
      </AgentMetadataSection>

      <AgentMetadataSection title="Scorers">
        <AgentMetadataScorerList entityId={agent.name} entityType="AGENT" computeScorerLink={computeScorerLink} />
      </AgentMetadataSection>
      <AgentMetadataSection title="System Prompt">{promptSlot}</AgentMetadataSection>
    </AgentMetadataWrapper>
  );
};

export interface AgentMetadataToolListProps {
  tools: GetToolResponse[];
  computeToolLink: (tool: GetToolResponse) => string;
}

export const AgentMetadataToolList = ({ tools, computeToolLink }: AgentMetadataToolListProps) => {
  const { Link } = useLinkComponent();

  if (tools.length === 0) {
    return <AgentMetadataListEmpty>No tools</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {tools.map(tool => (
        <AgentMetadataListItem key={tool.id}>
          <Link href={computeToolLink(tool)}>
            <Badge icon={<ToolsIcon className="text-[#ECB047]" />}>{tool.id}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

export interface AgentMetadataWorkflowListProps {
  workflows: Array<{ id: string } & GetWorkflowResponse>;
  computeWorkflowLink: (workflowId: string, workflow: GetWorkflowResponse) => string;
}

export const AgentMetadataWorkflowList = ({ workflows, computeWorkflowLink }: AgentMetadataWorkflowListProps) => {
  const { Link } = useLinkComponent();

  if (workflows.length === 0) {
    return <AgentMetadataListEmpty>No workflows</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {workflows.map(workflow => (
        <AgentMetadataListItem key={workflow.id}>
          <Link href={computeWorkflowLink(workflow.id, workflow)}>
            <Badge icon={<WorkflowIcon className="text-accent3" />}>{workflow.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};

interface AgentMetadataScorerListProps {
  computeScorerLink: (scorerId: string) => string;
  entityId: string;
  entityType: string;
}

export const AgentMetadataScorerList = ({ entityId, entityType, computeScorerLink }: AgentMetadataScorerListProps) => {
  const { Link } = useLinkComponent();
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
          <Link href={computeScorerLink(scorer.id)}>
            <Badge icon={<GaugeIcon className="text-icon3" />}>{scorer.scorer.config.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};
