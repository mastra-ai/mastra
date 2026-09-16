/**
 * Shared media-result helpers for workspace tools.
 *
 * Tools that surface binary media (read_file for media files, the computer
 * screenshot tools) return a MediaToolResult so `toModelOutput` can present
 * the media as a native image/file part while only the `text` header is kept
 * in the stored/displayed result.
 */

/**
 * Internal marker on the tool's result that signals to `toModelOutput`
 * that the payload should be surfaced to the model as a media part (image or
 * binary file) rather than as plain text. We attach this on a wrapper object
 * but only the `text` field is shown to the model (via toModelOutput); the
 * marker is stripped before it ever reaches the model.
 *
 * The shape is intentionally JSON-serialisable so it round-trips through
 * storage layers that snapshot tool results.
 */
export type MediaToolResult = {
  __workspaceMedia: true;
  text: string;
  mediaType: string;
  data: string;
};

export function isMediaToolResult(value: unknown): value is MediaToolResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__workspaceMedia === true &&
    typeof (value as Record<string, unknown>).text === 'string' &&
    typeof (value as Record<string, unknown>).mediaType === 'string' &&
    typeof (value as Record<string, unknown>).data === 'string'
  );
}

/**
 * Default cap (in bytes) on inline media results. Payloads larger than this
 * fall back to text-only output instead of being fully base64-encoded into
 * the model context (and persisted in storage on rehydration). 10 MiB is
 * roughly aligned with provider per-image/per-pdf limits.
 */
export const DEFAULT_MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/**
 * Shared `toModelOutput` handler for tools that may return a MediaToolResult.
 * Surfaces the media as a native part; returns undefined for plain string
 * output so we don't store a duplicate copy on providerMetadata.
 */
export function mediaToModelOutput(output: unknown) {
  if (isMediaToolResult(output)) {
    return {
      type: 'content' as const,
      value: [
        { type: 'text' as const, text: output.text },
        { type: 'media' as const, data: output.data, mediaType: output.mediaType },
      ],
    };
  }
  return undefined;
}
