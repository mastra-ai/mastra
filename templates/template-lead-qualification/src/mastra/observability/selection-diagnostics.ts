import { domainSchema } from '../contracts';

/** URL diagnostics never resolve hosts or affect source approval/retrieval. */
export function selectionDiagnosticUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = domainSchema.safeParse(url.hostname);
    if (
      !host.success ||
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      /(?:^|\.)(?:home|lan|corp|onion|alt|arpa)$/.test(host.data)
    )
      return null;
    url.hostname = host.data;
    url.search = url.hash = '';
    // Keep a bounded host/path prefix, without a partial percent escape.
    const bounded = url.href.slice(0, 512).replace(/%(?:[\da-f])?$/i, '');
    // A truncated dot segment must not normalize to a different persisted URL.
    return new URL(bounded).href === bounded ? bounded : null;
  } catch {
    return null;
  }
}
