import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessOutputStepArgs,
  ProcessorMessageResult,
} from './index';

const CYBER_POLICY_ERROR_CODE = 'cyber_policy';
const CYBER_REFUSAL_MESSAGE = 'this content was flagged for possible cybersecurity risk';
const CYBER_STOP_CATEGORY = 'cyber';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

/**
 * Checks whether an error is an OpenAI cybersecurity-safeguard refusal.
 *
 * The same refusal reaches error processors in several shapes: an `APICallError`
 * from a failed HTTP response or a stream that failed before output (the payload
 * lives on `data` / `responseBody`), or a raw Responses stream event
 * (`{ type: 'error', error }`, flat `{ type: 'error', code }`, or
 * `{ type: 'response.failed', response: { error } }`). Matches the documented
 * `cyber_policy` error code or the refusal message, anywhere in that graph.
 */
function isCyberRefusalError(error: unknown): boolean {
  const visited = new WeakSet<object>();

  function visit(candidate: unknown): boolean {
    if (!isRecord(candidate) || visited.has(candidate)) return false;
    visited.add(candidate);

    const { code, message, responseBody } = candidate;
    if (typeof code === 'string' && code.toLowerCase() === CYBER_POLICY_ERROR_CODE) return true;
    if (typeof message === 'string' && message.toLowerCase().includes(CYBER_REFUSAL_MESSAGE)) return true;

    const parsedResponseBody = typeof responseBody === 'string' ? parseJson(responseBody) : undefined;

    return (
      visit(candidate.error) ||
      visit(candidate.response) ||
      visit(candidate.data) ||
      visit(parsedResponseBody) ||
      visit(candidate.cause)
    );
  }

  return visit(error);
}

/**
 * Checks whether a finished step was stopped by an Anthropic cyber classifier.
 *
 * Anthropic reports classifier refusals as a successful response with
 * `stop_reason: "refusal"`, which the AI SDK maps to a `content-filter` finish
 * reason and `stopDetails: { type: 'refusal', category: 'cyber' }` in provider
 * metadata. Every provider-metadata namespace is checked so the refusal is
 * still recognized when Claude is reached through another provider.
 */
function isCyberStopRefusal(finishReason: string | undefined, providerMetadata: unknown): boolean {
  if (finishReason !== 'content-filter' || !isRecord(providerMetadata)) return false;

  return Object.values(providerMetadata).some(namespace => {
    const stopDetails = isRecord(namespace) ? namespace.stopDetails : undefined;
    return (
      isRecord(stopDetails) &&
      typeof stopDetails.category === 'string' &&
      stopDetails.category.toLowerCase() === CYBER_STOP_CATEGORY
    );
  });
}

/**
 * Retries once after a cybersecurity-safeguard refusal from OpenAI or Anthropic.
 *
 * Provider cyber safeguards can refuse ordinary repository work, often partway
 * through a long agentic loop. These refusals are frequently false positives,
 * and nudging the model to continue usually gets past them. This processor
 * retries the step a single time with that nudge; if the retried step is
 * refused again, the refusal is treated as genuine.
 *
 * - OpenAI refuses with a `cyber_policy` error ("This content was flagged for
 *   possible cybersecurity risk..."), handled in `processAPIError`, which
 *   appends a `continue` system reminder.
 * - Anthropic stops the response with a `cyber` classifier refusal (finish
 *   reason `content-filter`), handled in `processOutputStep`. The refused step
 *   is rolled back and the retry appends the same `continue` system reminder.
 *
 * Register it in both lanes: `errorProcessors` for OpenAI refusals (an agent
 * only runs `processAPIError` for error processors) and `outputProcessors` for
 * Anthropic refusals. In `errorProcessors`, place it before
 * {@link StreamErrorRetryProcessor}, which would otherwise spend the retry
 * resending the unchanged request. Output-step retries count against
 * `maxProcessorRetries`, which is not given an implicit default the way the
 * error lane is, so set it explicitly or the Anthropic retry is treated as an
 * abort.
 *
 * @see https://developers.openai.com/api/docs/guides/safety-checks/cybersecurity
 */
export class CyberRefusalHandler implements Processor<'cyber-refusal-handler'> {
  readonly id = 'cyber-refusal-handler' as const;
  readonly name = 'Cyber Refusal Handler';

  async processAPIError({ error, retryCount, sendSignal }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    // Only handle on first attempt — a repeated refusal is treated as genuine
    if (retryCount > 0) return;

    if (!isCyberRefusalError(error)) return;

    await sendSignal?.({
      type: 'reactive',
      tagName: 'system-reminder',
      contents: 'continue',
    });

    return { retry: true };
  }

  processOutputStep({
    finishReason,
    providerMetadata,
    retryCount,
    abort,
    messageList,
  }: ProcessOutputStepArgs): ProcessorMessageResult {
    if (retryCount > 0 || !isCyberStopRefusal(finishReason, providerMetadata)) return messageList;

    // The abort reason is the nudge: the loop appends it as the retry's system reminder.
    // A signal is not sent here because output-step signals don't seal the response
    // message, which breaks the loop's rollback of a later rejected step in the same run.
    return abort('continue', { retry: true });
  }
}
