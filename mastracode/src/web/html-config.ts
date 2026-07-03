/**
 * Runtime-config injection for the served SPA `index.html`.
 *
 * The web server knows at runtime whether WorkOS auth is enabled
 * (`isWebAuthEnabled()`); the static Vite build cannot. Injecting
 * `window.__MASTRACODE_CONFIG__` into the served HTML lets the frontend skip
 * the `/auth/me` probe entirely when auth is disabled (see
 * `src/web/ui/runtime-config.ts` for the reader). In dev, a Vite
 * `transformIndexHtml` plugin performs the equivalent injection.
 */

/** Runtime flags the server passes to the SPA. Keep this to plain booleans. */
export interface WebRuntimeConfig {
  /** Whether the server has WorkOS auth configured. */
  authEnabled: boolean;
}

/**
 * Insert the runtime-config script right after `<head>` so it runs before any
 * other script (theme bootstrap, module entry). Falls back to prepending when
 * the markup has no `<head>` tag.
 */
export function injectRuntimeConfig(html: string, config: WebRuntimeConfig): string {
  const script = `<script>window.__MASTRACODE_CONFIG__ = ${JSON.stringify({ authEnabled: config.authEnabled })};</script>`;
  const headMatch = /<head[^>]*>/i.exec(html);
  if (!headMatch) return script + html;
  const insertAt = headMatch.index + headMatch[0].length;
  return html.slice(0, insertAt) + script + html.slice(insertAt);
}
