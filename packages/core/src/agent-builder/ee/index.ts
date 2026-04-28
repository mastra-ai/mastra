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
} from './types';

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

export { builderToModelPolicy, isBuilderModelPolicyActive, type BuilderModelPolicyInputs } from './policy';

export { ModelNotAllowedError, MODEL_NOT_ALLOWED_CODE, isModelNotAllowedError } from './errors';

// Re-export the reserved request-context key for runtime defense (Phase 7).
// Owning module is `../../request-context` to avoid an upward dep from request-context to agent-builder.
export { MASTRA_BUILDER_MODEL_POLICY_KEY } from '../../request-context';
