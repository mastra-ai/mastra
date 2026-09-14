const MAX_SESSION_TITLE_LENGTH = 80;

/**
 * The one shape a session row's title may take, wherever it comes from — typed
 * by a user at creation, generated for its thread, or refined by the observer.
 * Returns null when nothing readable is left, so callers can reject or skip.
 */
export function normalizeSessionTitle(title: string): string | null {
  // Cap code points, not UTF-16 units: an emoji straddling the cap would store a lone surrogate.
  const capped = [...title.replace(/\s+/g, ' ').trim()].slice(0, MAX_SESSION_TITLE_LENGTH).join('');
  return capped.trimEnd() || null;
}
