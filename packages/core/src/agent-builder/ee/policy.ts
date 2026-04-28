import type { IAgentBuilder, BuilderModelPolicy, DefaultModelEntry, ProviderModelEntry } from './types';

/**
 * Inputs for the shared {@link isBuilderModelPolicyActive} predicate.
 *
 * Lives separately from {@link BuilderModelPolicy} because we need to ask the
 * "is the model slice active?" question at config-validation time, *before*
 * a `BuilderModelPolicy` has been built.
 */
export interface BuilderModelPolicyInputs {
  /** `AgentBuilderOptions.enabled` (defaulted: missing = `true`). */
  enabled: boolean;
  /** `features.agent.model` — `true` means picker visible. */
  pickerVisible: boolean;
  /** `configuration.agent.models.allowed`. */
  allowed?: ProviderModelEntry[];
  /** `configuration.agent.models.default`. */
  default?: DefaultModelEntry;
}

/**
 * Single source of truth for whether the admin has actually configured a model
 * policy. Reused by:
 * - {@link builderToModelPolicy} (UI / runtime derivation)
 * - `EditorAgentBuilder` config validation (Phase 4)
 * - Server-side enforcement gate (Phase 6)
 *
 * "Active" means the admin opted into the model slice in some way:
 * - the picker is visible (open-mode), OR
 * - an allowlist was set, OR
 * - a default model was set.
 *
 * If the builder is `enabled: false`, the slice is never active.
 */
export function isBuilderModelPolicyActive(inputs: BuilderModelPolicyInputs): boolean {
  if (!inputs.enabled) return false;
  if (inputs.pickerVisible) return true;
  if (inputs.allowed !== undefined) return true;
  if (inputs.default !== undefined) return true;
  return false;
}

/**
 * Pure derivation of the {@link BuilderModelPolicy} from an `IAgentBuilder`.
 * No `Mastra` / `IEditor` dependency — server and editor wrappers feed it
 * a builder instance through their own resolution paths.
 *
 * Returns `{ active: false }` when:
 * - the builder is missing,
 * - the builder is disabled, or
 * - none of the model-slice signals are present.
 *
 * In every active case, `allowed` and `default` are passed through verbatim
 * so locked-mode UI still has the data it needs to render the chosen model.
 */
export function builderToModelPolicy(builder: IAgentBuilder | undefined): BuilderModelPolicy {
  if (!builder || !builder.enabled) {
    return { active: false };
  }

  const features = builder.getFeatures();
  const configuration = builder.getConfiguration();
  const pickerVisible = features?.agent?.model === true;
  const models = configuration?.agent?.models;
  const allowed = models?.allowed;
  const defaultModel = models?.default;

  const active = isBuilderModelPolicyActive({
    enabled: builder.enabled,
    pickerVisible,
    allowed,
    default: defaultModel,
  });

  if (!active) {
    return { active: false };
  }

  return {
    active: true,
    pickerVisible,
    ...(allowed !== undefined ? { allowed } : {}),
    ...(defaultModel !== undefined ? { default: defaultModel } : {}),
  };
}
