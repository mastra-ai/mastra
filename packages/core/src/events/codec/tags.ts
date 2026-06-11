import type { SerializedError } from '../../error/utils';

/**
 * Discriminator key for codec-tagged envelopes. Long, namespaced, and unlikely
 * to collide with user data. Plain objects that happen to carry this key but
 * do not match an envelope shape are preserved as-is by the decoder.
 */
export const CODEC_TAG = '__m_codec__';

/**
 * Upper bound on the `source` length of a serialized `RegExp` envelope. Real
 * serialized regexes are tens of characters at most; this is generous headroom
 * for unusual patterns while bounding the input to `new RegExp(...)` on decode
 * so a hostile peer cannot push an unbounded pattern through the constructor.
 */
const MAX_REGEXP_SOURCE_LENGTH = 1024;

export type EnvelopeTag = 'Date' | 'Error' | 'Map' | 'Set' | 'RegExp' | 'URL' | 'BigInt' | 'Undefined' | 'Class';

export type Envelope =
  | { [CODEC_TAG]: 'Date'; v: string }
  | { [CODEC_TAG]: 'Error'; v: SerializedError }
  | { [CODEC_TAG]: 'Map'; v: Array<[unknown, unknown]> }
  | { [CODEC_TAG]: 'Set'; v: Array<unknown> }
  | { [CODEC_TAG]: 'RegExp'; v: { source: string; flags: string } }
  | { [CODEC_TAG]: 'URL'; v: string }
  | { [CODEC_TAG]: 'BigInt'; v: string }
  | { [CODEC_TAG]: 'Undefined' }
  | { [CODEC_TAG]: 'Class'; n: string; v: unknown };

/**
 * Returns true when `value` looks like a codec envelope. The check is
 * conservative — an object with the tag key but an unknown tag value, or a
 * shape that does not match any envelope variant, is treated as user data.
 */
export function isEnvelope(value: object): value is Envelope {
  const tag = (value as Record<string, unknown>)[CODEC_TAG];
  if (typeof tag !== 'string') return false;
  switch (tag as EnvelopeTag) {
    case 'Undefined':
      return true;
    case 'Date':
    case 'BigInt':
    case 'URL':
      return typeof (value as { v?: unknown }).v === 'string';
    case 'RegExp': {
      const v = (value as { v?: unknown }).v as { source?: unknown; flags?: unknown } | undefined;
      if (!v || typeof v.source !== 'string' || typeof v.flags !== 'string') return false;
      // Bound `source` to a generous-but-finite length. Real-world serialized
      // regexes are tiny; a multi-KB pattern is either corrupted or a ReDoS
      // attempt, and we'd rather treat it as user data than feed it into
      // `new RegExp(...)`.
      if (v.source.length > MAX_REGEXP_SOURCE_LENGTH) return false;
      // Bound flags to the spec-defined RegExp flags. Anything else means the
      // payload is either corrupted or hostile — treat as user data and let
      // the decoder skip envelope reconstruction.
      return /^[dgimsuy]*$/.test(v.flags) && new Set(v.flags).size === v.flags.length;
    }
    case 'Map':
    case 'Set':
      return Array.isArray((value as { v?: unknown }).v);
    case 'Error':
      return typeof (value as { v?: unknown }).v === 'object' && (value as { v?: unknown }).v !== null;
    case 'Class':
      return typeof (value as { n?: unknown }).n === 'string';
    default:
      return false;
  }
}
