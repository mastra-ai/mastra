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
    color: 'var(--span-agent)',
    label: 'Agent',
    typePrefix: 'agent',
  },
  workflow: {
    icon: <WorkflowIcon />,
    color: 'var(--span-workflow)',
    label: 'Workflow',
    typePrefix: 'workflow',
  },
  model: {
    icon: <BrainIcon />,
    color: 'var(--span-model)',
    label: 'Model',
    typePrefix: 'model',
  },
  mcp: {
    icon: <McpServerIcon />,
    color: 'var(--span-mcp)',
    label: 'MCP',
    typePrefix: 'mcp',
  },
  tool: {
    icon: <ToolsIcon />,
    color: 'var(--span-tool)',
    label: 'Tool',
    typePrefix: 'tool',
  },
  provider: {
    icon: <ToolsIcon />,
    color: 'var(--span-provider)',
    label: 'Provider Tool',
    typePrefix: 'provider',
  },
  memory: {
    icon: <MemoryIcon />,
    color: 'var(--span-memory)',
    label: 'Memory',
    typePrefix: 'memory',
  },
  workspace: {
    icon: <FolderIcon />,
    color: 'var(--span-workspace)',
    label: 'Workspace',
    typePrefix: 'workspace',
  },
  skill: {
    icon: <SkillIcon />,
    color: 'var(--span-skill)',
    label: 'Skill',
    typePrefix: 'skill',
  },
  scorer: {
    icon: <GaugeIcon />,
    color: 'var(--span-scorer)',
    label: 'Scorer',
    typePrefix: 'scorer',
  },
};

const otherSpanType: UISpanStyle = {
  color: 'var(--span-other)',
  label: 'Other',
  typePrefix: 'other',
};

export function getSpanTypeUi(type: string) {
  const typePrefix = type?.toLowerCase().split('_')[0] ?? '';
  return spanTypeToUiElements[typePrefix] ?? otherSpanType;
}
