import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import {
  buildPreviewUrl,
  createPreviewDispatchMiddleware,
  createPreviewNotImplementedHandler,
  parentHostFromPublicUrl,
  parsePreviewHost,
  previewHostFor,
  sessionSlug,
} from './preview.js';

describe('sessionSlug', () => {
  it('is deterministic for the same session id', () => {
    expect(sessionSlug('sess-1')).toBe(sessionSlug('sess-1'));
  });
  it('differs for different session ids', () => {
    expect(sessionSlug('sess-1')).not.toBe(sessionSlug('sess-2'));
  });
  it('always emits exactly ten lowercase Crockford characters', () => {
    for (const id of ['a', 'sess-1', 'a'.repeat(200), 'weirdChars 🔥']) {
      const slug = sessionSlug(id);
      expect(slug).toHaveLength(10);
      expect(slug).toMatch(/^[0-9a-hjkmnp-tv-z]+$/);
    }
  });
  it('rejects an empty session id', () => {
    expect(() => sessionSlug('')).toThrow();
  });
});

describe('previewHostFor', () => {
  it('assembles the canonical hostname for a local sandbox', () => {
    const host = previewHostFor(3000, 'sess-1', 'localhost');
    expect(host).toBe(`p-3000-${sessionSlug('sess-1')}.preview.localhost`);
  });
  it('assembles the canonical hostname for a subdomain deploy', () => {
    const host = previewHostFor(8080, 'sess-42', 'studio-x.mastra.cloud');
    expect(host).toBe(`p-8080-${sessionSlug('sess-42')}.preview.studio-x.mastra.cloud`);
  });
  it('rejects out-of-range ports', () => {
    expect(() => previewHostFor(0, 'sess', 'localhost')).toThrow();
    expect(() => previewHostFor(65536, 'sess', 'localhost')).toThrow();
    expect(() => previewHostFor(3.14, 'sess', 'localhost')).toThrow();
  });
});

describe('buildPreviewUrl', () => {
  it('preserves the origin scheme and port from publicUrl', () => {
    const url = buildPreviewUrl(5173, 'sess-1', 'http://localhost:4111');
    expect(url).toBe(`http://p-5173-${sessionSlug('sess-1')}.preview.localhost:4111/`);
  });
  it('drops any path or query on the source url', () => {
    const url = buildPreviewUrl(3000, 'sess-1', 'https://studio-x.mastra.cloud/dashboard?foo=1');
    expect(url).toBe(`https://p-3000-${sessionSlug('sess-1')}.preview.studio-x.mastra.cloud/`);
  });
});

describe('parsePreviewHost', () => {
  it('parses a well-formed preview host', () => {
    const subdomain = parsePreviewHost(`p-3000-${sessionSlug('sess-1')}.preview.localhost:4111`, 'localhost');
    expect(subdomain).toEqual({ port: 3000, sessionSlug: sessionSlug('sess-1'), parentHost: 'localhost' });
  });
  it('accepts a subdomain deploy parent host', () => {
    const parent = 'studio-x.mastra.cloud';
    const slug = sessionSlug('sess-42');
    const subdomain = parsePreviewHost(`p-8080-${slug}.preview.${parent}`, parent);
    expect(subdomain).toEqual({ port: 8080, sessionSlug: slug, parentHost: parent });
  });
  it('returns null for non-preview hosts', () => {
    expect(parsePreviewHost('localhost:4111', 'localhost')).toBeNull();
    expect(parsePreviewHost('studio-x.mastra.cloud', 'studio-x.mastra.cloud')).toBeNull();
    expect(parsePreviewHost('sneaky.preview.other.host', 'localhost')).toBeNull();
  });
  it('rejects malformed labels', () => {
    // Uppercase slug (parser lowercases input first), so still fine.
    expect(parsePreviewHost(`p-3000-${sessionSlug('a').toUpperCase()}.preview.localhost`, 'localhost')).not.toBeNull();
    // Missing port.
    expect(parsePreviewHost('p--abcdefghij.preview.localhost', 'localhost')).toBeNull();
    // Non-numeric port.
    expect(parsePreviewHost('p-abc-abcdefghij.preview.localhost', 'localhost')).toBeNull();
    // Port out of range.
    expect(parsePreviewHost('p-99999-abcdefghij.preview.localhost', 'localhost')).toBeNull();
    // Extra labels between p-… and preview.
    expect(parsePreviewHost('p-3000-abcdefghij.middle.preview.localhost', 'localhost')).toBeNull();
  });
  it('is case-insensitive on both host and parent', () => {
    const subdomain = parsePreviewHost(`P-3000-${sessionSlug('sess').toUpperCase()}.Preview.LOCALHOST`, 'LocalHost');
    expect(subdomain?.port).toBe(3000);
  });
  it('returns null for empty or missing host header', () => {
    expect(parsePreviewHost(null, 'localhost')).toBeNull();
    expect(parsePreviewHost(undefined, 'localhost')).toBeNull();
    expect(parsePreviewHost('', 'localhost')).toBeNull();
  });
});

describe('parentHostFromPublicUrl', () => {
  it('returns the hostname for a hostname URL', () => {
    expect(parentHostFromPublicUrl('http://localhost:4111')).toBe('localhost');
    expect(parentHostFromPublicUrl('https://studio-x.mastra.cloud')).toBe('studio-x.mastra.cloud');
  });
  it('returns null for IP literals — wildcard subdomains do not work on IPs', () => {
    expect(parentHostFromPublicUrl('http://127.0.0.1:4111')).toBeNull();
    expect(parentHostFromPublicUrl('http://[::1]:4111')).toBeNull();
  });
  it('returns null for garbage input', () => {
    expect(parentHostFromPublicUrl('not-a-url')).toBeNull();
  });
});

describe('createPreviewDispatchMiddleware', () => {
  it('routes matching hosts to the preview handler', async () => {
    const app = new Hono();
    app.use(
      '*',
      createPreviewDispatchMiddleware({
        parentHost: 'localhost',
        handle: createPreviewNotImplementedHandler(),
      }),
    );
    app.get('*', c => c.text('normal-routing'));

    const previewResponse = await app.request(new Request('http://p-3000-abcdefghij.preview.localhost:4111/'));
    expect(previewResponse.status).toBe(501);
    const payload = (await previewResponse.json()) as { port: number; sessionSlug: string };
    expect(payload.port).toBe(3000);
    expect(payload.sessionSlug).toBe('abcdefghij');
  });
  it('falls through to next() for non-preview hosts', async () => {
    const app = new Hono();
    app.use(
      '*',
      createPreviewDispatchMiddleware({
        parentHost: 'localhost',
        handle: createPreviewNotImplementedHandler(),
      }),
    );
    app.get('*', c => c.text('normal-routing'));

    const response = await app.request(new Request('http://localhost:4111/'));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('normal-routing');
  });
  it('honors X-Forwarded-Host when the direct Host header is missing the preview label', async () => {
    // Simulates deployments behind a proxy that terminates TLS on the
    // wildcard host and forwards to a private origin.
    const app = new Hono();
    app.use(
      '*',
      createPreviewDispatchMiddleware({
        parentHost: 'studio-x.mastra.cloud',
        handle: createPreviewNotImplementedHandler(),
      }),
    );
    const request = new Request('http://internal.local/', {
      headers: { host: 'internal.local', 'x-forwarded-host': `p-8080-abcdefghij.preview.studio-x.mastra.cloud` },
    });
    const response = await app.request(request);
    expect(response.status).toBe(501);
  });
});
