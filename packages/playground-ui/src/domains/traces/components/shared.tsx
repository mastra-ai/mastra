import { BrainIcon, GaugeIcon } from 'lucide-react';
import type { UISpanStyle } from '../types';
import { AgentIcon } from '@/ds/icons/AgentIcon';
import { FolderIcon } from '@/ds/icons/FolderIcon';
import { McpServerIcon } from '@/ds/icons/McpServerIcon';
import { MemoryIcon } from '@/ds/icons/MemoryIcon';
import { SkillIcon } from '@/ds/icons/SkillIcon';
import { ToolsIcon } from '@/ds/icons/ToolsIcon';
import { WorkflowIcon } from '@/ds/icons/WorkflowIcon';

export const spanTypePrefixes = [
  'agent',
  'workflow',
  'model',
  'mcp',
  'tool',
  'provider',
  'memory',
  'workspace',
  'skill',
  'scorer',
  'other',
];

const spanTypeToUiElements: Record<string, UISpanStyle> = {
  agent: {
    icon: <AgentIcon />,
    color: 'var(--chart-4)',
    label: 'Agent',
    typePrefix: 'agent',
  },
  workflow: {
    icon: <WorkflowIcon />,
    color: 'var(--chart-3)',
    label: 'Workflow',
    typePrefix: 'workflow',
  },
  model: {
    icon: <BrainIcon />,
    color: 'var(--chart-5)',
    label: 'Model',
    typePrefix: 'model',
  },
  mcp: {
    icon: <McpServerIcon />,
    color: 'var(--chart-1)',
    label: 'MCP',
    typePrefix: 'mcp',
  },
  tool: {
    icon: <ToolsIcon />,
    color: 'var(--chart-6)',
    label: 'Tool',
    typePrefix: 'tool',
  },
  provider: {
    icon: <ToolsIcon />,
    color: 'var(--chart-2)',
    label: 'Provider Tool',
    typePrefix: 'provider',
  },
  memory: {
    icon: <MemoryIcon />,
    color: 'var(--chart-3)',
    label: 'Memory',
    typePrefix: 'memory',
  },
  workspace: {
    icon: <FolderIcon />,
    color: 'var(--red-9)',
    label: 'Workspace',
    typePrefix: 'workspace',
  },
  skill: {
    icon: <SkillIcon />,
    color: 'var(--chart-1)',
    label: 'Skill',
    typePrefix: 'skill',
  },
  scorer: {
    icon: <GaugeIcon />,
    color: 'var(--chart-5)',
    label: 'Scorer',
    typePrefix: 'scorer',
  },
};

const otherSpanType: UISpanStyle = {
  color: 'var(--text-secondary)',
  label: 'Other',
  typePrefix: 'other',
};

export function getSpanTypeUi(type: string) {
  const typePrefix = type?.toLowerCase().split('_')[0] ?? '';
  return spanTypeToUiElements[typePrefix] ?? otherSpanType;
}
