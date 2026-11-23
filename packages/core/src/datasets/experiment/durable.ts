import { MastraError } from '../../error/index.js';
import type { StartExperimentConfig } from './types';
import type { ExperimentWorkflowInput } from './workflow';

/** Error id thrown when `durable: true` is combined with an option a durable run can't carry. */
export const EXPERIMENT_NOT_DURABLE = 'EXPERIMENT_NOT_DURABLE';

export type DurableRunOptions = Omit<
  ExperimentWorkflowInput,
  'datasetId' | 'experimentId' | 'organizationId' | 'projectId'
>;

function notDurable(option: string, reason: string): MastraError {
  return new MastraError({
    id: EXPERIMENT_NOT_DURABLE,
    domain: 'STORAGE',
    category: 'USER',
    text: `durable experiments can't use \`${option}\`: ${reason}`,
  });
}

/**
 * Check a `durable: true` config and return the run options the experiment
 * workflow carries, plus the scorer ids to pin on the experiment. A durable run may continue in another process, so every
 * option has to be JSON: functions, signals, model objects and scorer objects
 * are rejected before anything is created.
 */
export function durableRunOptions<I, O, E>(
  config: StartExperimentConfig<I, O, E>,
): { runOptions: DurableRunOptions; scorerIds: string[] | undefined } {
  if (config.task) throw notDurable('task', 'run a registered target (targetType + targetId) instead');
  if (!config.targetType || !config.targetId) {
    throw notDurable('targetType', 'targetType and targetId must name a registered target');
  }
  for (const hook of ['beforeAll', 'afterAll', 'beforeEach', 'afterEach'] as const) {
    if (config[hook]) throw notDurable(hook, 'hooks are functions and only run in the starting process');
  }
  if (config.onEvent) throw notDurable('onEvent', 'observers only run in the starting process');
  if (config.signal) throw notDurable('signal', 'an AbortSignal only exists in the starting process');
  let scorerIds: string[] | undefined;
  if (config.scorers !== undefined) {
    if (!Array.isArray(config.scorers)) {
      throw notDurable('scorers', 'pass an array of registered scorer ids (step scorers are not supported)');
    }
    scorerIds = config.scorers.filter((scorer): scorer is string => typeof scorer === 'string');
    if (scorerIds.length !== config.scorers.length) {
      throw notDurable('scorers', 'pass registered scorer ids, not scorer objects');
    }
  }
  if (config.persistence?.experiments === 'none' || config.persistence?.scores === 'none') {
    throw notDurable('persistence', 'a durable run is tracked through stored experiments and scores');
  }
  if (config.agentModel !== undefined && typeof config.agentModel !== 'string') {
    throw notDurable('agentModel', 'pass a "provider/model" string, not a model object');
  }

  return {
    runOptions: {
      maxConcurrency: config.maxConcurrency,
      itemTimeout: config.itemTimeout,
      maxRetries: config.maxRetries,
      agentModel: config.agentModel,
      unmockedToolPolicy: config.unmockedToolPolicy,
      requestContext: config.requestContext,
      versions: config.versions,
    },
    scorerIds,
  };
}
