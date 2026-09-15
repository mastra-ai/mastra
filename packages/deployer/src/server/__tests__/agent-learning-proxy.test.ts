import process from 'node:process';
import { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHonoServer } from '../index';

const fetchMock = vi.fn<typeof fetch>();
const originalEnvironment = {
  accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN,
  projectId: process.env.MASTRA_PROJECT_ID,
  endpoint: process.env.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT,
};

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function createMastra() {
  return new Mastra({ logger: false });
}

describe('Agent Learning development proxy', () => {
  beforeEach(() => {
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN = 'platform-token';
    process.env.MASTRA_PROJECT_ID = 'project-1';
    process.env.MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT = 'https://learning.example';
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    restoreEnvironment('MASTRA_PLATFORM_ACCESS_TOKEN', originalEnvironment.accessToken);
    restoreEnvironment('MASTRA_PROJECT_ID', originalEnvironment.projectId);
    restoreEnvironment('MASTRA_PLATFORM_AGENT_LEARNING_ENDPOINT', originalEnvironment.endpoint);
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('proxies same-origin development requests with server-owned credentials and project scope', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ entities: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const app = await createHonoServer(createMastra(), { tools: {}, isDev: true, studio: true });

    const response = await app.request('http://localhost/api/learning/entities?entityType=agent', {
      headers: {
        authorization: 'Bearer browser-token',
        cookie: 'wos-session=browser-session',
        'X-Mastra-Organization-Id': 'browser-org',
        'X-Mastra-Project-Id': 'browser-project',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ entities: [] });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0]!;
    expect(String(upstreamUrl)).toBe('https://learning.example/api/learning/entities?entityType=agent');
    expect(upstreamInit).toMatchObject({ method: 'GET' });
    const headers = new Headers(upstreamInit?.headers);
    expect(headers.get('authorization')).toBe('Bearer platform-token');
    expect(headers.get('X-Mastra-Project-Id')).toBe('project-1');
    expect(headers.has('X-Mastra-Organization-Id')).toBe(false);
    expect(headers.has('cookie')).toBe(false);
  });

  it('rejects cross-origin browser requests before using platform credentials', async () => {
    const app = await createHonoServer(createMastra(), { tools: {}, isDev: true, studio: true });

    const response = await app.request('http://localhost/api/learning/entities?entityType=agent', {
      headers: { origin: 'https://attacker.example' },
    });

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects requests served from a non-loopback host', async () => {
    const app = await createHonoServer(createMastra(), { tools: {}, isDev: true, studio: true });

    const response = await app.request('http://192.168.1.20/api/learning/entities?entityType=agent');

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when local platform credentials are missing', async () => {
    delete process.env.MASTRA_PLATFORM_ACCESS_TOKEN;
    const app = await createHonoServer(createMastra(), { tools: {}, isDev: true, studio: true });

    const response = await app.request('http://localhost/api/learning/entities?entityType=agent');

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not expose the proxy outside development mode', async () => {
    const app = await createHonoServer(createMastra(), { tools: {}, studio: true });

    const response = await app.request('http://localhost/api/learning/entities?entityType=agent');

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
