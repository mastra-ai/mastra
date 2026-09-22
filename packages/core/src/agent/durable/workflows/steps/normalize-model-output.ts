/**
 * Normalize modelOutput from toModelOutput() into the lossless V2-authored
 * storage shape kept in `providerMetadata.mastra.modelOutput`.
 *
 * Base64 payloads (`image-data`/`file-data`, and `image-url` parts carrying a
 * `data:` URI) are stored as the V2 `media` content type. Remote-URL parts
 * (`image-url`/`file-url`) are kept as-is because `media.data` is Base64-only —
 * the spec-boundary prompt converters (aiV5PromptToAIV6Prompt /
 * aiV5PromptToAIV7Prompt) emit the correct URL-shaped part for the target
 * model's specification version.
 *
 * `providerOptions` and any other author-supplied keys are preserved.
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
        // Remote URLs can't be represented as `media` (Base64-only `data`).
        // Keep the part untouched — url, mediaType and providerOptions intact.
        // Scheme matching is case-insensitive per RFC 3986.
        if (!/^data:/i.test(part.url)) return part;
        // data: URIs are Base64 payloads, so `media` is the right storage shape.
        const mediaType =
          typeof part.mediaType === 'string' && part.mediaType
            ? part.mediaType
            : part.url.slice(5, part.url.indexOf(';')) || 'image/jpeg';
        const rest = { ...part };
        delete rest.url;
        return { ...rest, type: 'media', data: part.url, mediaType };
      }
      if (part.type === 'image-data' && typeof part.data === 'string') {
        return { ...part, type: 'media', mediaType: part.mediaType ?? 'image/jpeg' };
      }
      if (part.type === 'file-data' && typeof part.data === 'string') {
        return { ...part, type: 'media', mediaType: part.mediaType ?? 'application/octet-stream' };
      }
      return part;
    }),
  };
}
