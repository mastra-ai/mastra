import type { useSidebarDescriptions } from './use-sidebar-descriptions';

export interface AgentCmsSection {
  name: string;
  pathSuffix: string;
  descriptionKey: keyof ReturnType<typeof useSidebarDescriptions>;
  required: boolean;
}

export const AGENT_CMS_SECTIONS: AgentCmsSection[] = [
  { name: 'Identity', pathSuffix: '', descriptionKey: 'identity', required: true },
  { name: 'Instructions', pathSuffix: '/instruction-blocks', descriptionKey: 'instructions', required: true },
  { name: 'Tools', pathSuffix: '/tools', descriptionKey: 'tools', required: false },
  { name: 'Agents', pathSuffix: '/agents', descriptionKey: 'agents', required: false },
  { name: 'Scorers', pathSuffix: '/scorers', descriptionKey: 'scorers', required: false },
  { name: 'Workflows', pathSuffix: '/workflows', descriptionKey: 'workflows', required: false },
  { name: 'Skills', pathSuffix: '/skills', descriptionKey: 'skills', required: false },
  { name: 'Memory', pathSuffix: '/memory', descriptionKey: 'memory', required: false },
  { name: 'Variables', pathSuffix: '/variables', descriptionKey: 'variables', required: false },
];
