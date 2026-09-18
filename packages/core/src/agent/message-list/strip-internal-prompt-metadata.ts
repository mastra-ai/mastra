import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';

/** The only shape this module reads: a tool part carrying provider options. */
type PromptPartWithProviderOptions = {
  type?: string;
  providerOptions?: Record<string, unknown>;
};

/**
 * Removes Mastra's internal `modelOutput` provenance marker from an assembled prompt.
 *
 * Prompt assembly stamps `providerOptions.mastra.modelOutput` onto tool parts so that
 * anything running on the assembled prompt can tell a `toModelOutput`-mapped result apart
 * from a raw fallback. `ToolCallFilter` relies on it, on the tool-result part, to decide
 * what to compact when `preserveModelOutput` is enabled.
 *
 * The provider must not receive that internal copy — it duplicates the value already
 * carried in `output` — so it is removed here, at the boundary where the prompt is
 * forwarded to the model, once input processors have had their chance to read it. The
 * marker also rides on the assistant tool-call part, which no processor reads. Stored
 * message list parts keep their `providerMetadata.mastra.modelOutput`.
 *
 * Mutates the prompt's tool parts in place and returns the prompt. Callers pass a prompt
 * produced by `llmPrompt()`; its parts are built there and are not shared with the stored
 * message list.
 */
export function stripInternalPromptMetadata(prompt: LanguageModelV2Prompt): LanguageModelV2Prompt {
  for (const message of prompt) {
    if (!Array.isArray(message.content)) continue;

    for (const part of message.content as unknown as PromptPartWithProviderOptions[]) {
      if (part.type !== 'tool-call' && part.type !== 'tool-result') continue;

      const providerOptions = part.providerOptions as Record<string, unknown> | undefined;
      const mastraOptions = providerOptions?.mastra as Record<string, unknown> | undefined;
      if (!mastraOptions || typeof mastraOptions !== 'object' || !('modelOutput' in mastraOptions)) {
        continue;
      }

      const restMastra = { ...mastraOptions };
      delete restMastra.modelOutput;

      const restOptions = { ...providerOptions };
      if (Object.keys(restMastra).length > 0) {
        restOptions.mastra = restMastra;
      } else {
        delete restOptions.mastra;
      }

      if (Object.keys(restOptions).length > 0) {
        part.providerOptions = restOptions;
      } else {
        delete part.providerOptions;
      }
    }
  }

  return prompt;
}
