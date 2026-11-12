import { ModelRouterLanguageModel } from '@mastra/core/llm';
import type { AssistantConfig } from './config';

/** Share conservative, pre-dispatch model reservations across chat, goal judging and scheduled work. */
export function createExecutionBudget(config: AssistantConfig) {
  let windowStarted = Date.now();
  let calls = 0;
  let tokens = 0;
  let active = 0;

  /** Reserve calls and conservative text-work capacity before any provider request. */
  function reserve(options: Record<string, unknown>) {
    const now = Date.now();
    if (now - windowStarted >= 3600000) {
      windowStarted = now;
      calls = 0;
      tokens = 0;
    }
    if (
      options.maxOutputTokens !== undefined &&
      (typeof options.maxOutputTokens !== 'number' ||
        !Number.isInteger(options.maxOutputTokens) ||
        options.maxOutputTokens < 1)
    )
      throw new Error('Model output capacity must be a positive integer.');
    const maxOutputTokens = config.modelSettings?.maxOutputTokens ?? 4096;
    // UTF-8 bytes conservatively bound text tokens; include tool schemas and provider options.
    const inputBytes = Buffer.byteLength(JSON.stringify(options));
    const reservation = inputBytes + maxOutputTokens;
    if (
      inputBytes > 262144 ||
      active >= config.limits.concurrentModels ||
      calls >= config.limits.modelCallsPerHour ||
      tokens + reservation > config.limits.modelTokensPerHour
    )
      throw new Error('Assistant model capacity exhausted. Wait for capacity or review the configured limits.');
    active++;
    calls++;
    tokens += reservation;
    let released = false;
    return {
      maxOutputTokens: Math.min(
        typeof options.maxOutputTokens === 'number' ? options.maxOutputTokens : maxOutputTokens,
        maxOutputTokens,
      ),
      /** Release the concurrency slot once while retaining the spent hourly reservation. */
      release() {
        if (released) return;
        released = true;
        active--;
      },
    };
  }

  /** Preserve Mastra routing while checking every native model attempt before dispatch. */
  class BudgetedModel extends ModelRouterLanguageModel {
    /** Preserve native generate dispatch while applying the shared reservation guard. */
    override async doGenerate(options: Parameters<ModelRouterLanguageModel['doStream']>[0]) {
      return this.guarded(options, request => super.doGenerate(request));
    }

    /** Preserve native streaming dispatch while applying the shared reservation guard. */
    override async doStream(options: Parameters<ModelRouterLanguageModel['doStream']>[0]) {
      return this.guarded(options, request => super.doStream(request));
    }

    /** Release concurrency on provider failure, stream completion or caller cancellation. */
    private async guarded(
      options: Parameters<ModelRouterLanguageModel['doStream']>[0],
      dispatch: (
        options: Parameters<ModelRouterLanguageModel['doStream']>[0],
      ) => ReturnType<ModelRouterLanguageModel['doStream']>,
    ) {
      const slot = reserve(options as unknown as Record<string, unknown>);
      try {
        const response = await dispatch({ ...options, maxOutputTokens: slot.maxOutputTokens });
        const reader = response.stream.getReader();
        return {
          ...response,
          stream: new ReadableStream({
            /** Forward native model chunks and release capacity when the stream ends or fails. */
            async pull(controller) {
              try {
                const chunk = await reader.read();
                if (chunk.done) {
                  slot.release();
                  controller.close();
                } else controller.enqueue(chunk.value);
              } catch (error) {
                slot.release();
                controller.error(error);
              }
            },
            async cancel(reason) {
              try {
                await reader.cancel(reason);
              } finally {
                slot.release();
              }
            },
          }),
        };
      } catch (error) {
        slot.release();
        throw error;
      }
    }
  }
  return {
    model: (selection: ConstructorParameters<typeof ModelRouterLanguageModel>[0]) => new BudgetedModel(selection),
  };
}
