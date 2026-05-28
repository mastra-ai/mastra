export type {
  AgentBuilderOptions,
  AgentFeatures,
  BuilderAgentDefaults,
  BuilderModelPolicy,
  CustomProviderEntry,
  DefaultModelEntry,
  IAgentBuilder,
  KnownProviderEntry,
  ProviderModelEntry,
  ResolveAgentFeaturesContext,
} from './types';

export { BUILDER_FEATURE_DEFAULTS, resolveAgentFeatures } from './types';

export {
  isModelAllowedByPolicy,
  MODEL_NOT_ALLOWED_CODE,
  matchesProvider,
  type IsModelAllowedByPolicyOptions,
  type ModelMatchCandidate,
} from './model-policy';

export {
  assertModelAllowed,
  enforceModelAllowlist,
  isModelAllowed,
  type EnforceModelAllowlistResult,
} from './allowlist';

export {
  toModelCandidates,
  type ModelCandidate,
  type ModelCandidateInput,
  type ModelCandidateOrigin,
} from './normalize-candidate';

export { builderToModelPolicy, isBuilderModelPolicyActive, type BuilderModelPolicyInputs } from './policy';

export { resolvePickerVisibility, type ResolvePickerVisibilityInputs, type ResolvedPickerVisibility } from './picker';

export { ModelNotAllowedError, isModelNotAllowedError } from './errors';
