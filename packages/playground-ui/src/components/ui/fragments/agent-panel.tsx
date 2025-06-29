import { WorkflowIcon } from 'lucide-react';
import { AgentIcon, MemoryIcon, ToolsIcon } from '@/ds/icons';
import { Txt } from '@/ds/components/Txt';
import { PanelSection, PanelBadges, PanelLayout, PanelHeader, PanelContent } from '../elements';

type AgentPanelProps = {
  className?: string;
  style?: React.CSSProperties;
  Link?: any;
  agent?: any; // Replace with actual agent type
  memory?: any; // Replace with actual memory type
};

export function AgentPanel({ agent, memory, className, style, Link }: AgentPanelProps) {
  const toolBadges = Object.entries(agent?.tools ?? {}).map(([toolKey, tool]) => ({
    name: toolKey,
    icon: <ToolsIcon />,
  }));

  const workflowBadges = Object.entries(agent?.workflows ?? {}).map(([workflowKey, workflow]) => ({
    name: workflowKey,
    icon: <WorkflowIcon />,
  }));

  const modelBadges = [
    {
      name: agent?.provider?.split('.')[0],
    },
    { name: agent?.modelId },
  ];

  const memoryBadges = [
    {
      name: memory?.result ? 'Memory is On' : 'Memory is Off',
      icon: <MemoryIcon />,
    },
  ];

  const formattedInstructions = agent?.instructions
    .split('\n')
    .map(line => line.trim())
    .join('\n');

  return (
    <PanelLayout>
      <PanelHeader icon={<AgentIcon />} title={agent?.name} />
      <PanelContent>
        <PanelSection title="Memory" href="https://mastra.ai/en/docs/agents/agent-memory">
          <PanelBadges badges={memoryBadges} />
        </PanelSection>
        <PanelSection title="Model">
          <PanelBadges badges={modelBadges} />
        </PanelSection>
        <PanelSection title="Tools" href="https://mastra.ai/en/docs/agents/using-tools-and-mcp">
          <PanelBadges badges={toolBadges} />
        </PanelSection>
        <PanelSection title="Workflows" href="https://mastra.ai/en/docs/workflows/overview">
          <PanelBadges badges={workflowBadges} />
        </PanelSection>
        <PanelSection title="System prompt">
          <Txt
            as="p"
            variant="ui-md"
            className="bg-surface4 text-icon6 whitespace-pre-wrap rounded-lg px-2 py-1.5 text-sm"
          >
            {formattedInstructions}
          </Txt>
        </PanelSection>
      </PanelContent>
    </PanelLayout>
  );
}
