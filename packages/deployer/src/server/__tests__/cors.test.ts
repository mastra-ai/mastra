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

  it('uses path-specific CORS config for preflight requests', async () => {
    const mastra = new Mastra({
      server: {
        cors: {
          '*': { origin: '*' },
          '/api/agents/support-agent/channels/web/*': {
            origin: ['https://customer-saas.example'],
            credentials: true,
          },
        },
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

  it('does not add credentials to an explicit path-map fallback when auth is configured', async () => {
    const mastra = new Mastra({
      server: {
        auth: {
          authenticateToken: async () => ({ id: 'user' }),
        },
        cors: {
          '*': { origin: '*' },
          '/api/agents/support-agent/channels/web/*': {
            origin: ['https://customer-saas.example'],
            credentials: true,
          },
        },
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

  it('uses the most specific matching CORS path', async () => {
    const mastra = new Mastra({
      server: {
        cors: {
          '*': { origin: '*' },
          '/api/agents/*': { origin: ['https://agents.example'] },
          '/api/agents/support-agent/channels/web/*': {
            origin: ['https://customer-saas.example'],
            credentials: true,
          },
        },
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const response = await app.request(
      preflight('/api/agents/support-agent/channels/web/webhook', 'https://customer-saas.example'),
    );

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://customer-saas.example');
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('supports exact CORS path matches', async () => {
    const mastra = new Mastra({
      server: {
        cors: {
          '*': { origin: '*' },
          '/api/exact-webhook': {
            origin: ['https://exact.example'],
            credentials: true,
          },
        },
      },
    });
    const app = await createHonoServer(mastra, { tools: {} });

    const exactResponse = await app.request(preflight('/api/exact-webhook', 'https://exact.example'));
    const nestedResponse = await app.request(preflight('/api/exact-webhook/nested', 'https://exact.example'));

    expect(exactResponse.headers.get('Access-Control-Allow-Origin')).toBe('https://exact.example');
    expect(exactResponse.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(nestedResponse.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(nestedResponse.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  });

  it('applies default Mastra CORS headers to path-specific config', async () => {
    const mastra = new Mastra({
      server: {
        cors: {
          '/custom/*': {
            origin: ['https://custom.example'],
            allowHeaders: ['x-custom-header'],
          },
        },
        apiRoutes: [
          registerApiRoute('/custom/webhook', {
            method: 'POST',
            handler: c => c.json({ ok: true }),
            requiresAuth: false,
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
});
