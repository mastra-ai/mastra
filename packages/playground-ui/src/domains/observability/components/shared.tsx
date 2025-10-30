import { AgentIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { BrainIcon } from 'lucide-react';

export const spanTypePrefixes = ['agent', 'workflow', 'llm', 'tool'];

export function getSpanTypeUi(type: string) {
  const typePrefix = type?.toLowerCase().split('_')[0];

  const spanTypeToUiElements: Record<
    (typeof spanTypePrefixes)[number],
    { icon: React.ReactNode; color: string; label: string }
  > = {
    agent: {
      icon: <AgentIcon />,
      color: 'oklch(0.75 0.15 250)',
      label: 'Agent',
    },
    workflow: {
      icon: <WorkflowIcon />,
      color: 'oklch(0.75 0.15 200)',
      label: 'Workflow',
    },
    llm: {
      icon: <BrainIcon />,
      color: 'oklch(0.75 0.15 320)',
      label: 'LLM',
    },
    tool: {
      icon: <ToolsIcon />,
      color: 'oklch(0.75 0.15 100)',
      label: 'Tool',
    },
  };

  if (typePrefix in spanTypeToUiElements) {
    return spanTypeToUiElements[typePrefix];
  }

  return null;
}
