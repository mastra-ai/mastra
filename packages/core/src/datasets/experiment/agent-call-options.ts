import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import { MastraError } from '../../error/index.js';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { ExperimentConfig } from './types';

/**
 * Per-call `agent.generate()` options for an experiment's agent target. They are layered on top of
 * the agent's config (or the `agentVersion` it resolves to) for each call, without changing the agent.
 */
export type ExperimentAgentCallOptions = Pick<AgentExecutionOptionsBase<unknown>, 'instructions' | 'modelSettings'> & {
  /** Model to run on. Same type as `agentModel`. */
  model?: MastraModelConfig;
};

/** `provider/modelId` label for a model config. Reads only identifying fields, so credentials never leak. */
export function agentModelLabel(model: MastraModelConfig): string {
  if (typeof model === 'string') return model;
  const m = model as { id?: unknown; providerId?: unknown; provider?: unknown; modelId?: unknown };
  if (typeof m.id === 'string') return m.id;
  const provider = m.providerId ?? m.provider;
  return typeof provider === 'string' && typeof m.modelId === 'string'
    ? `${provider}/${m.modelId}`
    : String(m.modelId ?? 'unknown');
}

/** `agentModel` and `agentCallOptions` change how an agent is called, so they are meaningless for workflows, scorers and inline tasks. */
export function assertAgentCallOptionsTarget(
  config: Pick<ExperimentConfig, 'agentModel' | 'agentCallOptions' | 'targetType'> & { task?: unknown },
) {
  if (!config.task && config.targetType === 'agent') return;
  const field = config.agentModel ? 'agentModel' : config.agentCallOptions ? 'agentCallOptions' : undefined;
  if (!field) return;
  throw new MastraError({
    id: field === 'agentModel' ? 'EXPERIMENT_INVALID_AGENT_MODEL' : 'EXPERIMENT_INVALID_AGENT_CALL_OPTIONS',
    domain: 'STORAGE',
    category: 'USER',
    text: `${field} is only supported for agent targets (targetType: "agent")`,
  });
}

/** `agentCallOptions` with the `agentModel` alias folded in as `model`. `agentCallOptions.model` wins when both are set. */
export function resolveAgentCallOptions(
  config: Pick<ExperimentConfig, 'agentModel' | 'agentCallOptions'>,
): ExperimentAgentCallOptions | undefined {
  const { agentModel, agentCallOptions } = config;
  if (!agentModel || agentCallOptions?.model) return agentCallOptions;
  return { ...agentCallOptions, model: agentModel };
}

/** Serializable form of the options: the model is recorded as its `provider/modelId` label. */
function toRecord({ instructions, model, modelSettings }: ExperimentAgentCallOptions) {
  return {
    ...(instructions !== undefined ? { instructions } : {}),
    ...(model ? { model: agentModelLabel(model) } : {}),
    ...(modelSettings !== undefined ? { modelSettings } : {}),
  };
}

/** Experiment metadata with the options recorded as `agentCallOptions`, so runs can be compared. */
export function withAgentCallOptionsMetadata(
  metadata: Record<string, unknown> | undefined,
  options: ExperimentAgentCallOptions | undefined,
): Record<string, unknown> | undefined {
  return options ? { ...metadata, agentCallOptions: toRecord(options) } : metadata;
}

/**
 * Options as recorded on each item's trace. The instructions text is left out (it is already on the
 * experiment and on the AGENT_RUN span's `instructions` attribute), replaced by a flag.
 */
export function agentCallOptionsTraceMetadata(options: ExperimentAgentCallOptions | undefined) {
  if (!options) return {};
  const { instructions, ...rest } = toRecord(options);
  return {
    ...(Object.keys(rest).length ? { agentCallOptions: rest } : {}),
    ...(instructions !== undefined ? { agentInstructionsOverridden: true } : {}),
  };
}

/** Maps the options to per-call `agent.generate()` options, forwarding only the defined keys. */
export function toGenerateOptions({ instructions, model, modelSettings }: ExperimentAgentCallOptions) {
  return {
    ...(instructions !== undefined ? { instructions } : {}),
    ...(model ? { model } : {}),
    ...(modelSettings !== undefined ? { modelSettings } : {}),
  };
}
