/**
 * Tool-invocation parts whose `mastra.modelOutput` / `modelOutputComputed`
 * markers this process computed itself (by `applyClientToolModelOutput`).
 * Tracked by object identity, so client-sent copies of the markers never match.
 */
export const serverComputedParts = new WeakSet<object>();
