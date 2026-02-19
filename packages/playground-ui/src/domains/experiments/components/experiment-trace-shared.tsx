import { AgentIcon, ToolsIcon, WorkflowIcon } from '@/ds/icons';
import { BrainIcon } from 'lucide-react';
import { type ExperimentUISpanStyle } from '../types';

export const spanTypePrefixes = ['agent', 'workflow', 'model', 'tool', 'other'];

export function getExperimentSpanTypeUi(type: string): ExperimentUISpanStyle | null {
  const typePrefix = type?.toLowerCase().split('_')[0];

  const spanTypeToUiElements: Record<string, ExperimentUISpanStyle> = {
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
  };

  // Map mcp_tool_call to the tool UI
  const resolvedPrefix = typePrefix === 'mcp' ? 'tool' : typePrefix;

  if (resolvedPrefix in spanTypeToUiElements) {
    return spanTypeToUiElements[resolvedPrefix];
  }

  return {
    typePrefix: 'other',
  };
}
