import { MastraError } from '../../error/index.js';
import type { StorageDefaultOptions, StorageModelConfig } from '../../storage/types';
import type { ExperimentConfig } from './types';

/**
 * Per-run agent config tweaks for an experiment. A strict, static subset of a stored agent
 * version snapshot (`instructions`, `model`, `defaultOptions`), so it can later be merged
 * into a snapshot to promote the tweak to a new agent version.
 */
export type ExperimentAgentOverrides = {
  /** Replaces the agent's instructions for every item. */
  instructions?: string;
  /** Model to run on, resolved as `provider/name`. */
  model?: Pick<StorageModelConfig, 'provider' | 'name'>;
  /** Execution options passed to every `agent.generate()` call. */
  defaultOptions?: Pick<StorageDefaultOptions, 'modelSettings' | 'maxSteps' | 'toolChoice' | 'activeTools'>;
};

/**
 * `agentOverrides` tweaks an agent's config, so it is meaningless for workflows, scorers and inline tasks.
 * It also can't pick a model while `agentModel` picks one too.
 */
export function assertAgentOverridesTarget(
  config: Pick<ExperimentConfig, 'agentModel' | 'agentOverrides' | 'targetType'> & { task?: unknown },
) {
  if (!config.agentOverrides) return;
  const text =
    config.task || config.targetType !== 'agent'
      ? 'agentOverrides is only supported for agent targets (targetType: "agent")'
      : config.agentModel && config.agentOverrides.model
        ? 'agentOverrides.model cannot be combined with agentModel'
        : undefined;
  if (text) {
    throw new MastraError({ id: 'EXPERIMENT_INVALID_AGENT_OVERRIDES', domain: 'STORAGE', category: 'USER', text });
  }
}

/** Experiment metadata with the overrides recorded as `agentOverrides`, so a run can be compared or later promoted. */
export function withAgentOverridesMetadata(
  metadata: Record<string, unknown> | undefined,
  agentOverrides: ExperimentAgentOverrides | undefined,
): Record<string, unknown> | undefined {
  return agentOverrides ? { ...metadata, agentOverrides } : metadata;
}

/** Maps overrides to per-call `agent.generate()` options. Only the allow-listed option keys are forwarded. */
export function toGenerateOptions(overrides: ExperimentAgentOverrides) {
  const { modelSettings, maxSteps, toolChoice, activeTools } = overrides.defaultOptions ?? {};
  return {
    ...(overrides.instructions !== undefined ? { instructions: overrides.instructions } : {}),
    ...(overrides.model ? { model: `${overrides.model.provider}/${overrides.model.name}` } : {}),
    ...(modelSettings !== undefined ? { modelSettings } : {}),
    ...(maxSteps !== undefined ? { maxSteps } : {}),
    ...(toolChoice !== undefined ? { toolChoice } : {}),
    ...(activeTools !== undefined ? { activeTools } : {}),
  };
}
