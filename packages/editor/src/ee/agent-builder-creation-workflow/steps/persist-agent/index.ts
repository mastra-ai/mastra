import type { StorageCreateAgentInput, StorageModelConfig } from '@mastra/core/storage';
import { createStep } from '@mastra/core/workflows';

import { resolveAvailableModels, resolveDefaultModel, resolveDefaultBrowserRef } from '../../available';
import { DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA, DEFAULT_VISIBILITY, FALLBACK_MODEL } from '../../constant';
import { configSchema, createResultSchema, type Config, type StepFactoryArgs } from '../../types';
import { mapConfigToCreateInput } from './handler';
import type { RequestContext } from '@mastra/core/di';
import type { Mastra } from '@mastra/core';

/** Minimal shape of the editor agent namespace this step depends on. */
type EditorWithAgentCreate = {
  agent?: {
    create?: (input: StorageCreateAgentInput) => Promise<unknown>;
    clearCache?: (id?: string) => void;
  };
};

/**
 * Resolve the author id from the caller on the workflow's request context.
 *
 * Reads the `'user'` key the playground sets in `stream-chat-provider.tsx`
 * (`requestContext.set('user', currentUser)`, where `currentUser` carries a
 * string `id`). Returns the id when present and non-empty, otherwise
 * `undefined` so the agent is created without an `authorId`.
 */
function resolveAuthorId(requestContext: RequestContext) {
  const user = requestContext?.get?.('user');
  if (user && typeof user === 'object' && 'id' in user) {
    const id = user.id;
    if (typeof id === 'string' && id.length > 0) {
      return id;
    }
  }
  return undefined;
}

/**
 * Publish the agent's initial version so it is immediately usable.
 *
 * `editor.agent.create` (→ storage `create`) always writes the thin record as
 * `status: 'draft'` with `activeVersionId=undefined` and auto-creates version 1;
 * there is no create-input field to start published, and updating
 * `activeVersionId` alone no longer auto-publishes. So we must explicitly set
 * both `activeVersionId` and `status: 'published'` here, mirroring the server's
 * CREATE_STORED_AGENT_ROUTE (packages/server/src/server/handlers/stored-agents.ts).
 *
 * The agent already exists at this point, so a store that lacks versioning is
 * tolerated: we log and continue rather than throwing.
 */
async function publishInitialVersion(mastra: Mastra, editor: EditorWithAgentCreate, id: string) {
  try {
    const agentsStore = await mastra.getStorage?.()?.getStore?.('agents');
    if (typeof agentsStore?.listVersions !== 'function' || typeof agentsStore.update !== 'function') {
      return;
    }

    const { versions } = await agentsStore.listVersions({ agentId: id, perPage: 1 });
    const initialVersion = versions[0];
    if (!initialVersion) return;

    await agentsStore.update({ id, activeVersionId: initialVersion.id, status: 'published' });
    editor.agent?.clearCache?.(id);
  } catch (error) {
    // The agent is already created; failing to publish should not abort the workflow.
    console.warn('[agent-builder-creation-workflow] Failed to publish the initial agent version:', error);
  }
}

/**
 * Resolve the model to persist, guaranteeing a non-empty value (the snapshot
 * requires it). Mirrors the playground starter's `resolveStarterModel`:
 *   explicit config model → builder policy default → first available model →
 *   hard `FALLBACK_MODEL`.
 */
async function resolveModelToPersist(config: Config, mastra: Parameters<typeof resolveAvailableModels>[0]) {
  if (config.model) return config.model;

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
 * Ownership note: `authorId` is derived from the caller on the workflow's
 * request context via the `'user'` key the playground sets (see
 * `resolveAuthorId`). Unlike the server's create handler, visibility is not
 * derived from the caller — new agents are always persisted with a fixed
 * `DEFAULT_VISIBILITY` (`private`). When no caller is present, `authorId` is
 * omitted and visibility stays `private`.
 *
 * After create, the initial version is explicitly published (see
 * `publishInitialVersion`) so the agent is reachable via published resolution.
 *
 * Deterministic (no LLM), so this step has no sibling `agent.ts`.
 */
export const createPersistAgentStep = (_args: StepFactoryArgs) =>
  createStep({
    id: 'persist-agent',
    description: 'Persist the resolved agent configuration by creating the stored agent',
    inputSchema: configSchema,
    outputSchema: createResultSchema,
    execute: async ({ inputData, mastra, requestContext }) => {
      const config = inputData as Config;

      const authorId = resolveAuthorId(requestContext);

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
        authorId,
        visibility: DEFAULT_VISIBILITY,
        model,
        requestContextSchema: DEFAULT_BUILDER_REQUEST_CONTEXT_SCHEMA,
        browserRef,
      });

      await editor.agent.create(createInput);

      await publishInitialVersion(mastra, editor, id);

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
