import * as coreMessageList from '@mastra/core/agent/message-list';

type PartClearer = <T>(part: T) => T;
type InPlaceClearer = (part: unknown) => void;

// Looked up on the namespace, not imported by name: an older @mastra/core doesn't export the
// clearers, and a named import would fail to load there. That Core doesn't clear stored counts
// when it edits a part, so Memory must not read any: without the clearers it counts the way it
// always did, validating each stored count against the part's content.
const exports = coreMessageList as unknown as Record<string, unknown>;

function lookup<T>(name: string): T | undefined {
  return name in exports && typeof exports[name] === 'function' ? (exports[name] as T) : undefined;
}

const clearCopy = lookup<PartClearer>('clearTokenEstimates');
const clearInPlace = lookup<InPlaceClearer>('clearTokenEstimatesInPlace');

/** True when the installed @mastra/core exports the clearers, so it drops stored counts wherever it edits a part. */
export const coreClearsTokenEstimates = clearCopy !== undefined && clearInPlace !== undefined;

/** A shallow copy of `part` with detached metadata and no stored token counts. */
export function clearTokenEstimates<T>(part: T): T {
  return clearCopy ? clearCopy(part) : part;
}

/** Removes stored token counts from `part` itself. */
export function clearTokenEstimatesInPlace(part: unknown): void {
  clearInPlace?.(part);
}
