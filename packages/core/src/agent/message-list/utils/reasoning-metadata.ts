import type { AIV5Type } from '../types';

/**
 * A step that dies after the model starts thinking but before the reasoning
 * signature arrives leaves a step block holding only unsigned reasoning.
 * Providers that require signed thinking (Anthropic, Bedrock) drop such parts,
 * sending `content: []` and failing every later turn with a 400 (#24558).
 */
const REPLAYABLE_REASONING_KEYS = [
  'signature',
  'redactedData',
  'itemId',
  'reasoningEncryptedContent',
  'thoughtSignature',
];

/**
 * Whether a reasoning part carries provider metadata a provider can replay
 * (a signature, redacted payload, item id). Such a part must survive every
 * conversion even when its visible text is empty, or the next turn loses the
 * signature and the provider rejects or re-bills the whole prompt (#1919).
 */
export function hasReplayableReasoningMetadata(providerOptions: AIV5Type.ProviderMetadata | undefined): boolean {
  return Object.values(providerOptions ?? {}).some(
    value => !!value && typeof value === 'object' && REPLAYABLE_REASONING_KEYS.some(key => key in value),
  );
}
