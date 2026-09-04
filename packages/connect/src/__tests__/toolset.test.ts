import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { MastraConnectError } from '../errors.js';
import { applyAllowTools, defineProxyTool, resolveConnectionId } from '../toolset.js';

const TOKEN = 'fake-test-token';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveConnectionId', () => {
  it('prefers the explicit option', () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env');
    expect(resolveConnectionId('MASTRA_LINEAR_CONNECTION_ID', 'c_opt')).toBe('c_opt');
  });

  it('falls back to the env var', () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env');
    expect(resolveConnectionId('MASTRA_LINEAR_CONNECTION_ID')).toBe('c_env');
  });

  it('throws missing_connection_id naming the env var', () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', '');
    try {
      resolveConnectionId('MASTRA_LINEAR_CONNECTION_ID');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MastraConnectError);
      expect((error as MastraConnectError).code).toBe('missing_connection_id');
      expect((error as Error).message).toContain('MASTRA_LINEAR_CONNECTION_ID');
    }
  });
});

describe('applyAllowTools', () => {
  const tools = { a: { id: 'a' }, b: { id: 'b' } } as never;

  it('returns the toolset unchanged without a filter', () => {
    expect(applyAllowTools(tools)).toBe(tools);
  });

  it('filters to the listed tool keys', () => {
    expect(Object.keys(applyAllowTools(tools, ['b']))).toEqual(['b']);
  });

  it('throws at build time on unknown names', () => {
    expect(() => applyAllowTools(tools, ['a', 'typo'])).toThrow(/typo/);
  });
});

describe('defineProxyTool', () => {
  function makeTool(fetchMock: ReturnType<typeof vi.fn>, connectionId?: string) {
    return defineProxyTool(
      {
        envVar: 'MASTRA_LINEAR_CONNECTION_ID',
        options: {
          connectionId,
          client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
        },
      },
      {
        id: 'linear_fake_tool',
        description: 'A fake tool for tests',
        inputSchema: z.object({ name: z.string() }),
        outputSchema: z.object({ echoed: z.string() }),
        request: input => ({ method: 'POST', path: 'graphql', body: { name: input.name } }),
        transform: raw => ({ echoed: String((raw as { name: string }).name) }),
      },
    );
  }

  it('builds without env vars or credentials set (lazy resolution)', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', '');
    const tool = defineProxyTool(
      { envVar: 'MASTRA_LINEAR_CONNECTION_ID' },
      {
        id: 'linear_fake_tool',
        description: 'A fake tool for tests',
        inputSchema: z.object({}),
        outputSchema: z.object({}),
        request: () => ({ method: 'GET', path: 'x' }),
        transform: () => ({}),
      },
    );
    expect(tool.id).toBe('linear_fake_tool');
  });

  it('executes through the proxy and shapes the result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ name: 'hi' }));
    const tool = makeTool(fetchMock, 'c_1');
    const result = await tool.execute!({ name: 'hi' }, {} as never);
    expect(result).toEqual({ echoed: 'hi' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://example.test/v2/connections/c_1/proxy/graphql');
    expect(init.method).toBe('POST');
  });

  it('resolves the connection id from the env var at execute time', async () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env');
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ name: 'x' }));
    const tool = makeTool(fetchMock);
    await tool.execute!({ name: 'x' }, {} as never);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/connections/c_env/proxy/');
  });

  it('throws missing_connection_id at execute time when unresolvable', async () => {
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', '');
    const fetchMock = vi.fn();
    const tool = makeTool(fetchMock);
    await expect(tool.execute!({ name: 'x' }, {} as never)).rejects.toMatchObject({
      code: 'missing_connection_id',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
