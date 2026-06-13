import type { Tool } from '@mastra/core/tools';

/**
 * Normalize modelOutput from toModelOutput() so that `type: 'media'` parts
 * are converted to `type: 'image-data'` or `type: 'file-data'` as AI SDK
 * providers expect. Mirrors `normalizeModelOutput` in @mastra/core's
 * llm-mapping-step, which performs the same normalization for server tools.
 */
function normalizeModelOutput(output: unknown): unknown {
  if (output == null || typeof output !== 'object') return output;

  const obj = output as Record<string, unknown>;
  if (obj.type !== 'content' || !Array.isArray(obj.value)) return output;

  return {
    ...obj,
    value: (obj.value as unknown[]).map(item => {
      if (item == null || typeof item !== 'object') return item;
      const part = item as Record<string, unknown>;
      if (part.type !== 'media') return part;
      if (typeof part.mediaType === 'string' && part.mediaType.startsWith('image/')) {
        return { type: 'image-data', data: part.data, mediaType: part.mediaType };
      }
      return { type: 'file-data', data: part.data, mediaType: part.mediaType };
    }),
  };
}

/**
 * Apply a client tool's `toModelOutput` mapping to its execution result.
 *
 * Client tools execute locally, so their `toModelOutput` mapping must also run
 * locally — the function cannot be serialized over HTTP. The transformed value
 * is sent back to the server as `providerOptions.mastra.modelOutput` on the
 * tool-result part, which the server already applies when building the next
 * model prompt. The raw result stays in the tool-result `output`/`result`
 * field for storage and application logic, matching server-tool semantics.
 *
 * Returns `undefined` when the tool defines no mapping, the result is null,
 * or the mapping itself returns null/undefined.
 */
export async function getClientToolModelOutput(clientTool: Tool, result: unknown): Promise<unknown> {
  const toModelOutput = (clientTool as { toModelOutput?: (output: unknown) => unknown }).toModelOutput;
  if (typeof toModelOutput !== 'function' || result == null) return undefined;

  const modelOutput = await toModelOutput(result);
  return modelOutput == null ? undefined : normalizeModelOutput(modelOutput);
}
