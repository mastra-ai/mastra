/**
 * Shared helper for the per-iteration LLM execution step in both the
 * non-durable `loop/workflows/agentic-execution/llm-execution-step.ts` and
 * the durable `agent/durable/workflows/steps/llm-execution.ts`.
 *
 * Returns the args that get forwarded to `messageList.get.all.aiV5.llmPrompt`
 * / `aiV6.llmPrompt`. Resolves the model's `supportedUrls` (which AI SDK
 * providers may expose as a `PromiseLike`) before handing it back, so callers
 * can `await` once and forget.
 *
 * Keeping this in a single source of truth fixes the parity bug where the
 * durable step previously did not forward `supportedUrls`, which caused
 * provider-native URLs (e.g. Vertex `gs://`, Mistral PDF URLs) to be
 * downloaded and base64-inlined instead of passed through as references.
 * See https://github.com/mastra-ai/mastra/issues/12152.
 */

export interface BuildLlmPromptArgsInput {
  /**
   * The resolved AI SDK language model the request is about to be sent to.
   * Only `supportedUrls` is read; other fields are ignored.
   */
  model:
    | {
        supportedUrls?: Record<string, RegExp[]> | PromiseLike<Record<string, RegExp[]>>;
      }
    | null
    | undefined;
  /**
   * Optional retry count for downloading remote assets the model can't natively
   * fetch. Defaults to the underlying `MessageList` default (3) when omitted.
   */
  downloadRetries?: number;
  /**
   * Optional concurrency for downloading remote assets. Defaults to the
   * underlying `MessageList` default (10) when omitted.
   */
  downloadConcurrency?: number;
}

export interface BuildLlmPromptArgsResult {
  supportedUrls: Record<string, RegExp[]> | undefined;
  downloadRetries: number | undefined;
  downloadConcurrency: number | undefined;
}

export async function buildLlmPromptArgs({
  model,
  downloadRetries,
  downloadConcurrency,
}: BuildLlmPromptArgsInput): Promise<BuildLlmPromptArgsResult> {
  let supportedUrls: Record<string, RegExp[]> | undefined;
  const raw = model?.supportedUrls;
  if (raw) {
    if (typeof (raw as PromiseLike<unknown>).then === 'function') {
      supportedUrls = await (raw as PromiseLike<Record<string, RegExp[]>>);
    } else {
      supportedUrls = raw as Record<string, RegExp[]>;
    }
  }
  return {
    supportedUrls,
    downloadRetries,
    downloadConcurrency,
  };
}
