import type { BuilderAgentDefaults, BuilderModelPolicy, IAgentBuilder } from '@mastra/core/agent-builder/ee';
import type { IMastraEditor } from '@mastra/core/editor';

interface ResolvedPickerVisibility {
  visibleTools: string[] | null;
  visibleAgents: string[] | null;
  visibleWorkflows: string[] | null;
  warnings: string[];
}

interface ResolvePickerVisibilityInputs {
  config: BuilderAgentDefaults | undefined;
  registeredToolIds: readonly string[];
  registeredAgentIds: readonly string[];
  registeredWorkflowIds: readonly string[];
}

interface ResolveOneResult {
  visible: string[] | null;
  warnings: string[];
}

function isBuilderModelPolicyActive(policy: BuilderModelPolicy): boolean {
  if (!policy.active) return false;
  if (policy.pickerVisible) return true;
  if (policy.allowed !== undefined) return true;
  if (policy.default !== undefined) return true;
  return false;
}

export function resolveBuilderModelPolicyFromBuilder(builder: IAgentBuilder | undefined): BuilderModelPolicy {
  if (!builder || !builder.enabled) {
    return { active: false };
  }

  const features = builder.getFeatures();
  const configuration = builder.getConfiguration();
  const pickerVisible = features?.agent?.model === true;
  const models = configuration?.agent?.models;
  const policy: BuilderModelPolicy = {
    active: true,
    pickerVisible,
    ...(models?.allowed !== undefined ? { allowed: models.allowed } : {}),
    ...(models?.default !== undefined ? { default: models.default } : {}),
  };

  return isBuilderModelPolicyActive(policy) ? policy : { active: false };
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
        `${configPath} references unknown ${kindLabel} "${id}" - no ${kindLabel} with this ID is registered. It will be hidden from the builder picker.`,
      );
    }
  }

  return { visible, warnings };
}

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

/**
 * Server-side derivation of the builder model policy.
 *
 * Handles the optional `IMastraEditor` builder API surface (older / OSS editors
 * may not implement `hasEnabledBuilderConfig` / `resolveBuilder`) and returns
 * a uniform `BuilderModelPolicy` to every call site.
 *
 * Returns `{ active: false }` whenever:
 * - no editor is configured,
 * - the editor doesn't expose builder methods,
 * - the builder config is disabled, or
 * - resolving the builder fails / yields nothing.
 *
 * Keep this logic local to the server package: packaged runtime builds can
 * tree-shake dynamic `@mastra/core/agent-builder/ee` namespace imports and omit
 * exports used only by settings routes.
 */
export async function resolveBuilderModelPolicy(editor: IMastraEditor | undefined): Promise<BuilderModelPolicy> {
  if (!editor) return { active: false };
  if (typeof editor.resolveBuilder !== 'function') return { active: false };
  if (typeof editor.hasEnabledBuilderConfig === 'function' && !editor.hasEnabledBuilderConfig()) {
    return { active: false };
  }

  // Degrade to inactive on builder-resolution failure rather than letting the
  // rejection escape: agent execution routes seed this on every request, so a
  // transient failure must not 500 the entire route.
  try {
    const builder = await editor.resolveBuilder();
    return resolveBuilderModelPolicyFromBuilder(builder);
  } catch {
    return { active: false };
  }
}
