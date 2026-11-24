import { MastraError } from '../../error/index.js';
import { withoutLiveRequestKeys } from '../../request-context';
import type { StartExperimentConfig } from './types';
import { experimentWorkflowInputSchema } from './workflow';
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

/** Strings, finite numbers, booleans, null, arrays and plain objects survive a JSON broker unchanged. */
function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJson);
  if (typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) && Object.values(value).every(isPlainJson);
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
  // The caller's token, user and permissions belong to the starting request; never publish or store them.
  const requestContext =
    config.requestContext === undefined ? undefined : withoutLiveRequestKeys(config.requestContext);
  if (requestContext !== undefined && !isPlainJson(requestContext)) {
    throw notDurable('requestContext', 'values must be plain JSON (no functions, class instances, undefined or NaN)');
  }
  if (config.agentModel !== undefined && typeof config.agentModel !== 'string') {
    throw notDurable('agentModel', 'pass a "provider/model" string, not a model object');
  }

  const runOptions: DurableRunOptions = {
    maxConcurrency: config.maxConcurrency,
    itemTimeout: config.itemTimeout,
    maxRetries: config.maxRetries,
    agentModel: config.agentModel,
    unmockedToolPolicy: config.unmockedToolPolicy,
    requestContext,
    versions: config.versions,
  };
  // The workflow validates its input only once the experiment exists, so check the options here first.
  const parsed = experimentWorkflowInputSchema.omit({ datasetId: true, experimentId: true }).safeParse(runOptions);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw notDurable(String(issue.path[0]), issue.message);
  }

  return { runOptions, scorerIds };
}
