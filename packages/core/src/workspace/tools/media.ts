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
 * Default mime types surfaced to the model as media parts. The list is
 * intentionally the intersection of image formats supported by the major
 * model providers (Anthropic, OpenAI, Gemini) plus `application/pdf`.
 * `image/*` is *not* used so we don't surface exotic subtypes like SVG/BMP
 * that some providers reject. Override `mediaTypes` to broaden this.
 */
export const DEFAULT_MEDIA_TYPES: string[] = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/**
 * Default cap (in bytes) on inline media results. Payloads larger than this
 * fall back to text-only output instead of being fully base64-encoded into
 * the model context (and persisted in storage on rehydration). 10 MiB is
 * roughly aligned with provider per-image/per-pdf limits.
 */
export const DEFAULT_MAX_MEDIA_BYTES = 10 * 1024 * 1024;

/** Bytes decoded from the start of a media file to check its signature. PDF allows its header anywhere in the first 1 KiB. */
export const MEDIA_SNIFF_BYTES = 1024;

const startsWithBytes = (bytes: Uint8Array, prefix: number[], offset = 0) =>
  bytes.length >= offset + prefix.length && prefix.every((byte, index) => bytes[offset + index] === byte);

/**
 * Media types with a fixed signature, and how to recognize each from a file's first bytes.
 * Other configured types (e.g. SVG, HEIC, audio) have no reliable signature here and are
 * trusted by extension.
 */
const MEDIA_SIGNATURES: [mediaType: string, matches: (bytes: Uint8Array) => boolean][] = [
  ['image/png', bytes => startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47])],
  ['image/jpeg', bytes => startsWithBytes(bytes, [0xff, 0xd8, 0xff])],
  // `GIF87a` or `GIF89a`.
  [
    'image/gif',
    bytes =>
      startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
      startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]),
  ],
  [
    'image/webp',
    bytes => startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8),
  ],
  // A version header such as `%PDF-1.7`, which readers accept anywhere in the first 1 KiB.
  ['application/pdf', bytes => /%PDF-\d\.\d/.test(Buffer.from(bytes).toString('latin1'))],
];

const SIGNED_MEDIA_TYPES = new Set([...MEDIA_SIGNATURES.map(([mediaType]) => mediaType), 'image/jpg']);

/**
 * The media type to send for a file whose extension maps to `declared`. For types with a known
 * signature, this is the type the bytes show (so a PNG named `.jpg` goes as `image/png`), or
 * undefined when they show none: an HTML error page saved as `.pdf` is not a PDF, and providers
 * reject it with a 400 that also fails every later call carrying the same history.
 */
export function contentMediaType(bytes: Uint8Array, declared: string): string | undefined {
  if (!SIGNED_MEDIA_TYPES.has(declared.split(';', 1)[0]!.trim().toLowerCase())) return declared;
  // Only the first MEDIA_SNIFF_BYTES count, however many the caller read, so every tool agrees on a file.
  const head = bytes.subarray(0, MEDIA_SNIFF_BYTES);
  return MEDIA_SIGNATURES.find(([, matches]) => matches(head))?.[0];
}

/** Whether a whole file is UTF-8 text: no NUL bytes and no invalid sequences. */
export function isUtf8Text(content: Uint8Array): boolean {
  if (content.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(content);
    return true;
  } catch {
    return false;
  }
}

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
