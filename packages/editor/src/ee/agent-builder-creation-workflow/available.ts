import type { Mastra } from '@mastra/core';

import { buildProviderModelCatalog } from '../utils/provider-catalog';

import type { AvailableAgentTool, IdNameEntry, AgentModel, FeatureCapabilities } from './types';

/**
 * Per-step availability resolution.
 *
 * Each creation-workflow step needs to know *what it is allowed to offer* before
 * it asks its agent to choose. This module reads the registered `Mastra`
 * instance plus the agent-builder configuration and returns the
 * restriction-applied lists, mirroring the server `GET /editor/builder/settings`
 * and infrastructure handlers in `packages/server/src/server/handlers/editor-builder.ts`.
 *
 * Every resolver degrades gracefully: when there is no editor, the builder is
 * disabled, or the relevant feature is off, it returns an empty list / `undefined`
 * so the calling step can no-op instead of throwing.
 */

type AnyRecord = Record<string, unknown>;

interface ResolvedBuilderContext {
  // The resolved agent-builder instance (typed loosely to avoid a hard EE dep).
  builder: {
    enabled?: boolean;
    getFeatures?: () => { agent?: AnyRecord } | undefined;
    getConfiguration?: () => { agent?: AnyRecord } | undefined;
  };
  configuration: { agent?: AnyRecord } | undefined;
}

/**
 * Resolve the active builder + its configuration from the Mastra instance.
 * Returns `null` when the editor is absent, doesn't support the builder, the
 * builder is disabled, or the builder config isn't enabled — matching the
 * server handler short-circuits.
 */
async function resolveBuilderContext(mastra: Mastra): Promise<ResolvedBuilderContext | null> {
  const editor = mastra.getEditor() as
    | {
        resolveBuilder?: () => Promise<ResolvedBuilderContext['builder'] | undefined>;
        hasEnabledBuilderConfig?: () => boolean;
      }
    | undefined;

  if (!editor || typeof editor.resolveBuilder !== 'function') return null;
  if (!editor.hasEnabledBuilderConfig?.()) return null;

  const builder = await editor.resolveBuilder();
  if (!builder || !builder.enabled) return null;

  const configuration = builder.getConfiguration?.();
  return { builder, configuration };
}

type AliasPair = { id: string; key: string };

const collectAliases = (registry: AnyRecord | undefined): AliasPair[] =>
  Object.entries(registry ?? {}).map(([key, entity]) => ({
    id: (entity as { id?: string }).id || key,
    key,
  }));

