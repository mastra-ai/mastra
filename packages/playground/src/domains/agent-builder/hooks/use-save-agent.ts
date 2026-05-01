import type { StoredSkillResponse, BuilderModelPolicy, DefaultModelEntry } from '@mastra/client-js';
import { toast } from '@mastra/playground-ui';
import { useCallback } from 'react';
import { formValuesToSaveParams } from '../mappers/form-values-to-save-params';
import type { AgentBuilderEditFormValues, AgentBuilderModel } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import { useStoredAgentMutations } from '@/domains/agents/hooks/use-stored-agents';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { isModelNotAllowedError, useBuilderModelPolicy } from '@/domains/builder';

interface UseSaveAgentArgs {
  agentId: string;
  mode: 'create' | 'edit';
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  onSuccess?: (agentId: string) => void;
}

/**
 * Fallback used when no admin builder policy is active and the user did not
 * pick a model. Mirrors the prior hard-coded create-path default so OSS users
 * with no admin configuration continue to get an agent that can run.
 */
const NO_POLICY_FALLBACK: AgentBuilderModel = { provider: 'google', name: 'gemini-2.5-flash' };

/**
 * Decision matrix for the create-path model selection.
 *
 * | # | active | pickerVisible | default | userPick | result |
 * |---|--------|---------------|---------|----------|--------|
 * | 1 | false  | n/a           | n/a     | yes/no   | user pick or `NO_POLICY_FALLBACK` |
 * | 2 | true   | false (locked)| set     | n/a      | use admin default |
 * | 3 | true   | true (open)   | set     | no       | use admin default |
 * | 4 | true   | true (open)   | set     | yes      | use user pick |
 * | 5 | true   | true (open)   | unset   | no       | throw — form must surface required field |
 * | 6 | true   | true (open)   | unset   | yes      | use user pick |
 *
 * `active && !pickerVisible && !default` is unreachable (Phase 4 validation
 * rejects it at boot), but if it slips through we fall through to "user pick
 * required" for safety.
 */
function defaultEntryToStored(entry: DefaultModelEntry): AgentBuilderModel {
  return { provider: entry.provider, name: entry.modelId };
}

function resolveCreateModel(
  policy: BuilderModelPolicy,
  userPick: AgentBuilderModel | undefined,
): { model: AgentBuilderModel | undefined } {
  // Row 1
  if (!policy.active) {
    return { model: userPick ?? NO_POLICY_FALLBACK };
  }

  // Locked (rows 2 + 3): admin default wins, user pick is ignored.
  if (policy.pickerVisible !== true) {
    if (policy.default) return { model: defaultEntryToStored(policy.default) };
    // Unreachable per Phase 4 validation; safest fallback is to require a user pick.
    return { model: userPick };
  }

  // Open + user picked (rows 4 + 6).
  if (userPick) return { model: userPick };

  // Open + admin default (row 3 of the open subset).
  if (policy.default) return { model: defaultEntryToStored(policy.default) };

  // Open + no default + no user pick (row 5).
  return { model: undefined };
}

export function useSaveAgent({
  agentId,
  mode,
  availableAgentTools = [],
  availableSkills = [],
  onSuccess,
}: UseSaveAgentArgs) {
  const { createStoredAgent, updateStoredAgent } = useStoredAgentMutations(agentId);
  const policy = useBuilderModelPolicy();
  const defaultVisibility = useDefaultVisibility();

  const save = useCallback(
    async (values: AgentBuilderEditFormValues) => {
      const params = formValuesToSaveParams(values, availableAgentTools, availableSkills);
      const visibility = params.visibility ?? defaultVisibility;
      const workspaceField = params.workspace ? { workspace: params.workspace } : {};
      const browserField = { browser: params.browser };
      const metadataField = params.metadata ? { metadata: params.metadata } : {};

      try {
        if (mode === 'edit') {
          const updated = await updateStoredAgent.mutateAsync({
            name: params.name,
            description: params.description,
            instructions: params.instructions,
            tools: params.tools,
            agents: params.agents,
            workflows: params.workflows,
            skills: params.skills,
            visibility,
            model: params.model,
            ...workspaceField,
            ...browserField,
            ...metadataField,
          });
          toast.success('Agent updated');
          onSuccess?.(agentId);
          return updated;
        }

        const { model } = resolveCreateModel(policy, params.model);
        if (!model) {
          // Row 5: open mode, no admin default, user didn't pick. Throw a tagged
          // error so the outer catch surfaces a clear message without toasting twice.
          const err = new Error('Select a model before saving');
          (err as Error & { code?: string }).code = 'MODEL_REQUIRED';
          throw err;
        }

        const created = await createStoredAgent.mutateAsync({
          id: agentId,
          name: params.name,
          description: params.description,
          instructions: params.instructions,
          model,
          tools: params.tools,
          agents: params.agents,
          workflows: params.workflows,
          skills: params.skills,
          visibility,
          ...workspaceField,
          ...browserField,
          ...metadataField,
        });
        toast.success('Agent created');
        onSuccess?.(created.id);
        return created;
      } catch (error) {
        const policyDetails = isModelNotAllowedError(error);
        if (policyDetails) {
          toast.error(policyDetails.message);
        } else {
          toast.error(`Failed to save agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        throw error;
      }
    },
    [
      agentId,
      mode,
      availableAgentTools,
      availableSkills,
      createStoredAgent,
      updateStoredAgent,
      onSuccess,
      policy,
      defaultVisibility,
    ],
  );

  return { save, isSaving: createStoredAgent.isPending || updateStoredAgent.isPending };
}
