/**
 * Reader for the runtime config the server (prod: src/web/html-config.ts) or
 * Vite (dev: runtimeConfigPlugin in src/web/vite.config.ts) injects into
 * index.html as `window.__MASTRACODE_CONFIG__`.
 *
 * The flag is optional on purpose: when it is absent (stale HTML, tests) the
 * app falls back to probing `/auth/me` and degrading gracefully, exactly as it
 * did before the flag existed.
 */

export interface RuntimeConfig {
  /** Whether the server has WorkOS auth configured. Absent = unknown. */
  authEnabled?: boolean;
}

declare global {
  interface Window {
    __MASTRACODE_CONFIG__?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  const config = window.__MASTRACODE_CONFIG__;
  if (!config || typeof config !== 'object') return {};
  return typeof config.authEnabled === 'boolean' ? { authEnabled: config.authEnabled } : {};
}
