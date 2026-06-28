import { APICallError } from '@internal/ai-sdk-v5';

import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
} from './index';

/**
 * Matches an API rejection that complains about a sampling parameter the model
 * no longer accepts. Both a parameter name *and* an "unsupported" phrasing must
 * be present so unrelated 400s (e.g. a bad message body that happens to mention
 * "temperature") are not misclassified.
 *
 * Example that triggers this: Anthropic's `claude-opus-4-7` family returns
 * `400 — temperature is deprecated for this model.`
 */
const SAMPLING_PARAM_PATTERN = /\b(?:temperature|top[_\s-]?p|top[_\s-]?k)\b/i;
const UNSUPPORTED_PATTERN =
  /\b(?:deprecated|no longer supported|not supported|unsupported|not allowed|not permitted|cannot be (?:set|used|specified)|is not a (?:valid|supported)|removed)\b/i;

/**
 * Shared-state flag set by `processAPIError` and read by `processInputStep` on
 * the retried step. The processor state object is the same instance across all
 * method calls within a single request.
 */
const STRIP_SAMPLING_PARAMS_STATE_KEY = 'temperature-deprecated-handler:strip-sampling-params';

function getErrorCandidates(error: APICallError | Error): string[] {
  const candidates = [error.message];

  if (APICallError.isInstance(error) && typeof error.responseBody === 'string') {
    candidates.push(error.responseBody);
  }

  return candidates.filter(Boolean);
}

/**
 * Checks whether an error is a known "sampling parameter is no longer accepted"
 * rejection (`temperature`, `top_p`, or `top_k`).
 */
function isSamplingParamDeprecatedError(error: unknown): boolean {
  const matchesDeprecation = (message: string) =>
    SAMPLING_PARAM_PATTERN.test(message) && UNSUPPORTED_PATTERN.test(message);

  if (APICallError.isInstance(error)) {
    return getErrorCandidates(error).some(matchesDeprecation);
  }

  if (error instanceof Error) {
    return getErrorCandidates(error).some(matchesDeprecation);
  }

  return false;
}

/**
 * Handles "sampling parameter is deprecated" API errors reactively.
 *
 * Some models drop support for `temperature` / `top_p` / `top_k` within a
 * previously-supported family (e.g. Anthropic's `claude-opus-4-7`), and reject
 * any request that still carries them with a hard `400`. Mastra forwards the
 * default (or user-configured) `temperature` straight through to the provider,
 * so the run fails mid-stream with no automatic recovery.
 *
 * This processor catches that rejection, strips the offending sampling
 * parameters from `modelSettings`, and retries the same model once. It is the
 * sampling-parameter sibling of {@link PrefillErrorHandler}.
 *
 * It uses two hooks that run from different processor lists: `processAPIError`
 * (which fires for error processors) detects the rejection and signals a retry,
 * and `processInputStep` (which fires for input processors) strips the params
 * before the retried request. Register the **same instance in both lists** so
 * the two hooks share state:
 *
 * ```ts
 * const handler = new TemperatureDeprecatedHandler();
 *
 * const agent = new Agent({
 *   // ...
 *   inputProcessors: [handler],
 *   errorProcessors: [handler],
 * });
 * ```
 *
 * @see https://github.com/mastra-ai/mastra/issues/16247
 */
export class TemperatureDeprecatedHandler implements Processor<'temperature-deprecated-handler'> {
  readonly id = 'temperature-deprecated-handler' as const;
  readonly name = 'Temperature Deprecated Handler';

  processInputStep({ modelSettings, state }: ProcessInputStepArgs): ProcessInputStepResult | void {
    // Only act once a previous call has been rejected for these params.
    if (!state[STRIP_SAMPLING_PARAMS_STATE_KEY] || !modelSettings) return;

    const next = { ...modelSettings };
    let changed = false;

    if (next.temperature !== undefined) {
      delete next.temperature;
      changed = true;
    }
    if (next.topP !== undefined) {
      delete next.topP;
      changed = true;
    }
    if (next.topK !== undefined) {
      delete next.topK;
      changed = true;
    }

    if (!changed) return;

    return { modelSettings: next };
  }

  async processAPIError({ error, retryCount, state }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    // Only handle on first attempt — if it fails again after our fix, don't loop.
    if (retryCount > 0) return;

    if (!isSamplingParamDeprecatedError(error)) return;

    // Tell processInputStep (which shares this state object) to drop the
    // unsupported sampling params before the retried request is dispatched.
    // The flag stays set for the rest of the run so later steps keep stripping.
    state[STRIP_SAMPLING_PARAMS_STATE_KEY] = true;

    return { retry: true };
  }
}