const resolveName = (entity: unknown, fallback: string): string => {
  const name = (entity as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' && name.length > 0 ? name : fallback;
};

/**
 * Resolve the tools/agents/workflows the agent may be configured with, applying
 * the admin picker allowlists. A `null` visibility for a kind means
 * "unrestricted" (all registered entries are offered).
 */
export async function resolveAvailableAgentTools(mastra: Mastra): Promise<AvailableAgentTool[]> {
  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return [];

  const toolsRegistry = (mastra.listTools() ?? {}) as AnyRecord;
  const agentsRegistry = (mastra.listAgents() ?? {}) as AnyRecord;
  const workflowsRegistry = (mastra.listWorkflows() ?? {}) as AnyRecord;

  const toolAliases = collectAliases(toolsRegistry);
  const agentAliases = collectAliases(agentsRegistry);
  const workflowAliases = collectAliases(workflowsRegistry);

  const { resolvePickerVisibility } = await import('@mastra/core/agent-builder/ee');

  const picker = resolvePickerVisibility({
    config: ctx.configuration?.agent,
    registeredToolIds: toolAliases.flatMap(a => [a.id, a.key]),
    registeredAgentIds: agentAliases.flatMap(a => [a.id, a.key]),
    registeredWorkflowIds: workflowAliases.flatMap(a => [a.id, a.key]),
  });

  const out: AvailableAgentTool[] = [];

  const collectKind = (
    aliases: AliasPair[],
    registry: AnyRecord,
    visible: string[] | null,
    type: AvailableAgentTool['type'],
  ) => {
    const allowed = visible === null ? null : new Set(visible);
    for (const alias of aliases) {
      // `null` ⇒ unrestricted; otherwise the id or its registration key must be visible.
      if (allowed && !allowed.has(alias.id) && !allowed.has(alias.key)) continue;
      const entity = registry[alias.key];
      out.push({ id: alias.id, name: resolveName(entity, alias.id), type });
    }
  };

  collectKind(toolAliases, toolsRegistry, picker.visibleTools, 'tool');
  collectKind(agentAliases, agentsRegistry, picker.visibleAgents, 'agent');
  collectKind(workflowAliases, workflowsRegistry, picker.visibleWorkflows, 'workflow');

  return out;
}

/**
 * Resolve the registered skills as `{ id, name }`. Uses the editor skill
 * namespace; returns `[]` when no editor / builder is available.
 */
export async function resolveAvailableSkills(mastra: Mastra): Promise<IdNameEntry[]> {
  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return [];

  const editor = mastra.getEditor() as
    | { skill?: { listResolved?: () => Promise<{ skills?: Array<{ id: string; name?: string }> }> } }
    | undefined;
  if (!editor?.skill?.listResolved) return [];

  const result = await editor.skill.listResolved();
  return (result.skills ?? []).map(skill => ({ id: skill.id, name: skill.name ?? skill.id }));
}

/**
 * Resolve the registered workspaces as `{ id, name }` from the Mastra instance.
 */
export async function resolveAvailableWorkspaces(mastra: Mastra): Promise<IdNameEntry[]> {
  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return [];

  const registered = mastra.listWorkspaces();
  return Object.entries(registered).map(([id, entry]) => ({
    id,
    name: entry.workspace?.name ?? id,
  }));
}

/**
 * Resolve the models the agent may use. Mirrors the server endpoint
 * `GET /editor/builder/models/available`: enumerate the full provider/model
 * catalog (static registry + gateways), then filter it with `isModelAllowed`
 * only when the admin model policy is active with a non-empty allowlist.
 * Inactive / unrestricted policies return the full catalog.
 */
export async function resolveAvailableModels(mastra: Mastra): Promise<AgentModel[]> {
  const catalog = await buildProviderModelCatalog(mastra);

  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return catalog;

  const { builderToModelPolicy } = await import('@mastra/core/agent-builder/ee');
  const policy = builderToModelPolicy(ctx.builder as never);

  // Inactive policy (or no allowlist) ⇒ nothing to filter.
  if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
    return catalog;
  }

  const { isModelAllowed } = await import('@mastra/core/agent-builder/ee');
  return catalog.filter(({ provider, name }) => isModelAllowed(policy.allowed, { provider, modelId: name }));
}

/**
 * Whether browser automation is configured for the builder. Mirrors the
 * infrastructure handler's browser block: a browser is considered available
 * when the agent config declares a browser provider. Returns `undefined` when
 * no builder context is resolvable so the step can leave `browserEnabled` unset.
 */
export async function resolveBrowserAvailable(mastra: Mastra): Promise<boolean> {
  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return false;

  const agent = ctx.configuration?.agent as { browser?: { type?: string; config?: AnyRecord } } | undefined;
  const browser = agent?.browser;
  if (!browser) return false;
  // Configured when a type or a provider is declared.
  const provider = (browser.config as { provider?: string } | undefined)?.provider;
  return Boolean(browser.type || provider);
}

/** The builder feature keys, matching `FeatureCapabilities` / core's `AgentFeatures`. */
const FEATURE_KEYS = [
  'tools',
  'agents',
  'workflows',
  'scorers',
  'skills',
  'memory',
  'variables',
  'favorites',
  'avatarUpload',
  'browser',
  'model',
] as const satisfies ReadonlyArray<keyof FeatureCapabilities>;

const allFeaturesDisabled = (): FeatureCapabilities =>
  Object.fromEntries(FEATURE_KEYS.map(key => [key, false])) as FeatureCapabilities;

/**
 * Resolve which agent-builder capabilities are enabled for the running builder.
 * Mirrors the playground's `useBuilderAgentFeatures`: each capability is the raw
 * `features.agent.{key} === true` value, with omitted flags resolving to `false`.
 * Returns an all-`false` map when there is no editor or the builder is disabled,
 * so the calling step can store a deterministic capability map either way.
 */
export async function resolveFeatureCapabilities(mastra: Mastra): Promise<FeatureCapabilities> {
  const ctx = await resolveBuilderContext(mastra);
  if (!ctx) return allFeaturesDisabled();

  const agentFeatures = ctx.builder.getFeatures?.()?.agent ?? {};
  return Object.fromEntries(
    FEATURE_KEYS.map(key => [key, agentFeatures[key] === true]),
  ) as FeatureCapabilities;
}
