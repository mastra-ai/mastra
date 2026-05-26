import { Mastra } from '@mastra/core/mastra';
import { registerApiRoute } from '@mastra/core/server';
import { describe, expect, it } from 'vitest';
import { createHonoServer } from '../index';

const preflight = (path: string, origin: string) =>
  new Request(`http://localhost${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
    },
  });

describe('server CORS', () => {
  it('uses the legacy CORS config for every route', async () => {
    const mastra = new Mastra({
      server: {
        cors: {
          origin: ['https://app.example'],
          credentials: true,
        },
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/api/agents', 'https://app.example'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('uses route-specific CORS config for preflight requests', async () => {
    const mastra = new Mastra({
      server: {
        apiRoutes: [
          registerApiRoute('/custom/webhook', {
            method: 'POST',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
            cors: {
              origin: ['https://customer-saas.example'],
              credentials: true,
            },
          }),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const customResponse = await app.request(preflight('/custom/webhook', 'https://customer-saas.example'));
    const otherResponse = await app.request(preflight('/api/agents', 'https://customer-saas.example'));

    expect(customResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://customer-saas.example');
    expect(customResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(otherResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(otherResponse.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('uses route-specific CORS config for internal API routes', async () => {
    const mastra = new Mastra({
      server: {
        apiRoutes: [
          {
            path: '/api/agents/support-agent/channels/web/webhook',
            method: 'POST',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
            _mastraInternal: true,
            cors: {
              origin: ['https://customer-saas.example'],
              credentials: true,
            },
          },
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const channelResponse = await app.request(
      preflight('/api/agents/support-agent/channels/web/webhook', 'https://customer-saas.example'),
    );
    const otherResponse = await app.request(preflight('/api/agents', 'https://customer-saas.example'));

    expect(channelResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://customer-saas.example');
    expect(channelResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(otherResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(otherResponse.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('does not inherit auth credential defaults for route-specific CORS config', async () => {
    const mastra = new Mastra({
      server: {
        auth: {
          authenticateToken: async () => ({ id: 'user' }),
        },
        apiRoutes: [
          registerApiRoute('/custom/webhook', {
            method: 'POST',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
            cors: {
              origin: ['https://customer-saas.example'],
            },
          }),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/custom/webhook', 'https://customer-saas.example'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://customer-saas.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('keeps auth credential defaults for legacy CORS config', async () => {
    const mastra = new Mastra({
      server: {
        auth: {
          authenticateToken: async () => ({ id: 'user' }),
        },
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/api/agents', 'https://app.example'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('matches dynamic route paths for route-specific CORS config', async () => {
    const mastra = new Mastra({
      server: {
        apiRoutes: [
          registerApiRoute('/custom/:id/webhook', {
            method: 'POST',
            handler: c => c.json({ id: c.req.param('id') }),
            requiresAuth: false,
            cors: {
              origin: ['https://customer-saas.example'],
              credentials: true,
            },
          }),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/custom/tenant-1/webhook', 'https://customer-saas.example'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://customer-saas.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('applies default Mastra CORS headers to route-specific config', async () => {
    const mastra = new Mastra({
      server: {
        apiRoutes: [
          registerApiRoute('/custom/webhook', {
            method: 'POST',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
            cors: {
              origin: ['https://custom.example'],
              allowHeaders: ['x-custom-header'],
            },
          }),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/custom/webhook', 'https://custom.example'));
    const allowHeaders = response.headers.get('Access-Control-Allow-Headers');

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://custom.example');
    expect(allowHeaders).toContain('x-mastra-client-type');
    expect(allowHeaders).toContain('x-custom-header');
  });

  it('uses route-specific CORS only for matching methods', async () => {
    const mastra = new Mastra({
      server: {
        apiRoutes: [
          registerApiRoute('/custom/webhook', {
            method: 'GET',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
            cors: {
              origin: ['https://custom.example'],
              credentials: true,
            },
          }),
        ],
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(preflight('/custom/webhook', 'https://custom.example'));

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });
});
