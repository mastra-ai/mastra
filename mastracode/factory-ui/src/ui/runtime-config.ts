/**
 * Reader for the runtime config injected into index.html as
 * `window.__MASTRACODE_CONFIG__` (in dev by the runtimeConfigPlugin in
 * src/web/vite.config.ts; the static host may inject it in prod).
 *
 * The flag is optional on purpose: when it is absent (static prod build,
 * tests) the app falls back to probing `/auth/me` and degrading gracefully,
 * exactly as it did before the flag existed.
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
