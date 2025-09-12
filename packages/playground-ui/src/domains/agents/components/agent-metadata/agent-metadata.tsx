import { Badge } from '@/ds/components/Badge';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { providerMapToIcon } from '../provider-map-icon';
import { useLinkComponent } from '@/lib/framework';
import { GetAgentResponse, GetToolResponse, GetWorkflowResponse } from '@mastra/client-js';
import { AgentMetadataSection } from './agent-metadata-section';
import { AgentMetadataList, AgentMetadataListEmpty, AgentMetadataListItem } from './agent-metadata-list';
import { AgentMetadataWrapper } from './agent-metadata-wrapper';
import { ReactNode } from 'react';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';
import { ScorerList } from '@/domains/scores';
import { AgentMetadataModelSwitcher, AgentMetadataModelSwitcherProps } from './agent-metadata-model-switcher';

export interface AgentMetadataProps {
  agent: GetAgentResponse;
  promptSlot: ReactNode;
  hasMemoryEnabled: boolean;
  computeToolLink: (tool: GetToolResponse) => string;
  computeWorkflowLink: (workflowId: string, workflow: GetWorkflowResponse) => string;
  modelProviders: string[];
  updateModel: AgentMetadataModelSwitcherProps['updateModel'];
}

export const AgentMetadata = ({
  agent,
  promptSlot,
  hasMemoryEnabled,
  computeToolLink,
  computeWorkflowLink,
  updateModel,
  modelProviders,
}: AgentMetadataProps) => {
  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);

  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => ({ id: key, ...agentWorkflows[key] }));

  return (
    <AgentMetadataWrapper>
      <AgentMetadataSection title="Model">
        <AgentMetadataModelSwitcher
          defaultProvider={agent.provider}
          defaultModel={agent.modelId}
          updateModel={updateModel}
          modelProviders={modelProviders}
        />
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
        <AgentMetadataScorerList entityId={agent.name} />
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

export const AgentMetadataScorerList = ({ entityId }: { entityId: string }) => {
  return (
    <div className="px-5 pb-5">
      <ScorerList entityId={entityId} entityType="AGENT" />
    </div>
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
