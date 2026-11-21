import * as coreMessageList from '@mastra/core/agent/message-list';

type PartClearer = <T>(part: T) => T;
type InPlaceClearer = (part: unknown) => void;

// Looked up on the namespace, not imported by name: an older @mastra/core has none of these
// exports, and a named import would fail to load there. Without them, Core's own message edits
// don't clear trusted counts, so Memory must not trust any.
const exports = coreMessageList as unknown as Record<string, unknown>;

/** True when the installed @mastra/core clears trusted token counts wherever it edits a part. */
export const coreClearsTrustedTokenEstimates = exports.TRUSTED_TOKEN_ESTIMATE_INVALIDATION === 1;

const clearCopy = exports.clearTrustedTokenEstimates as PartClearer | undefined;
const clearInPlace = exports.clearTrustedTokenEstimatesInPlace as InPlaceClearer | undefined;

/** A shallow copy of `part` with detached metadata and no trusted token counts. */
export function clearTrustedTokenEstimates<T>(part: T): T {
  return clearCopy ? clearCopy(part) : part;
}

/** Removes trusted token counts from `part` itself. */
export function clearTrustedTokenEstimatesInPlace(part: unknown): void {
  clearInPlace?.(part);
}
