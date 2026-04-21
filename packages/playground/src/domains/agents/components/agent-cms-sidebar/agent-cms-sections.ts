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

/** Sections available when editing a code-defined agent (override mode) */
const CODE_AGENT_OVERRIDE_SECTION_NAMES = new Set(['Instructions', 'Tools', 'Variables']);

export const CODE_AGENT_OVERRIDE_SECTIONS: AgentCmsSection[] = AGENT_CMS_SECTIONS.filter(s =>
  CODE_AGENT_OVERRIDE_SECTION_NAMES.has(s.name),
);

/**
 * Sections shown while creating a new agent. The Create flow is intentionally
 * simplified — sub-agents, scorers, workflows, and memory are all post-create
 * concerns (or, in the case of memory, inherited from
 * `AgentBuilder.defaultMemoryConfig`). Users configure them from the edit
 * view once the agent exists.
 */
const CREATE_MODE_SECTION_NAMES = new Set(['Identity', 'Instructions', 'Tools', 'Skills']);

export const CREATE_MODE_SECTIONS: AgentCmsSection[] = AGENT_CMS_SECTIONS.filter(s =>
  CREATE_MODE_SECTION_NAMES.has(s.name),
);
