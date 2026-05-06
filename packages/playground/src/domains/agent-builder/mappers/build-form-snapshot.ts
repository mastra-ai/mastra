import type { StoredSkillResponse } from '@mastra/client-js';

import type { useBuilderAgentFeatures } from '../hooks/use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import type { ModelInfo } from '@/domains/llm';

export interface AvailableWorkspaceLike {
  id: string;
  name: string;
}

export interface BuildFormSnapshotOptions {
  availableAgentTools: AgentTool[];
  availableSkills: StoredSkillResponse[];
  availableWorkspaces: AvailableWorkspaceLike[];
  availableModels: ModelInfo[];
  features: ReturnType<typeof useBuilderAgentFeatures>;
}

const INSTRUCTIONS_MAX_CHARS = 1500;
const EMPTY_TEXT = '(empty)';
const NOT_SET_TEXT = '(not set)';

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… [truncated]`;
};

const renderQuoted = (value: string | undefined): string => {
  if (!value || value.length === 0) return EMPTY_TEXT;
  return `"${value}"`;
};

const renderInstructions = (value: string | undefined): string => {
  if (!value || value.length === 0) return EMPTY_TEXT;
  const truncated = truncate(value, INSTRUCTIONS_MAX_CHARS);
  return `"""\n${truncated}\n"""`;
};

const collectSelectedIds = (record: Record<string, boolean | undefined> | undefined): string[] => {
  if (!record) return [];
  const ids: string[] = [];
  for (const [id, selected] of Object.entries(record)) {
    if (selected) ids.push(id);
  }
  return ids;
};

const renderToolEntry = (tool: AgentTool): string => `"${tool.name}" (${tool.id})`;

const renderSkillEntry = (skill: StoredSkillResponse): string => `"${skill.name}" (${skill.id})`;

export function buildFormSnapshotInstructions(
  values: AgentBuilderEditFormValues,
  options: BuildFormSnapshotOptions,
): string {
  const { availableAgentTools, availableSkills, availableWorkspaces, availableModels, features } = options;

  const lines: string[] = [];
  lines.push('## Current agent configuration (read-only context)');
  lines.push('');
  lines.push(
    "The user's form currently has these values. Use them to ground your suggestions: validate, challenge, or refine them rather than asking the user to repeat them.",
  );
  lines.push('');

  lines.push(`- Name: ${renderQuoted(values.name)}`);
  lines.push(`- Description: ${renderQuoted(values.description)}`);
  lines.push(`- Instructions: ${renderInstructions(values.instructions)}`);

  if (features.model) {
    if (values.model && values.model.provider && values.model.name) {
      const known = availableModels.find(m => m.provider === values.model!.provider && m.model === values.model!.name);
      const label = `${values.model.provider}/${values.model.name}`;
      lines.push(`- Model: ${known ? label : `${label} (not in available models list)`}`);
    } else {
      lines.push(`- Model: ${NOT_SET_TEXT}`);
    }
  }

  if (values.workspaceId && values.workspaceId.length > 0) {
    const workspace = availableWorkspaces.find(w => w.id === values.workspaceId);
    const name = workspace?.name ?? '(unknown)';
    lines.push(`- Workspace: "${name}" (id: ${values.workspaceId})`);
  } else {
    lines.push(`- Workspace: ${NOT_SET_TEXT}`);
  }

  lines.push(`- Visibility: ${values.visibility ?? 'private'}`);

  if (features.browser) {
    lines.push(`- Browser enabled: ${values.browserEnabled === true ? 'true' : 'false'}`);
  }

  if (features.tools) {
    const selectedToolIds = new Set([
      ...collectSelectedIds(values.tools),
      ...collectSelectedIds(values.agents),
      ...collectSelectedIds(values.workflows),
    ]);
    const selected = availableAgentTools.filter(t => selectedToolIds.has(t.id));
    if (selected.length === 0) {
      lines.push('- Tools: (none selected)');
    } else {
      lines.push(`- Tools (${selected.length}): ${selected.map(renderToolEntry).join(', ')}`);
    }
  }

  if (features.skills) {
    const selectedSkillIds = new Set(collectSelectedIds(values.skills));
    const selected = availableSkills.filter(s => selectedSkillIds.has(s.id));
    if (selected.length === 0) {
      lines.push('- Skills: (none selected)');
    } else {
      lines.push(`- Skills (${selected.length}): ${selected.map(renderSkillEntry).join(', ')}`);
    }
  }

  return lines.join('\n');
}
