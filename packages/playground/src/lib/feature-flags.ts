const TRACE_REVIEW_STORAGE_KEY = 'mastra:flags:trace-review';

/**
 * Gates the conversation-review suite: Review mode on traces, the review form,
 * annotations, and the Threads surface.
 *
 * Resolution order: `?traceReview=on|off` URL override (persisted), then the
 * persisted localStorage value, then the `VITE_TRACE_REVIEW` build-time env.
 */
export function isTraceReviewEnabled(): boolean {
  try {
    const urlValue = new URLSearchParams(window.location.search).get('traceReview');
    if (urlValue === 'on' || urlValue === 'off') {
      window.localStorage.setItem(TRACE_REVIEW_STORAGE_KEY, urlValue);
    }
    const stored = window.localStorage.getItem(TRACE_REVIEW_STORAGE_KEY);
    if (stored === 'on') return true;
    if (stored === 'off') return false;
  } catch {}

  return import.meta.env.VITE_TRACE_REVIEW === 'true';
}
