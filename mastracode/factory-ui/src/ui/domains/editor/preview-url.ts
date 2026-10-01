import type { PreviewBase } from '../../../api/types';

/**
 * Build the browser-facing preview URL for a sandbox-local port. Mirrors the
 * backend's `previewHostFor` scheme (`p-{port}-{slug}.preview.{parentHost}`)
 * but stays client-side — the slug + parentHost are handed to us by the
 * server via `useSessionPreviewBase`, so we don't repeat the hash.
 *
 * When `previewBase.available` is false we fall back to the raw
 * `http://localhost:{port}` URL: the click still lands on *something*
 * useful in a local dev sandbox (the user's own machine is running the
 * dev server), and remote deploys degrade to "click does nothing useful"
 * rather than "click goes to a wrong URL".
 */
export function buildSandboxPreviewUrl(port: number, previewBase: PreviewBase | undefined): string {
  const fallback = `http://localhost:${port}/`;
  if (!previewBase?.available || !previewBase.parentHost) return fallback;
  const origin = window.location;
  const portSuffix = origin.port ? `:${origin.port}` : '';
  const host = `p-${port}-${previewBase.slug}.preview.${previewBase.parentHost}${portSuffix}`;
  return `${origin.protocol}//${host}/`;
}

/**
 * Regex for a sandbox-local URL — the shape most dev servers print on
 * startup. Two variants share the pattern: an explicit `localhost` /
 * `127.0.0.1` host with an optional port, and IPv6 `[::]`/`[::1]`. Only
 * matches the origin — a following path or query is captured separately so
 * we preserve deep-link paths when we linkify.
 *
 * Anchored on word boundaries so we don't misfire on log lines that happen
 * to contain `localhost:` as a substring (`serverside-localhost:foo`).
 */
export const LOCALHOST_URL_RE = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1?\]):(\d{1,5})(\/[^\s]*)?/g;

export interface DetectedLocalhostUrl {
  /** The exact substring that matched in the source string. */
  match: string;
  /** Offset of the match in the source string. */
  start: number;
  /** Parsed port. */
  port: number;
  /** Path (with leading `/`) after the origin, empty when the url has none. */
  path: string;
}

export function detectLocalhostUrls(line: string): DetectedLocalhostUrl[] {
  // Zero-copy: RegExp.exec state doesn't survive across our regex constant
  // since it's used from multiple call sites, so use matchAll for each
  // scan and consume the iterator.
  const out: DetectedLocalhostUrl[] = [];
  for (const match of line.matchAll(LOCALHOST_URL_RE)) {
    const port = Number(match[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue;
    out.push({
      match: match[0],
      start: match.index ?? 0,
      port,
      path: match[2] ?? '',
    });
  }
  return out;
}
