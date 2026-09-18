/**
 * Normalize modelOutput from toModelOutput() for storage in
 * providerMetadata.mastra.modelOutput.
 *
 * `image-data` / `file-data` parts carry raw Base64 and are stored in the
 * V2-compatible `media` shape that the prompt builders convert per target
 * model spec. `image-url` parts are stored as-is (including their
 * `providerOptions`): the AI SDK `v3` spec consumes `image-url` directly, and
 * consumers targeting other specs downgrade it when building the prompt —
 * collapsing it here would corrupt the stored form (a URL is not Base64
 * `media.data`) and drop the part's providerOptions.
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

/**
 * Downgrade `image-url` tool-result parts to the V2 `media` shape for prompts
 * targeting spec-`v2` models, whose tool-result output has no URL form. The
 * data field carries the URL as a best effort (legacy behavior — some
 * providers accept it); spec-`v3`+ consumers receive `image-url` unchanged.
 */
export function downgradeImageUrlPartsForV2(output: unknown): unknown {
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
      return part;
    }),
  };
}
