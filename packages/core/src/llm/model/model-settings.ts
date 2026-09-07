import type { CallSettings } from '@internal/ai-sdk-v5';
import type { ReasoningLevel } from '../../loop/types';

/**
 * Time-based execution budget for an agent run.
 *
 * Both budgets are optional and independent. When omitted, no time limit is applied.
 */
export type ModelTimeoutSettings = {
  /**
   * Maximum wall-clock duration, in milliseconds, for an entire agent run.
   *
   * Covers every loop iteration, tool call and retry. When exceeded, the run is
   * aborted and fails with a `MastraTimeoutError` — fallback models are NOT tried,
   * because the total budget is a hard deadline for the whole run.
   */
  totalMs?: number;

  /**
   * Maximum wall-clock duration, in milliseconds, for a single model call.
   *
   * Covers both establishing the stream and consuming it, so a provider that opens
   * a stream and then stalls is also caught. When exceeded, the call fails with a
   * `MastraTimeoutError`, which is not retried against the same model but does
   * advance to the next entry in `models` when fallback models are configured.
   */
  stepMs?: number;
};

/**
 * Model call settings accepted by Mastra.
 *
 * `abortSignal` is omitted because cancellation is controlled by Mastra at the
 * call site rather than through model settings.
 */
export type MastraModelSettings = Omit<CallSettings, 'abortSignal'> & {
  /**
   * Reasoning effort level for the model. Controls how much reasoning
   * the model performs before generating a response.
   *
   * Only effective with LanguageModelV4 (AI SDK v7) model providers that support reasoning.
   * When used with older model providers (V2/V3), this option is a no-op.
   *
   * @default undefined (provider default behavior)
   */
  reasoning?: ReasoningLevel;

  /**
   * Time-based execution budget for the run and for individual model calls.
   *
   * @default undefined (no time limit)
   */
  timeout?: ModelTimeoutSettings;
};

/**
 * Model settings that can be configured per model entry.
 *
 * `maxRetries` and `headers` are omitted because they are configured alongside
 * the model itself rather than within its call settings.
 */
export type ModelConfigModelSettings = Omit<MastraModelSettings, 'maxRetries' | 'headers'>;
