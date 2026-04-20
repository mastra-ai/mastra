import { AgentIcon, FolderIcon, McpServerIcon, MemoryIcon, ToolsIcon, WorkflowIcon } from '@mastra/playground-ui';
import { BrainIcon } from 'lucide-react';
import type { UISpanStyle } from '../types';

export const spanTypePrefixes = ['agent', 'workflow', 'model', 'mcp', 'tool', 'memory', 'workspace', 'other'];

const spanTypeToUiElements: Record<string, UISpanStyle> = {
  agent: {
    icon: <AgentIcon />,
    color: 'oklch(0.75 0.15 250)',
    label: 'Agent',
    bgColor: 'oklch(0.75 0.15 250 / 0.1)',
    typePrefix: 'agent',
  },
  workflow: {
    icon: <WorkflowIcon />,
    color: 'oklch(0.75 0.15 200)',
    label: 'Workflow',
    bgColor: 'oklch(0.75 0.15 200 / 0.1)',
    typePrefix: 'workflow',
  },
  model: {
    icon: <BrainIcon />,
    color: 'oklch(0.75 0.15 320)',
    label: 'Model',
    bgColor: 'oklch(0.75 0.15 320 / 0.1)',
    typePrefix: 'model',
  },
  mcp: {
    icon: <McpServerIcon />,
    color: 'oklch(0.75 0.15 160)',
    label: 'MCP',
    bgColor: 'oklch(0.75 0.15 160 / 0.1)',
    typePrefix: 'mcp',
  },
  tool: {
    icon: <ToolsIcon />,
    color: 'oklch(0.75 0.15 100)',
    label: 'Tool',
    bgColor: 'oklch(0.75 0.15 100 / 0.1)',
    typePrefix: 'tool',
  },
  memory: {
    icon: <MemoryIcon />,
    color: 'oklch(0.75 0.15 60)',
    label: 'Memory',
    bgColor: 'oklch(0.75 0.15 60 / 0.1)',
    typePrefix: 'memory',
  },
  workspace: {
    icon: <FolderIcon />,
    color: 'oklch(0.75 0.15 40)',
    label: 'Workspace',
    bgColor: 'oklch(0.75 0.15 40 / 0.1)',
    typePrefix: 'workspace',
  },
};

const otherSpanType: UISpanStyle = {
  color: 'oklch(0.65 0 0)',
  label: 'Other',
  typePrefix: 'other',
};

export function getSpanTypeUi(type: string) {
  const typePrefix = type?.toLowerCase().split('_')[0];
  return spanTypeToUiElements[typePrefix] ?? otherSpanType;
}
