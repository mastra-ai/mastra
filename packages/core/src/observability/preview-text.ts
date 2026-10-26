/** Maximum preview length, before the trailing `…`, including supplied previews. */
export const PREVIEW_MAX_LENGTH = 100;

export function truncatePreview(text: string, maxLength = PREVIEW_MAX_LENGTH): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= maxLength) return trimmed;
  // Never end on half of a surrogate pair.
  const end = maxLength > 0 && /[\uD800-\uDBFF]/.test(trimmed[maxLength - 1]!) ? maxLength - 1 : maxLength;
  return `${trimmed.slice(0, end)}…`;
}
