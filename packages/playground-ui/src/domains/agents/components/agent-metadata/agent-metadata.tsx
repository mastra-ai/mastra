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

export interface AgentMetadataProps {
  agent: GetAgentResponse;
  promptSlot: ReactNode;
  hasMemoryEnabled: boolean;
  computeToolLink: (tool: GetToolResponse) => string;
  computeWorkflowLink: (workflow: GetWorkflowResponse) => string;
}

export const AgentMetadata = ({
  agent,
  promptSlot,
  hasMemoryEnabled,
  computeToolLink,
  computeWorkflowLink,
}: AgentMetadataProps) => {
  const providerIcon = providerMapToIcon[(agent.provider || 'openai.chat') as keyof typeof providerMapToIcon];

  const agentTools = agent.tools ?? {};
  const tools = Object.keys(agentTools).map(key => agentTools[key]);

  const agentWorkflows = agent.workflows ?? {};
  const workflows = Object.keys(agentWorkflows).map(key => agentWorkflows[key]);

  return (
    <AgentMetadataWrapper>
      <AgentMetadataSection title="Model">
        <Badge icon={providerIcon} className="font-medium">
          {agent.modelId || 'N/A'}
        </Badge>
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
  workflows: GetWorkflowResponse[];
  computeWorkflowLink: (workflow: GetWorkflowResponse) => string;
}

export const AgentMetadataWorkflowList = ({ workflows, computeWorkflowLink }: AgentMetadataWorkflowListProps) => {
  const { Link } = useLinkComponent();

  if (workflows.length === 0) {
    return <AgentMetadataListEmpty>No workflows</AgentMetadataListEmpty>;
  }

  return (
    <AgentMetadataList>
      {workflows.map(workflow => (
        <AgentMetadataListItem key={workflow.name}>
          <Link href={computeWorkflowLink(workflow)}>
            <Badge icon={<WorkflowIcon className="text-accent3" />}>{workflow.name}</Badge>
          </Link>
        </AgentMetadataListItem>
      ))}
    </AgentMetadataList>
  );
};
