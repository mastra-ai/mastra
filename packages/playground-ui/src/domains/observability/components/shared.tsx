import { AgentIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { BrainIcon, CircleIcon } from 'lucide-react';

export const spanTypePrefixes = ['agent', 'workflow', 'model', 'tool', 'other'];

export function getSpanTypeUi(type: string) {
  const typePrefix = type?.toLowerCase().split('_')[0];

  const spanTypeToUiElements: Record<
    (typeof spanTypePrefixes)[number],
    { icon: React.ReactNode; color: string; label: string; bgColor?: string; typePrefix: string }
  > = {
    agent: {
      icon: <AgentIcon />,
      color: 'oklch(0.75 0.15 250)',
      label: 'Agent',
      bgColor: 'bg-oklch(0.75 0.15 250 / 0.1)',
      typePrefix: 'agent',
    },
    workflow: {
      icon: <WorkflowIcon />,
      color: 'oklch(0.75 0.15 200)',
      label: 'Workflow',
      bgColor: 'bg-oklch(0.75 0.15 200 / 0.1)',
      typePrefix: 'workflow',
    },
    model: {
      icon: <BrainIcon />,
      color: 'oklch(0.75 0.15 320)',
      label: 'Model',
      bgColor: 'bg-oklch(0.75 0.15 320 / 0.1)',
      typePrefix: 'model',
    },
    tool: {
      icon: <ToolsIcon />,
      color: 'oklch(0.75 0.15 100)',
      label: 'Tool',
      bgColor: 'bg-oklch(0.75 0.15 100 / 0.1)',
      typePrefix: 'tool',
    },
    other: {
      icon: <CircleIcon />,
      color: 'oklch(0.5 0 0)',
      label: 'Other',
      bgColor: 'bg-oklch(0.5 0 0 / 0.1)',
      typePrefix: 'other',
    },
  };

  if (typePrefix in spanTypeToUiElements) {
    return spanTypeToUiElements[typePrefix];
  }

  return null;
}
