import type { StoredSkillResponse } from '@mastra/client-js';
import { createTool } from '@mastra/client-js';
import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { z } from 'zod-v4';

import type { useBuilderAgentFeatures } from '../../../hooks/use-builder-agent-features';
import { buildAgentBuilderToolDescription } from '@/domains/agent-builder/mappers/agent-builder-tool/build-tool-description';
import { buildAgentBuilderToolSchema } from '@/domains/agent-builder/mappers/agent-builder-tool/build-tool-schema';
import { routeToolInputToFormKeys } from '@/domains/agent-builder/mappers/agent-builder-tool/route-tool-input';
import type { AgentBuilderEditFormValues } from '@/domains/agent-builder/schemas';
import type { AgentTool } from '@/domains/agent-builder/types/agent-tool';
import { cleanProviderId } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm';

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
}

export function useAgentBuilderTool({
  features,
  availableAgentTools,
  availableWorkspaces = [],
  availableSkills = [],
  availableModels = [],
}: UseAgentBuilderToolArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { tools: toolsEnabled, skills: skillsEnabled } = features;

  return useMemo(
    () =>
      createTool({
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
            const { tools, agents, workflows, integrationTools } = routeToolInputToFormKeys(
              availableAgentTools,
              inputData.tools,
            );
            formMethods.setValue('tools', tools);
            formMethods.setValue('agents', agents);
            formMethods.setValue('workflows', workflows);

            // Merge integration tools into toolIntegrations, preserving existing connections.
            // The LLM-facing schema never exposes connections/labels/credentials — those are owned
            // exclusively by the human-driven Tools panel.
            const currentIntegrations = formMethods.getValues('toolIntegrations') ?? {};
            const nextIntegrations: AgentBuilderEditFormValues['toolIntegrations'] = {};
            const selectedByProvider = new Map<string, typeof integrationTools>();
            for (const entry of integrationTools) {
              const list = selectedByProvider.get(entry.providerId) ?? [];
              list.push(entry);
              selectedByProvider.set(entry.providerId, list);
            }

            // Carry every provider that already has connections, even if the LLM selected nothing
            // from it on this turn — keeps connections intact across edits.
            const providerIds = new Set<string>([...Object.keys(currentIntegrations), ...selectedByProvider.keys()]);

            for (const providerId of providerIds) {
              const existing = currentIntegrations[providerId];
              const selected = selectedByProvider.get(providerId) ?? [];
              const nextTools: Record<string, { toolService: string; description?: string }> = {};
              for (const entry of selected) {
                nextTools[entry.slug] = entry.description
                  ? { toolService: entry.toolService, description: entry.description }
                  : { toolService: entry.toolService };
              }
              nextIntegrations[providerId] = {
                tools: nextTools,
                connections: existing?.connections ?? {},
              };
            }

            formMethods.setValue('toolIntegrations', nextIntegrations, { shouldDirty: true });
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
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only features.tools/skills affects feature-gated schema/description fields
    [
      formMethods,
      toolsEnabled,
      skillsEnabled,
      availableAgentTools,
      availableWorkspaces,
      availableSkills,
      availableModels,
    ],
  );
}
