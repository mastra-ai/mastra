/**
 * Processor span payload projection.
 *
 * Processor phases (input, inputStep, outputResult, outputStep, outputStream)
 * pass a large "passThrough" / "stepInput" object along the phase chain that
 * carries the model instance, tools, provider options, model settings,
 * structured-output config, arbitrary processor state, and more.
 *
 * When that object is used as a span `input`/`output`, every enumerable
 * field is walked by `deepClean` — including TypeScript-`private` fields
 * that are still enumerable at runtime. That caused API keys stored inside
 * `ModelRouterLanguageModel.config` and gateway credentials to appear in
 * telemetry backends (Datadog, etc.).
 *
 * `ModelRouterLanguageModel.serializeForSpan()` plugs the model leak, but
 * fields like `tools`, `providerOptions.*.headers`, and `modelSettings.headers`
 * still carry user-supplied credentials.
 *
 * This helper projects a processor payload to a fixed allow-list of
 * debugging-useful, credential-free fields. New fields added to the
 * processor context in the future will NOT silently leak — they must be
 * added here explicitly.
 */
export const SAFE_PROCESSOR_SPAN_FIELDS: ReadonlyArray<string> = [
  'phase',
  'messages',
  'systemMessages',
  'stepNumber',
  'messageId',
  'retryCount',
  'finishReason',
  'text',
  'toolCalls',
  'toolChoice',
  'activeTools',
  'usage',
  'tripwire',
  'part',
  'messageListMutations',
  // OutputResult-shaped summary for outputResult / outputStep phases.
  // Schema is { text, usage, finishReason, steps } — `steps` is already
  // stripped by DEFAULT_KEYS_TO_STRIP, the rest are primitives.
  'result',
];

/**
 * Project a processor phase payload to a safe subset for span input/output.
 *
 * Returns the input unchanged when it isn't a plain object (null, arrays,
 * primitives, class instances that the caller explicitly chose to forward).
 *
 * Fields intentionally NOT forwarded:
 *   - `model` — hold a sanitized summary (e.g. `{ modelId, provider }`)
 *     separately when needed; full instance may carry gateway credentials
 *   - `tools` — ToolSet may wrap clients with auth
 *   - `providerOptions`, `modelSettings` — may contain user `headers` with Authorization
 *   - `structuredOutput` — schema/prompt config, noisy in spans
 *   - `state`, `processorStates` — arbitrary user/internal state
 *   - `messageList` — MessageList instance, redundant with `messages`
 *   - `rotateResponseMessageId`, `writer`, `abortSignal` — functions / runtime wiring
 *   - `requestContext` — user-supplied arbitrary context
 *   - `steps` — StepResult[] is already stripped by deepClean defaults
 */
export function projectProcessorSpanPayload<T>(value: T): T | Record<string, unknown> {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value;

  const src = value as Record<string, unknown>;
  const projected: Record<string, unknown> = {};

  for (const key of SAFE_PROCESSOR_SPAN_FIELDS) {
    if (src[key] !== undefined) {
      projected[key] = src[key];
    }
  }

  return projected;
}
