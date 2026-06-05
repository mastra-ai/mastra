import type { StoredSkillResponse } from '@mastra/client-js';

import { isPlaceholderAgentName } from '../components/agent-starter/utils';
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
  /**
   * The original free-form prompt that seeded the agent through the starter.
   * Used to recognise the auto-truncated placeholder name (e.g.
   * "Build an agent that …") so the snapshot can tell the LLM that
   * `set-agent-name` still needs to be called once with a real name.
   *
   * Undefined when the page was hard-refreshed or the agent was created
   * outside the starter flow; in that case we trust whatever the form holds.
   */
  starterUserMessage?: string;
}

/**
 * Hard cap on the generated `instructions` field. Surfaced to the builder LLM
 * via the empty-instructions directive AND enforced by `useSetAgentInstructionsTool`,
 * which **rejects** over-limit `set-agent-instructions` calls without persisting
 * anything — so a single tool call always stays under the stream output cap
 * (`maxTokens` in `stream-chat-provider.tsx`).
 *
 * The same cap is reused when echoing already-persisted instructions back in
 * the snapshot via the `truncate` helper below: this only trims the display
 * copy, never the stored value. Using a smaller display cap would clip the
 * "persisted, final text" the directive points to and could trick the model
 * into re-calling set-agent-instructions to "restore" the missing tail.
 */
export const MAX_GENERATED_INSTRUCTIONS_CHARS = 4000;
const EMPTY_TEXT = '(empty)';
const NOT_SET_TEXT = '(not set)';

