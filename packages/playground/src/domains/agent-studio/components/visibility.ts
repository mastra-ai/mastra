import type { VisibilityValue } from '@mastra/client-js';

/** Read a visibility value from any record's `metadata.visibility`. */
export function resolveVisibility(metadata: Record<string, unknown> | undefined): VisibilityValue {
  const raw = metadata?.visibility;
  return raw === 'public' ? 'public' : 'private';
}
