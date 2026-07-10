import type { Hono } from 'hono';
import { createSpaStaticMiddleware } from 'mastracode-web/server-surface';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
].join('; ');

const RUNTIME_CONFIG_PATH = '/mastracode-desktop-runtime-config.js';

function injectRuntimeConfig(html: string): string {
  const script = `<script src="${RUNTIME_CONFIG_PATH}"></script>`;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`;
}

export function installStaticWebUi(app: Hono, webUiDistPath: string): void {
  app.get(RUNTIME_CONFIG_PATH, c => {
    c.header('Cache-Control', 'no-store');
    c.header('Content-Type', 'application/javascript; charset=utf-8');
    return c.body('window.__MASTRACODE_CONFIG__={"authEnabled":false};');
  });

  app.use('*', async (c, next) => {
    c.header('Content-Security-Policy', CSP);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    await next();
  });

  app.use(
    '*',
    createSpaStaticMiddleware(webUiDistPath, {
      transformIndexHtml: injectRuntimeConfig,
    }),
  );
}
