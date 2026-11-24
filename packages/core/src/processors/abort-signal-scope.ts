import { createRunScopeKey } from '../mastra/run-scope';

/**
 * The caller's abort signal for a processor workflow run. Held in the run scope
 * rather than the step payload: a serializing pubsub would encode the signal as `{}`.
 */
export const PROCESSOR_ABORT_SIGNAL = createRunScopeKey<AbortSignal>('processor-abort-signal');