const truncate = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}… [truncated]`;
};

const isFilled = (value: string | undefined): value is string => typeof value === 'string' && value.trim().length > 0;

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

const renderQuoted = (value: string | undefined): string => {
  if (!isFilled(value)) return EMPTY_TEXT;
  return `"${value}"`;
};

const renderInstructions = (value: string | undefined): string => {
  if (!isFilled(value)) return EMPTY_TEXT;
  const truncated = truncate(value, MAX_GENERATED_INSTRUCTIONS_CHARS);
  return `"""\n${truncated}\n"""`;
};

const renderField = (label: string, value: string, directive: string): string => `- ${label}: ${value}\n  ${directive}`;

/**
 * Renders the form's current state plus a per-field directive telling the
 * builder LLM whether to call the corresponding setter. All rules about which
 * setter to call (and when to skip it) live next to the field value the LLM
 * reads. This keeps the contract in a single place — see the agent builder
 * agent's instructions for the rest of the authoring loop.
 */
export function buildFormSnapshotInstructions(
  values: AgentBuilderEditFormValues,
  options: BuildFormSnapshotOptions,
): string {
  const { availableAgentTools, availableSkills, availableWorkspaces, availableModels, features, starterUserMessage } =
    options;

  const lines: string[] = [];
  lines.push('## Current agent configuration (authoritative)');
  lines.push('');
  lines.push(
    'Trust these values as ground truth. Call each setter at most once per turn, with the final value. Do not re-call a setter to confirm a value the snapshot already shows. Skip any field not listed below — its feature is disabled.',
  );
  lines.push('');

  // Name. The starter persists a truncated copy of the user's prompt as a
  // placeholder so the agent has *some* name in the list view. When the
  // current name still matches that placeholder we ask the LLM to replace it
  // with a real name; otherwise we treat any filled value as already set.
  const namePlaceholder = isPlaceholderAgentName(values.name, starterUserMessage);
  if (isFilled(values.name) && !namePlaceholder) {
    lines.push(
      renderField(
        'Name',
        renderQuoted(values.name),
        'Already set. Do not call set-agent-name unless the user explicitly asks to rename the agent.',
      ),
    );
  } else if (namePlaceholder) {
    lines.push(
      renderField(
        'Name',
        `${renderQuoted(values.name)} (auto-generated placeholder from the starter prompt)`,
        'Call set-agent-name once with a real, short, memorable name anchored to the outcome.',
      ),
    );
  } else {
    lines.push(
      renderField('Name', EMPTY_TEXT, 'Call set-agent-name once with a short, memorable name anchored to the outcome.'),
    );
  }

  // Description
  if (isFilled(values.description)) {
    lines.push(
      renderField(
        'Description',
        renderQuoted(values.description),
        'Already set. Do not call set-agent-description unless the user explicitly asks to change it.',
      ),
    );
  } else {
    lines.push(
      renderField(
        'Description',
        EMPTY_TEXT,
        'Call set-agent-description once with one plain-language sentence explaining what the agent helps with.',
      ),
    );
  }

  // Instructions
  if (isFilled(values.instructions)) {
    lines.push(
      renderField(
        'Instructions',
        renderInstructions(values.instructions),
        'Already set (see the """...""" block above — that is the persisted, final text). Do NOT call set-agent-instructions again to refine, tighten, polish, or extend the wording. Re-call only if the user explicitly asks for a change.',
      ),
    );
  } else {
    lines.push(
      renderField(
        'Instructions',
        EMPTY_TEXT,
        'Call set-agent-instructions ONCE with your final, complete system prompt. Keep it concise: target 1,200–2,000 characters, usually 2–4 short paragraphs or compact bullet groups. Include the essentials only: trigger, capabilities, source rules, response format, and completion criteria. Avoid worked examples, FAQs, long edge-case lists, or exhaustive policies unless the user explicitly asks for that depth.',
      ),
    );
  }

  // Model
  if (features.model) {
    if (values.model && values.model.provider && values.model.name) {
      const known = availableModels.find(m => m.provider === values.model!.provider && m.model === values.model!.name);
      const label = `${values.model.provider}/${values.model.name}`;
      const value = known ? label : `${label} (not in available models list)`;
      lines.push(
        renderField(
          'Model',
          value,
          'Already set by the form. Do not call set-agent-model unless the user explicitly asks to change the model.',
        ),
      );
    } else {
      lines.push(
        renderField(
          'Model',
          NOT_SET_TEXT,
          'Call set-agent-model once with a provider/name pair from the available models list. Prefer a strong model for coding/reasoning, a cheaper/faster one for simple high-volume tasks.',
        ),
      );
    }
  }

  // Workspace
  if (isFilled(values.workspaceId)) {
    const workspace = availableWorkspaces.find(w => w.id === values.workspaceId);
    const name = workspace?.name ?? '(unknown)';
    lines.push(
      renderField(
        'Workspace',
        `${renderQuoted(name)} (id: ${values.workspaceId})`,
        'Already set. Do not call set-agent-workspace-id unless the user explicitly asks to change the workspace.',
      ),
    );
  } else {
    lines.push(
      renderField(
        'Workspace',
        NOT_SET_TEXT,
        'Call set-agent-workspace-id only if the agent needs CLI or local-machine actions and a workspace is available.',
      ),
    );
  }

  // Visibility (no setter — informational only).
  lines.push(`- Visibility: ${values.visibility ?? 'private'}`);

  // Browser
  if (features.browser) {
    if (values.browserEnabled === true) {
      lines.push(
        renderField(
          'Browser enabled',
          'true',
          'Already enabled. Do not call set-agent-browser-enabled unless the user explicitly asks to disable it.',
        ),
      );
    } else {
      lines.push(
        renderField(
          'Browser enabled',
          'false',
          'Call set-agent-browser-enabled(true) only if the agent needs to operate a browser.',
        ),
      );
    }
  }

  // Tools
  if (features.tools) {
    const selectedToolIds = new Set([
      ...collectSelectedIds(values.tools),
      ...collectSelectedIds(values.agents),
      ...collectSelectedIds(values.workflows),
    ]);
    const selected = availableAgentTools.filter(t => selectedToolIds.has(t.id));
    if (selected.length === 0) {
      lines.push(
        renderField(
          'Tools',
          '(none selected)',
          'Call set-agent-tools once with the minimum tools/agents/workflows needed for the outcome. Skip if nothing in the catalog applies.',
        ),
      );
    } else {
      lines.push(
        renderField(
          `Tools (${selected.length})`,
          selected.map(renderToolEntry).join(', '),
          'Already configured. Do not call set-agent-tools again unless the requested outcome needs different capabilities.',
        ),
      );
    }
  }

  // Skills
  if (features.skills) {
    const selectedSkillIds = new Set(collectSelectedIds(values.skills));
    const selected = availableSkills.filter(s => selectedSkillIds.has(s.id));
    if (selected.length === 0) {
      lines.push(
        renderField(
          'Skills',
          '(none selected)',
          'Call set-agent-skills once with any stored skills the outcome needs. Use createSkillTool only when no existing skill fits.',
        ),
      );
    } else {
      lines.push(
        renderField(
          `Skills (${selected.length})`,
          selected.map(renderSkillEntry).join(', '),
          'Already configured. Do not call set-agent-skills again unless the outcome needs different operating instructions.',
        ),
      );
    }
  }

  return lines.join('\n');
}
