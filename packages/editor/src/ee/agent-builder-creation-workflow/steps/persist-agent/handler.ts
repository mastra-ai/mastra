import type {
  StorageBrowserRef,
  StorageCreateAgentInput,
  StorageModelConfig,
  StorageSkillConfig,
  StorageToolConfig,
  StorageVisibility,
  StorageWorkspaceRef,
} from '@mastra/core/storage';

import type { Config } from '../../types';

/**
 * Explicit dependencies the step resolves before mapping. Kept separate from the
 * accumulated `Config` because they come from create-time policy/defaults
 * (`id`, `visibility`, the request-context schema) and from availability
 * resolution (`model` fallback, `browser` ref), not from the field steps.
 */
export interface MapConfigToCreateInputDeps {
  /** Unique id for the new agent. */
  id: string;
  /**
   * Author id for the new agent, resolved from the caller on the request
   * context. Omitted when no caller is resolvable.
   */
  authorId?: string;
  /** Visibility to persist the agent with. */
  visibility: StorageVisibility;
  /**
   * The model to persist. The step is responsible for guaranteeing this is set
   * (config model → policy default → fallback) since the snapshot requires it.
   */
  model: StorageModelConfig;
  /** JSON-schema for request-context validation, attached to every new agent. */
  requestContextSchema: Record<string, unknown>;
  /**
   * The resolved browser ref to persist when the agent enables browser access.
   * `undefined` means no default browser config is wired, so browser access is
   * dropped even if the config asked for it.
   */
  browserRef?: StorageBrowserRef;
}

/**
 * Map enabled `{ id: boolean }` selections to a stored `{ id: {} }` config
 * record, dropping disabled/false entries. Mirrors the playground's
 * `buildEnabledRecord` (we store an empty per-entry config; descriptions are
 * optional and not threaded through the workflow).
 */
function enabledRecord<T>(selected: Record<string, boolean> | undefined): Record<string, T> | undefined {
  if (!selected) return undefined;
  const entries = Object.entries(selected).filter(([, enabled]) => enabled);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries.map(([id]) => [id, {} as T]));
}

/**
 * Map the accumulated creation-workflow config onto a `StorageCreateAgentInput`
 * accepted by `editor.agent.create(...)`.
 *
 * Pure and infra-agnostic (no `mastra`/`ctx`): the calling step resolves all
 * policy/availability-derived inputs and passes them in via `deps`. Mirrors the
 * playground's create semantics (`AgentBuilderStarter` + `formValuesToSaveParams`):
 * required `name`/`instructions`/`model`, optional trimmed `description`, the
 * `{ type: 'id', workspaceId }` workspace ref, enabled-record tools/agents/
 * workflows/skills, an inline browser ref when enabled, the default
 * request-context schema, and an optional `authorId` when the caller is known.
 */
export function mapConfigToCreateInput(config: Config, deps: MapConfigToCreateInputDeps): StorageCreateAgentInput {
  const { id, authorId, visibility, model, requestContextSchema, browserRef } = deps;

  const name = config.name && config.name.trim().length > 0 ? config.name : 'Untitled Agent';
  const description = config.description?.trim();

  const workspace: StorageWorkspaceRef | undefined =
    config.workspaceId && config.workspaceId.length > 0
      ? { type: 'id', workspaceId: config.workspaceId }
      : undefined;

  const tools = enabledRecord<StorageToolConfig>(config.tools);
  const agents = enabledRecord<StorageToolConfig>(config.agents);
  const workflows = enabledRecord<StorageToolConfig>(config.workflows);
  const skills = enabledRecord<StorageSkillConfig>(config.skills);

  // Persist a browser ref only when the agent enabled browser *and* a default
  // browser config is wired, matching the server's `browser: true` resolution.
  const browser = config.browserEnabled && browserRef ? browserRef : undefined;

  return {
    id,
    ...(authorId ? { authorId } : {}),
    visibility,
    name,
    instructions: config.instructions ?? '',
    model,
    requestContextSchema,
    ...(description ? { description } : {}),
    ...(workspace ? { workspace } : {}),
    ...(tools ? { tools } : {}),
    ...(agents ? { agents } : {}),
    ...(workflows ? { workflows } : {}),
    ...(skills ? { skills } : {}),
    ...(browser ? { browser } : {}),
  };
}
