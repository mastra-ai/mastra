import type { BuilderAgentDefaults } from './types';

/**
 * Resolved picker visibility for the Agent Builder configure panel.
 *
 * One field per kind (tools / agents / workflows).
 * - `null` ⇒ unrestricted (show all registered entries).
 * - `string[]` ⇒ explicit allowlist (may be empty to show none).
 */
export interface ResolvedPickerVisibility {
  visibleTools: string[] | null;
  visibleAgents: string[] | null;
  visibleWorkflows: string[] | null;
  /** Non-fatal warnings (e.g. unknown IDs in any allowlist). */
  warnings: string[];
}

export interface ResolvePickerVisibilityInputs {
  /** The `agent` slice of `AgentBuilderOptions['configuration']`. */
  config: BuilderAgentDefaults | undefined;
  /** All tool IDs currently registered with the Mastra instance. */
  registeredToolIds: readonly string[];
  /** All agent IDs currently registered with the Mastra instance. */
  registeredAgentIds: readonly string[];
  /** All workflow IDs currently registered with the Mastra instance. */
  registeredWorkflowIds: readonly string[];
}

interface ResolveOneResult {
  visible: string[] | null;
  warnings: string[];
}

function resolveOne(
  allowlist: string[] | undefined,
  registered: readonly string[],
  kindLabel: string,
  configPath: string,
): ResolveOneResult {
  if (allowlist === undefined) {
    return { visible: null, warnings: [] };
  }

  const known = new Set(registered);
  const seen = new Set<string>();
  const visible: string[] = [];
  const warnings: string[] = [];

  for (const id of allowlist) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (known.has(id)) {
      visible.push(id);
    } else {
      warnings.push(
        `${configPath} references unknown ${kindLabel} "${id}" — no ${kindLabel} with this ID is registered. It will be hidden from the builder picker.`,
      );
    }
  }

  return { visible, warnings };
}

/**
 * Pure derivation of {@link ResolvedPickerVisibility} from admin config and
 * the registered tool/agent/workflow sets.
 *
 * Per kind:
 * - allowlist undefined ⇒ `null` (unrestricted), no warnings.
 * - allowlist provided ⇒ filter to known IDs; emit one warning per unknown ID.
 *
 * Stable order: each visible list preserves admin-provided order with unknowns
 * dropped. Duplicates are de-duplicated.
 */
export function resolvePickerVisibility({
  config,
  registeredToolIds,
  registeredAgentIds,
  registeredWorkflowIds,
}: ResolvePickerVisibilityInputs): ResolvedPickerVisibility {
  const tools = resolveOne(config?.tools?.allowed, registeredToolIds, 'tool', 'configuration.agent.tools.allowed');
  const agents = resolveOne(config?.agents?.allowed, registeredAgentIds, 'agent', 'configuration.agent.agents.allowed');
  const workflows = resolveOne(
    config?.workflows?.allowed,
    registeredWorkflowIds,
    'workflow',
    'configuration.agent.workflows.allowed',
  );

  return {
    visibleTools: tools.visible,
    visibleAgents: agents.visible,
    visibleWorkflows: workflows.visible,
    warnings: [...tools.warnings, ...agents.warnings, ...workflows.warnings],
  };
}
