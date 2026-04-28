import type { StoredSkillResponse } from '@mastra/client-js';
import type { useBuilderAgentFeatures } from '../../hooks/use-builder-agent-features';
import type { AgentTool } from '../../types/agent-tool';

interface AvailableWorkspace {
  id: string;
  name: string;
}

type Features = ReturnType<typeof useBuilderAgentFeatures>;

export function buildAgentBuilderToolDescription(
  features: Features,
  availableAgentTools: AgentTool[],
  availableWorkspaces: AvailableWorkspace[],
  availableSkills: StoredSkillResponse[] = [],
): string {
  const skillsAvailable = features.skills && availableSkills.length > 0;

  const descriptionParts = ['name', 'description', 'instructions'];
  if (features.tools) descriptionParts.push('tools');
  if (skillsAvailable) descriptionParts.push('skills');
  descriptionParts.push('workspaceId');

  const availableToolsBlock =
    features.tools && availableAgentTools.length > 0
      ? `\n\nAvailable tools (use these ids in the "tools" field):\n${availableAgentTools
          .map(t => `- ${t.id}${t.description ? `: ${t.description}` : ''}`)
          .join('\n')}`
      : '';

  const availableSkillsBlock = skillsAvailable
    ? `\n\nAvailable skills (use these ids in the "skills" field):\n${availableSkills
        .map(s => `- ${s.id}${s.description ? `: ${s.description}` : ''}`)
        .join('\n')}`
    : '';

  const availableWorkspacesBlock =
    availableWorkspaces.length > 0
      ? `\n\nAvailable workspaces (use these ids in the "workspaceId" field):\n${availableWorkspaces
          .map(w => `- ${w.id}: ${w.name}`)
          .join('\n')}`
      : '';

  const toolsGuidance = features.tools
    ? ' When enabling tools, each entry in `tools` MUST include both `id` (from the available tools list) and `name` (a concise Title Case display label, e.g. "Web Search"). The `name` is shown to the user in chat.'
    : '';

  const skillsGuidance = skillsAvailable
    ? ' When enabling skills, each entry in `skills` MUST include both `id` (from the available skills list) and `name` (a concise Title Case display label). The `name` is shown to the user in chat.'
    : '';

  return `Modify the agent configuration that the user is building. Supported fields: ${descriptionParts.join(', ')}.${toolsGuidance}${skillsGuidance}${availableToolsBlock}${availableSkillsBlock}${availableWorkspacesBlock}`;
}
