/**
 * Normalize modelOutput from toModelOutput() into the AI SDK's
 * LanguageModelV2ToolResultOutput shape.
 *
 * The AI SDK's content array only accepts type 'text' or 'media'.
 * Mastra's createTool docs expose image-url as a convenience shorthand,
 * so normalize it here into type 'media' with the correct structure.
 */
export function normalizeModelOutput(output: unknown): unknown {
  if (output == null || typeof output !== 'object') return output;

  const obj = output as Record<string, unknown>;
  if (obj.type !== 'content' || !Array.isArray(obj.value)) return output;

  return {
    ...obj,
    value: (obj.value as unknown[]).map(item => {
      if (item == null || typeof item !== 'object') return item;
      const part = item as Record<string, unknown>;
      if (part.type === 'image-url' && typeof part.url === 'string') {
        const mediaType =
          typeof part.mediaType === 'string' && part.mediaType
            ? part.mediaType
            : part.url.startsWith('data:')
              ? part.url.slice(5, part.url.indexOf(';')) || 'image/jpeg'
              : 'image/jpeg';
        return { type: 'media', data: part.url, mediaType };
      }
      if (part.type === 'image-data' && typeof part.data === 'string') {
        return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'image/jpeg' };
      }
      if (part.type === 'file-data' && typeof part.data === 'string') {
        return { type: 'media', data: part.data, mediaType: part.mediaType ?? 'application/octet-stream' };
      }
      return part;
    }),
  };
}
