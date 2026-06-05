import type { StorageCreateAgentInput, StorageModelConfig } from '@mastra/core/storage';
import { createStep } from '@mastra/core/workflows';

import { resolveAvailableModels, resolveDefaultModel, resolveDefaultBrowserRef } from '../../available';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA, DEFAULT_VISIBILITY, FALLBACK_MODEL } from '../../constant';
import { configSchema, createResultSchema, type Config, type StepFactoryArgs } from '../../types';
import { mapConfigToCreateInput } from './handler';

/** Minimal shape of the editor agent namespace this step depends on. */
type EditorWithAgentCreate = {
  agent?: { create?: (input: StorageCreateAgentInput) => Promise<unknown> };
};

/**
 * Resolve the model to persist, guaranteeing a non-empty value (the snapshot
 * requires it). Mirrors the playground starter's `resolveStarterModel`:
 *   explicit config model → builder policy default → first available model →
 *   hard `FALLBACK_MODEL`.
 */
async function resolveModelToPersist(config: Config, mastra: Parameters<typeof resolveAvailableModels>[0]) {
  if (config.model) return config.model as StorageModelConfig;

  const policyDefault = await resolveDefaultModel(mastra);
  if (policyDefault) return policyDefault as StorageModelConfig;

  const available = await resolveAvailableModels(mastra);
  if (available.length > 0) return available[0] as StorageModelConfig;

  return FALLBACK_MODEL;
}

/**
 * Terminal step: persist the accumulated agent configuration.
 *
 * Maps the threaded `Config` onto a `StorageCreateAgentInput` (mirroring the
 * playground's create semantics) and calls `editor.agent.create(...)`. Resolves
 * the create-time concerns the field steps don't own: a generated id, the model
 * fallback chain, the default browser ref, the default request-context schema,
 * and the default visibility. Throws when the editor (and thus persistence) is
 * unavailable — creation cannot complete without saving the agent.
 *
 * Deterministic (no LLM), so this step has no sibling `agent.ts`.
 */
export const createPersistAgentStep = (_args: StepFactoryArgs) =>
  createStep({
    id: 'persist-agent',
    description: 'Persist the resolved agent configuration by creating the stored agent',
    inputSchema: configSchema,
    outputSchema: createResultSchema,
    execute: async ({ inputData, mastra }) => {
      const config = inputData as Config;

      const editor = mastra.getEditor() as EditorWithAgentCreate | undefined;
      if (typeof editor?.agent?.create !== 'function') {
        throw new Error(
          '[agent-builder-creation-workflow] Cannot persist the agent: the editor agent namespace is unavailable. ' +
            'An editor with `agent.create` must be registered with Mastra.',
        );
      }

      const id = crypto.randomUUID();
      const model = await resolveModelToPersist(config, mastra);
      const browserRef = config.browserEnabled ? await resolveDefaultBrowserRef(mastra) : undefined;

      const createInput = mapConfigToCreateInput(config, {
        id,
        visibility: DEFAULT_VISIBILITY,
        model,
        requestContextSchema: DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA,
        browserRef,
      });

      await editor.agent.create(createInput);

      return {
        id,
        visibility: DEFAULT_VISIBILITY,
        config: {
          name: createInput.name,
          description: createInput.description ?? '',
          instructions: config.instructions ?? '',
          workspaceId: config.workspaceId,
          tools: config.tools,
          agents: config.agents,
          workflows: config.workflows,
          skills: config.skills,
          model,
          browserEnabled: config.browserEnabled,
        },
      };
    },
  });
