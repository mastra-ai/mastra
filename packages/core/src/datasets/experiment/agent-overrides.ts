import { MastraError } from '../../error/index.js';
import { parseModelString } from '../../llm/model/provider-registry';
import type { StorageDefaultOptions, StorageModelConfig } from '../../storage/types';
import { agentModelLabel } from './agent-model';
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

const modelPath = (model: NonNullable<ExperimentAgentOverrides['model']>) => `${model.provider}/${model.name}`;

/**
 * `agentOverrides` tweaks an agent's config, so it is meaningless for workflows, scorers and inline tasks.
 * When both `agentModel` and `agentOverrides.model` are set, they must name the same model.
 */
export function assertAgentOverridesTarget(
  config: Pick<ExperimentConfig, 'agentModel' | 'agentOverrides' | 'targetType'> & { task?: unknown },
) {
  if (!config.agentOverrides) return;
  const text =
    config.task || config.targetType !== 'agent'
      ? 'agentOverrides is only supported for agent targets (targetType: "agent")'
      : config.agentModel &&
          config.agentOverrides.model &&
          modelPath(config.agentOverrides.model) !== agentModelLabel(config.agentModel)
        ? 'agentOverrides.model and agentModel must name the same model'
        : undefined;
  if (text) {
    throw new MastraError({ id: 'EXPERIMENT_INVALID_AGENT_OVERRIDES', domain: 'STORAGE', category: 'USER', text });
  }
}

/** `agentOverrides` with `agentModel` folded in as `model`, so the recorded overrides always name the model a run used. */
export function resolveAgentOverrides(
  config: Pick<ExperimentConfig, 'agentModel' | 'agentOverrides'>,
): ExperimentAgentOverrides | undefined {
  const { agentModel, agentOverrides } = config;
  if (!agentModel || agentOverrides?.model) return agentOverrides;
  const { provider, modelId } = parseModelString(agentModelLabel(agentModel));
  return provider ? { ...agentOverrides, model: { provider, name: modelId } } : agentOverrides;
}

/** Experiment metadata with the overrides recorded as `agentOverrides`, so a run can be compared or later promoted. */
export function withAgentOverridesMetadata(
  metadata: Record<string, unknown> | undefined,
  agentOverrides: ExperimentAgentOverrides | undefined,
): Record<string, unknown> | undefined {
  return agentOverrides ? { ...metadata, agentOverrides } : metadata;
}

/**
 * Overrides as recorded on each item's trace. The instructions text is left out (it is already on the
 * experiment and on the AGENT_RUN span's `instructions` attribute), replaced by a flag.
 */
export function agentOverridesTraceMetadata(overrides: ExperimentAgentOverrides | undefined) {
  if (!overrides) return {};
  const { instructions, ...rest } = overrides;
  return {
    ...(Object.keys(rest).length ? { agentOverrides: rest } : {}),
    ...(instructions !== undefined ? { agentInstructionsOverridden: true } : {}),
  };
}

/** Maps overrides to per-call `agent.generate()` options. Only the allow-listed option keys are forwarded. */
export function toGenerateOptions(overrides: ExperimentAgentOverrides) {
  const { modelSettings, maxSteps, toolChoice, activeTools } = overrides.defaultOptions ?? {};
  return {
    ...(overrides.instructions !== undefined ? { instructions: overrides.instructions } : {}),
    ...(overrides.model ? { model: modelPath(overrides.model) } : {}),
    ...(modelSettings !== undefined ? { modelSettings } : {}),
    ...(maxSteps !== undefined ? { maxSteps } : {}),
    ...(toolChoice !== undefined ? { toolChoice } : {}),
    ...(activeTools !== undefined ? { activeTools } : {}),
  };
}
