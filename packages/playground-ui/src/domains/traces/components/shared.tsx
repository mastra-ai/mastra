import { BrainIcon, GaugeIcon } from 'lucide-react';
import type { UISpanStyle } from '../types';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { FolderIcon } from '@/ds/icons/FolderIcon';
import { McpServerIcon } from '@/ds/icons/McpServerIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

export const spanTypePrefixes = ['agent', 'workflow', 'model', 'mcp', 'tool', 'memory', 'workspace', 'scorer', 'other'];

const spanTypeToUiElements: Record<string, UISpanStyle> = {
  agent: {
    icon: <AgentIcon />,
    color: 'oklch(0.75 0.15 250)',
    label: 'Agent',
    typePrefix: 'agent',
  },
  workflow: {
    icon: <WorkflowIcon />,
    color: 'oklch(0.75 0.15 200)',
    label: 'Workflow',
    typePrefix: 'workflow',
  },
  model: {
    icon: <BrainIcon />,
    color: 'oklch(0.75 0.15 320)',
    label: 'Model',
    typePrefix: 'model',
  },
  mcp: {
    icon: <McpServerIcon />,
    color: 'oklch(0.75 0.15 160)',
    label: 'MCP',
    typePrefix: 'mcp',
  },
  tool: {
    icon: <ToolsIcon />,
    color: 'oklch(0.75 0.15 100)',
    label: 'Tool',
    typePrefix: 'tool',
  },
  memory: {
    icon: <MemoryIcon />,
    color: 'oklch(0.75 0.15 60)',
    label: 'Memory',
    typePrefix: 'memory',
  },
  workspace: {
    icon: <FolderIcon />,
    color: 'oklch(0.75 0.15 40)',
    label: 'Workspace',
    typePrefix: 'workspace',
  },
  scorer: {
    icon: <GaugeIcon />,
    color: 'oklch(0.75 0.15 280)',
    label: 'Scorer',
    typePrefix: 'scorer',
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
