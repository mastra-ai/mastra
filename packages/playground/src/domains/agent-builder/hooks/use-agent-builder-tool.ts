import type { StoredSkillResponse } from '@mastra/client-js';
import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { useBuilderAgentFeatures } from './use-builder-agent-features';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import { buildAgentBuilderToolDescription } from '@/domains/agent-builder/services/build-tool-description';
import { buildAgentBuilderToolSchema } from '@/domains/agent-builder/services/build-tool-schema';
import { routeToolInputToFormKeys } from '@/domains/agent-builder/services/route-tool-input';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
import { cleanProviderId } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm';
import type { ToolProvidersFormValue } from '@/domains/tool-providers/schemas';

export const AGENT_BUILDER_TOOL_NAME = 'agentBuilderTool';

export interface AvailableWorkspace {
  id: string;
  name: string;
}

interface UseAgentBuilderToolArgs {
  features: ReturnType<typeof useBuilderAgentFeatures>;
  availableAgentTools: AgentTool[];
  availableWorkspaces?: AvailableWorkspace[];
  availableSkills?: StoredSkillResponse[];
  availableModels?: ModelInfo[];
  /**
   * `true` while the tool-provider catalog (toolkits + tools) is still
   * resolving. When `true`, the hook returns `undefined` so the LLM never
   * sees a partially-populated `tools` enum / description. The tool is
   * rebuilt once this flips to `false`.
   */
  integrationToolsLoading?: boolean;
}

export function useAgentBuilderTool({
  features,
  availableAgentTools,
  availableWorkspaces = [],
  availableSkills = [],
  availableModels = [],
  integrationToolsLoading = false,
}: UseAgentBuilderToolArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { tools: toolsEnabled, skills: skillsEnabled } = features;

  return useMemo(() => {
    // Hide the tool entirely until the integration-tool catalog has
    // resolved. A partial enum makes the LLM emit a subset (or refuse),
    // and on agent *create* (no prior state) this is the common case.
    if (integrationToolsLoading) return undefined;

    return createTool({
      id: AGENT_BUILDER_TOOL_NAME,
      description: buildAgentBuilderToolDescription(
        features,
        availableAgentTools,
        availableWorkspaces,
        availableSkills,
        availableModels,
      ),
      inputSchema: buildAgentBuilderToolSchema(
        features,
        availableAgentTools,
        availableWorkspaces,
        availableSkills,
        availableModels,
      ),
      outputSchema: z.object({ success: z.boolean() }),
      execute: async (inputData: any) => {
        if (typeof inputData?.name === 'string') {
          formMethods.setValue('name', inputData.name);
        }
        if (typeof inputData?.description === 'string') {
          formMethods.setValue('description', inputData.description);
        }
        if (typeof inputData?.instructions === 'string') {
          formMethods.setValue('instructions', inputData.instructions);
        }
        if (toolsEnabled && Array.isArray(inputData?.tools)) {
          const { tools, agents, workflows, toolProvidersFragment } = routeToolInputToFormKeys(
            availableAgentTools,
            inputData.tools,
          );
          formMethods.setValue('tools', tools);
          formMethods.setValue('agents', agents);
          formMethods.setValue('workflows', workflows);

          // Merge integration selections into the existing `toolProviders`
          // form value so user-pinned connections and other providers'
          // entries survive. The LLM never deselects integration tools;
          // this is an add-only path.
          const fragmentEntries = Object.entries(toolProvidersFragment);
          if (fragmentEntries.length > 0) {
            const current = (formMethods.getValues('toolProviders') ?? {}) as NonNullable<ToolProvidersFormValue>;
            const next: NonNullable<ToolProvidersFormValue> = { ...current };
            for (const [providerId, slugMap] of fragmentEntries) {
              const existing = current[providerId];
              next[providerId] = {
                ...(existing ?? { tools: {}, connections: {} }),
                tools: { ...(existing?.tools ?? {}), ...slugMap },
              };
            }
            formMethods.setValue('toolProviders', next, { shouldDirty: true, shouldValidate: true });
          }
        }
        if (skillsEnabled && Array.isArray(inputData?.skills)) {
          const validSkillIds = new Set(availableSkills.map(s => s.id));
          const skills: Record<string, true> = {};
          for (const entry of inputData.skills) {
            if (entry && typeof entry.id === 'string' && validSkillIds.has(entry.id)) {
              skills[entry.id] = true;
            }
          }
          formMethods.setValue('skills', skills, { shouldDirty: true });
        }
        if (
          typeof inputData?.model?.provider === 'string' &&
          inputData.model.provider.length > 0 &&
          typeof inputData.model.name === 'string' &&
          inputData.model.name.length > 0
        ) {
          formMethods.setValue(
            'model',
            { provider: cleanProviderId(inputData.model.provider), name: inputData.model.name },
            { shouldDirty: true },
          );
        }
        if (features.browser && typeof inputData?.browserEnabled === 'boolean') {
          formMethods.setValue('browserEnabled', inputData.browserEnabled, { shouldDirty: true });
        }
        if (typeof inputData?.workspaceId === 'string' && inputData.workspaceId.length > 0) {
          formMethods.setValue('workspaceId', inputData.workspaceId);
        }

        return { success: true };
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only features.tools/skills affects feature-gated schema/description fields
  }, [
    formMethods,
    toolsEnabled,
    skillsEnabled,
    availableAgentTools,
    availableWorkspaces,
    availableSkills,
    availableModels,
    integrationToolsLoading,
  ]);
}
