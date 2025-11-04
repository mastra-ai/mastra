import { Badge } from '@/ds/components/Badge';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { useLinkComponent } from '@/lib/framework';
import { GetAgentResponse, GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { AgentMetadataSection } from './agent-metadata-section';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { AgentMetadataWrapper } from './agent-metadata-wrapper';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { useScorers } from '@/domains/scores';
import { AgentIcon } from '@/ds/icons';
import { AlertTriangleIcon, GaugeIcon } from 'lucide-react';
import { AgentMetadataModelSwitcher, AgentMetadataModelSwitcherProps } from './agent-metadata-model-switcher';
import { AgentMetadataModelList, AgentMetadataModelListProps } from './agent-metadata-model-list';
import { LoadingBadge } from '@/components/assistant-ui/tools/badges/loading-badge';
import { Alert, AlertTitle, AlertDescription } from '@/ds/components/Alert';
import { PromptEnhancer } from '../agent-information/agent-instructions-enhancer';

export interface AgentMetadataProps {
  agentId: string;
  agent: GetAgentResponse;
  hasMemoryEnabled: boolean;
  modelVersion: string;
  updateModel: AgentMetadataModelSwitcherProps['updateModel'];
  resetModel: AgentMetadataModelSwitcherProps['resetModel'];
  updateModelInModelList: AgentMetadataModelListProps['updateModelInModelList'];
  reorderModelList: AgentMetadataModelListProps['reorderModelList'];
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
          <Link href={paths.agentLink(agent.id)} data-testid="agent-badge">
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
  hasMemoryEnabled,
  updateModel,
  resetModel,
  updateModelInModelList,
  reorderModelList,
  modelVersion,
}: AgentMetadataProps) => {
  const networkAgentsMap = agent.agents ?? {};
  const networkAgents = Object.keys(networkAgentsMap).map(key => ({ ...networkAgentsMap[key], id: key }));

  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);

  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));

  return (
    <AgentMetadataWrapper>
      {agent.modelList ? (
        <AgentMetadataSection title="Models">
          <AgentMetadataModelList
            modelList={agent.modelList}
            updateModelInModelList={updateModelInModelList}
            reorderModelList={reorderModelList}
          />
        </AgentMetadataSection>
      ) : (
        <AgentMetadataSection
          title={'Model'}
          hint={
            modelVersion === 'v2'
              ? undefined
              : {
                  link: 'https://mastra.ai/guides/migrations/vnext-to-standard-apis',
                  title: 'You are using a legacy v1 model',
                  icon: <AlertTriangleIcon fontSize={14} className="mb-0.5" />,
                }
          }
        >
          <AgentMetadataModelSwitcher
            defaultProvider={agent.provider}
            defaultModel={agent.modelId}
            updateModel={updateModel}
            resetModel={resetModel}
          />
        </AgentMetadataSection>
      )}

      <AgentMetadataSection
        title="Memory"
        hint={{
          link: 'https://mastra.ai/en/docs/agents/agent-memory',
          title: 'Agent Memory documentation',
        }}
      >
        {hasMemoryEnabled ? (
          <Badge icon={<MemoryIcon />} variant="success" className="font-medium">
            <span className="sr-only">Memory is enabled</span>
            <span aria-hidden="true">On</span>
          </Badge>
        ) : (
          <Alert variant="warning">
            <AlertTitle as="h5">Memory not enabled</AlertTitle>
            <AlertDescription as="p">
              Thread messages will not be stored. To activate memory, see the{' '}
              <a
                href="https://mastra.ai/en/docs/agents/agent-memory"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                documentation
              </a>
              .
            </AlertDescription>
          </Alert>
        )}
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
      <AgentMetadataSection title="System Prompt">
        <PromptEnhancer agentId={agentId} />
      </AgentMetadataSection>
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
          <Link href={paths.agentToolLink(agentId, tool.id)} data-testid="tool-badge">
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
          <Link href={paths.workflowLink(workflow.id)} data-testid="workflow-badge">
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
  const { data: scorers = {}, isLoading } = useScorers();

  const scorerList = Object.keys(scorers)
    .filter(scorerKey => {
      const scorer = scorers[scorerKey];
      if (entityType === 'AGENT') {
        return scorer.agentNames?.includes?.(entityId);
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
          <Link href={paths.scorerLink(scorer.id)} data-testid="scorer-badge">
            <Badge icon={<GaugeIcon className="text-icon3" />}>{scorer.scorer.config.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};
