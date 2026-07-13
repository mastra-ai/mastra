import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { installSecurityHeaders } from './static.js';

describe('installSecurityHeaders', () => {
  it('applies the security headers to routes registered after it', async () => {
    const app = new Hono();
    installSecurityHeaders(app);
    app.get('/api/example', c => c.json({ ok: true }));

    const response = await app.request('/api/example');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('covers error and not-found responses', async () => {
    const app = new Hono();
    installSecurityHeaders(app);

    const response = await app.request('/missing');

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
