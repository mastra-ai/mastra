import type { MessageList } from '../agent/message-list';
import type { RequestContext } from '../request-context';
import type {
  Processor,
  ProcessAPIErrorArgs,
  ProcessAPIErrorResult,
  ProcessInputStepArgs,
  ProcessInputStepResult,
  ProcessOutputStepArgs,
} from './index';

/** A model the handler can switch to after a refusal. */
export type CyberRefusalFallbackModel = NonNullable<ProcessInputStepResult['model']>;

export interface CyberRefusalFallbackContext {
  /** 0 for the first fallback after the original model refused, 1 for the next, and so on. */
  attempt: number;
  requestContext?: RequestContext;
}

export interface CyberRefusalHandlerOptions {
  /**
   * Models to switch to when a refusal survives the `continue` nudge, tried in
   * order. Pass a function to choose the model when the refusal happens; return
   * `undefined` when there is none left. The switch lasts for the rest of the
   * run, and the next run starts on the agent's own model again.
   */
  fallbackModels?:
    | CyberRefusalFallbackModel[]
    | ((
        context: CyberRefusalFallbackContext,
      ) => CyberRefusalFallbackModel | undefined | Promise<CyberRefusalFallbackModel | undefined>);
}

const FALLBACK_ATTEMPT_KEY = 'fallbackAttempt';
const FALLBACK_MODEL_KEY = 'fallbackModel';

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
 * With `fallbackModels`, a refusal that survives the nudge switches the run to
 * the next fallback model instead of ending it. The switch happens in
 * `processInputStep`, so also register the same instance in `inputProcessors`.
 *
 * @see https://developers.openai.com/api/docs/guides/safety-checks/cybersecurity
 */
export class CyberRefusalHandler implements Processor<'cyber-refusal-handler'> {
  readonly id = 'cyber-refusal-handler' as const;
  readonly name = 'Cyber Refusal Handler';

  readonly #fallbackModels: CyberRefusalHandlerOptions['fallbackModels'];

  constructor(options: CyberRefusalHandlerOptions = {}) {
    this.#fallbackModels = options.fallbackModels;
  }

  processInputStep({ state }: ProcessInputStepArgs): ProcessInputStepResult | undefined {
    const model = state[FALLBACK_MODEL_KEY] as CyberRefusalFallbackModel | undefined;
    return model ? { model } : undefined;
  }

  async processAPIError({
    error,
    retryCount,
    sendSignal,
    state,
    requestContext,
  }: ProcessAPIErrorArgs): Promise<ProcessAPIErrorResult | void> {
    if (!isCyberRefusalError(error)) return;

    if (retryCount > 0) {
      // A repeated refusal is genuine unless a fallback model can take over
      return (await this.#switchToFallback(state, requestContext)) ? { retry: true } : undefined;
    }

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
    state,
    requestContext,
  }: ProcessOutputStepArgs): MessageList | Promise<MessageList> {
    if (!isCyberStopRefusal(finishReason, providerMetadata)) return messageList;
    // A repeated refusal is genuine unless a fallback model can take over
    if (retryCount > 0) {
      if (!this.#fallbackModels) return messageList;
      return this.#switchToFallback(state, requestContext).then(switched =>
        switched ? abort('continue', { retry: true }) : messageList,
      );
    }

    // The abort reason is the nudge: the loop appends it as the retry's system reminder.
    // A signal is not sent here because output-step signals don't seal the response
    // message, which breaks the loop's rollback of a later rejected step in the same run.
    return abort('continue', { retry: true });
  }

  async #switchToFallback(state: Record<string, unknown>, requestContext?: RequestContext): Promise<boolean> {
    const fallbacks = this.#fallbackModels;
    if (!fallbacks) return false;

    const attempt = (state[FALLBACK_ATTEMPT_KEY] as number | undefined) ?? 0;
    const model = Array.isArray(fallbacks) ? fallbacks[attempt] : await fallbacks({ attempt, requestContext });
    if (!model) return false;

    state[FALLBACK_ATTEMPT_KEY] = attempt + 1;
    state[FALLBACK_MODEL_KEY] = model;
    return true;
  }
}
