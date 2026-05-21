export type {
  AgentBuilderOptions,
  AgentFeatures,
  BuilderAgentDefaults,
  BuilderModelPolicy,
  CustomProviderEntry,
  DefaultModelEntry,
  IAgentBuilder,
  KnownProviderEntry,
  ModelPolicy,
  ModelPolicySurface,
  ProviderModelEntry,
  ResolveAgentFeaturesContext,
} from './types';

export { BUILDER_FEATURE_DEFAULTS, resolveAgentFeatures } from './types';

export {
  assertModelAllowed,
  enforceModelAllowlist,
  isModelAllowed,
  matchesProvider,
  type EnforceModelAllowlistResult,
  type ModelMatchCandidate,
} from './allowlist';

export {
  toModelCandidates,
  type ModelCandidate,
  type ModelCandidateInput,
  type ModelCandidateOrigin,
} from './normalize-candidate';

export {
  builderToModelPolicy,
  isBuilderModelPolicyActive,
  isModelPolicyActive,
  type BuilderModelPolicyInputs,
  type ModelPolicyInputs,
} from './policy';

export { resolvePickerVisibility, type ResolvePickerVisibilityInputs, type ResolvedPickerVisibility } from './picker';

export { ModelNotAllowedError, MODEL_NOT_ALLOWED_CODE, isModelNotAllowedError } from './errors';
