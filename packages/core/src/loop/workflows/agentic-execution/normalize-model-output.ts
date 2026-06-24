/**
 * Normalizes the output of a tool's `toModelOutput` transform into the
 * `{ type: 'content', value: [...] }` shape that the AI SDK and Gemini
 * provider expect, converting bare media/image-url objects and arrays
 * of parts as needed.
 *
 * Parts inside `value` are normalized so that:
 * - `type: 'media'`     -> `type: 'image-data'` (images) or `type: 'file-data'` (other)
 * - `type: 'image-url'` -> `type: 'image-data'`
 * - `type: 'image-data'` / `type: 'file-data'` -> kept as-is
 *
 * This ensures Gemini's `appendToolResultParts` emits `inlineData` blocks
 * instead of JSON-stringifying the part.
 */
export function normalizeModelOutput(output: unknown): unknown {
  if (output == null || typeof output !== 'object') return output;

  if (Array.isArray(output)) {
    return normalizeModelOutput({ type: 'content', value: output });
  }

  const obj = output as Record<string, unknown>;

  if (
    (obj.type === 'media' || obj.type === 'image-data' || obj.type === 'file-data' || obj.type === 'image-url') &&
    (typeof obj.data === 'string' || typeof obj.url === 'string')
  ) {
    return normalizeModelOutput({ type: 'content', value: [obj] });
  }

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
            : (part.url as string).startsWith('data:')
              ? (() => {
                  const raw = part.url as string;
                  const end = raw.indexOf(';') !== -1 ? raw.indexOf(';') : raw.indexOf(',');
                  return end > 5 ? raw.slice(5, end) : 'image/jpeg';
                })()
              : 'image/jpeg';
        return { type: 'image-data', data: part.url, mediaType };
      }

      if (part.type === 'media' && typeof part.data === 'string') {
        const mediaType = typeof part.mediaType === 'string' ? part.mediaType : 'application/octet-stream';
        return (mediaType as string).startsWith('image/')
          ? { type: 'image-data', data: part.data, mediaType }
          : { type: 'file-data', data: part.data, mediaType };
      }

      if ((part.type === 'image-data' || part.type === 'file-data') && typeof part.data === 'string') {
        return part;
      }

      return part;
    }),
  };
}
