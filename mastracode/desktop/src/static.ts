import type { Hono } from 'hono';
import { createSpaStaticMiddleware } from 'mastracode-web/server-surface';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

const RUNTIME_CONFIG_PATH = '/mastracode-desktop-runtime-config.js';

function injectRuntimeConfig(html: string): string {
  const script = `<script src="${RUNTIME_CONFIG_PATH}"></script>`;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`;
}

/**
 * Hono middleware only applies to routes registered after it, so this must be
 * installed before any route registration — bootstrap, auth, API, and static
 * responses all need the security headers.
 */
export function installSecurityHeaders(app: Hono): void {
  app.use('*', async (c, next) => {
    c.header('Content-Security-Policy', CSP);
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    c.header('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });
}

export function installStaticRenderer(app: Hono, rendererDistPath: string): void {
  app.get(RUNTIME_CONFIG_PATH, c => {
    c.header('Cache-Control', 'no-store');
    c.header('Content-Type', 'application/javascript; charset=utf-8');
    return c.body('window.__MASTRACODE_CONFIG__={"authEnabled":false};');
  });

  app.use(
    '*',
    createSpaStaticMiddleware(rendererDistPath, {
      transformIndexHtml: injectRuntimeConfig,
    }),
  );
}
