/** Deliver one feedback or score record whose span context must be resolved by Platform. */
export async function publishResolvedRecord(url: URL, body: string, headers: Record<string, string>): Promise<void> {
  // This deadline includes response bodies and backoff, so flush/shutdown cannot
  // wait indefinitely for an anchor that never arrives.
  const deadline = AbortSignal.timeout(30_000);
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(url, { method: 'POST', headers, body, signal: deadline });
    if (response.ok) {
      await response.body?.cancel();
      return;
    }

    const error = (await response.json().catch(() => null)) as { code?: string; error?: { code?: string } } | null;
    const code = error?.code ?? error?.error?.code;
    const retryable =
      (response.status === 404 && (code === 'TRACE_NOT_FOUND' || code === 'SPAN_NOT_FOUND')) ||
      (response.status === 503 && code === 'ANCHOR_LOOKUP_UNAVAILABLE');
    if (!retryable || attempt === 5) {
      throw new Error(`Platform record delivery failed: HTTP ${response.status}${code ? ` (${code})` : ''}`);
    }

    const retryAfter = response.headers.get('retry-after');
    const retryAfterMs = retryAfter
      ? /^\d+(?:\.\d+)?$/.test(retryAfter)
        ? Number(retryAfter) * 1000
        : Date.parse(retryAfter) - Date.now()
      : 0;
    const delay = Math.max(Math.min(500 * 2 ** attempt, 4000), Number.isFinite(retryAfterMs) ? retryAfterMs : 0);
    await new Promise<void>((resolve, reject) => {
      deadline.throwIfAborted();
      const timer = setTimeout(
        () => {
          deadline.removeEventListener('abort', abort);
          resolve();
        },
        Math.min(delay, 30_000),
      );
      function abort() {
        clearTimeout(timer);
        reject(deadline.reason);
      }
      deadline.addEventListener('abort', abort, { once: true });
    });
  }
}
