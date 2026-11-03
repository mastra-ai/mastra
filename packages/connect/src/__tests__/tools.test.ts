import type { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { z } from 'zod';

import { PROVIDERS } from '../registry.js';
import type { ProviderRegistration, ProxyProviderRegistration } from '../registry.js';
import { tools as connect } from '../tools.js';

// Test-only seam: the shipped barrel exports a readonly view; tests mutate the
// underlying array to install fixture providers.
const testProviders = PROVIDERS as ProviderRegistration[];

const TOKEN = 'fake-test-token';

const fakeTools = { linear_fake_tool: { id: 'linear_fake_tool' } } as never;

function installProvider(overrides?: Partial<ProxyProviderRegistration>): {
  registration: ProxyProviderRegistration;
  createTools: ReturnType<typeof vi.fn>;
} {
  const createTools = vi.fn().mockReturnValue(fakeTools);
  const registration: ProxyProviderRegistration = {
    integrationId: 'linear',
    envVar: 'MASTRA_LINEAR_CONNECTION_ID',
    createTools,
    ...overrides,
  };
  testProviders.push(registration);
  return { registration, createTools };
}

function makeConnection(overrides?: Record<string, unknown>) {
  return {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
    ...overrides,
  };
}

function platformFetch(connectionResponse: Response) {
  return vi.fn<typeof fetch>().mockImplementation(async input => {
    const path = new URL(String(input)).pathname;
    if (path === '/v2/integrations') return Response.json({ integrations: [] });
    return connectionResponse.clone();
  });
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testProviders.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  testProviders.length = 0;
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('connect', () => {
  it('is assignable to an Agent dynamic tools argument', () => {
    type AgentTools = NonNullable<ConstructorParameters<typeof Agent>[0]['tools']>;
    const tools = connect({ projectId: 'proj_1', client: { accessToken: TOKEN } });

    expectTypeOf(tools).toExtend<AgentTools>();
  });

  it('throws missing_project_id synchronously without a project id', () => {
    installProvider();
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    expect(() => connect({ client: { accessToken: TOKEN } })).toThrow(
      expect.objectContaining({ code: 'missing_project_id' }),
    );
  });

  it('throws invalid_options for a malformed provider id in integrations override', () => {
    installProvider();
    expect(() =>
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        providers: { 'does.not.exist': false },
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('falls back to MASTRA_PROJECT_ID', async () => {
    installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [] }));
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');
    await connect({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v2/projects/proj_env/connections');
    expect((init?.headers as Record<string, string>)['x-mastra-project-id']).toBe('proj_env');
  });

  it('resolves the toolset for the sole active connection', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual(fakeTools);
    const [callArgs] = createTools.mock.calls[0]!;
    expect(callArgs).toMatchObject({ connectionId: 'c_lin1' });
    // Proxy providers build their own client from these options at
    // tool-execution time, so they must inherit the resolver's projectId for
    // activity attribution.
    expect(callArgs.client).toMatchObject({ projectId: 'proj_1' });
    expect(callArgs.allowTools).toBeUndefined();
    expect(callArgs.disallowTools).toBeUndefined();
  });

  it('passes the resolved projectId to tool creation for every active connection', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(createTools.mock.calls.length).toBeGreaterThan(0);
    for (const [callArgs] of createTools.mock.calls) {
      expect(callArgs.client).toMatchObject({ projectId: 'proj_1' });
    }
  });

  it('accepts the string-array shorthand for integrations', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: ['linear'],
    })();
    expect(tools).toEqual(fakeTools);
    const [callArgs] = createTools.mock.calls[0]!;
    expect(callArgs).toMatchObject({ connectionId: 'c_lin1' });
    expect(callArgs.allowTools).toBeUndefined();
    expect(callArgs.disallowTools).toBeUndefined();
  });

  it('threads allowTools through to the provider', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { allowTools: ['linear_fake_tool'] } },
    })();
    const [callArgs] = createTools.mock.calls[0]!;
    expect(callArgs.allowTools).toEqual(['linear_fake_tool']);
    expect(callArgs.disallowTools).toBeUndefined();
  });

  it('threads disallowTools through to the provider', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { disallowTools: ['linear_deprecated_tool'] } },
    })();
    const [callArgs] = createTools.mock.calls[0]!;
    expect(callArgs.disallowTools).toEqual(['linear_deprecated_tool']);
    expect(callArgs.allowTools).toBeUndefined();
  });

  it('rejects invalid_options when both allowTools and disallowTools are set on a provider', () => {
    installProvider();
    expect(() =>
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        providers: {
          // Bypass the XOR type so we can exercise the runtime guard.
          linear: { allowTools: ['a'], disallowTools: ['b'] } as unknown as Record<string, never>,
        },
      }),
    ).toThrow(
      expect.objectContaining({ code: 'invalid_options', message: expect.stringMatching(/mutually exclusive/) }),
    );
  });

  it('rejects a non-string entry in the integrations array', () => {
    installProvider();
    expect(() =>
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        providers: ['linear', 123 as unknown as string],
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('rejects duplicate entries in the integrations array', () => {
    installProvider();
    expect(() =>
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        providers: ['linear', 'linear'],
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('rejects duplicate tool keys from different providers', async () => {
    const duplicateTools = { shared_tool: { id: 'shared_tool' } } as never;
    installProvider({ createTools: vi.fn().mockReturnValue(duplicateTools) });
    installProvider({
      integrationId: 'notion',
      envVar: 'MASTRA_NOTION_CONNECTION_ID',
      createTools: vi.fn().mockReturnValue(duplicateTools),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })],
      }),
    );

    await expect(
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      })(),
    ).rejects.toMatchObject({
      code: 'invalid_options',
      message: "Duplicate tool key 'shared_tool' from providers 'linear' and 'notion'.",
    });
  });

  it('silently skips providers without project connections', async () => {
    installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [] }));
    const tools = connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      ttlMs: 0,
    });

    expect(await tools()).toEqual({});
    expect(await tools()).toEqual({});
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('skips a directed connection that needs re-auth', async () => {
    installProvider();
    const fetchMock = platformFetch(
      Response.json({ connections: [makeConnection({ id: 'c_stale', status: 'needs_reauth' })] }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { connectionId: 'c_stale' } },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('needs re-auth'));
  });

  it('skips a directed connection id that is not attached to the project', async () => {
    installProvider();
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_absent');
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('pinned connection c_absent is not attached to this project'),
    );
  });

  it('skips a directed connection in a non-active state', async () => {
    installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection({ id: 'c_err', status: 'error' })] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { connectionId: 'c_err' } },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("connection c_err is not active (status 'error')"));
  });

  it('wraps tools with connection_name when multiple active connections exist without a pin', async () => {
    // Real inner tools per connection so we can observe wrapping vs. passthrough.
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ resolvedConnectionId: z.string(), issueId: z.string() }),
          execute: async input => ({ resolvedConnectionId: connectionId, issueId: (input as { id: string }).id }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    // Public tools include both the wrapped provider tool and the discovery tool.
    expect(Object.keys(tools).sort()).toEqual(['linear__list_connections', 'linear_get_issue']);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('routes a wrapped tool call to the connection matching connection_name', async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ resolvedConnectionId: z.string(), issueId: z.string() }),
          execute: async input => ({ resolvedConnectionId: connectionId, issueId: (input as { id: string }).id }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const wrapped = tools.linear_get_issue as unknown as {
      execute: (input: unknown, ctx?: unknown) => Promise<{ resolvedConnectionId: string; issueId: string }>;
    };
    const result = await wrapped.execute({ id: 'LIN-1', connection_name: 'Globex' }, {});
    expect(result).toEqual({ resolvedConnectionId: 'c2', issueId: 'LIN-1' });
  });

  it('list_connections returns the display names of active connections', async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(() => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          execute: async () => ({}),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
          makeConnection({ id: 'c3', accountLabel: null }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const list = tools.linear__list_connections as unknown as {
      execute: (
        input: unknown,
        ctx?: unknown,
      ) => Promise<{
        connections: Array<{ name: string; accountLabel: string | null }>;
      }>;
    };
    const result = await list.execute({}, {});
    expect(result.connections).toEqual([
      { name: 'Acme', accountLabel: 'Acme' },
      { name: 'Globex', accountLabel: 'Globex' },
      // Null/empty label falls back to the connection id so the agent still has a stable handle.
      { name: 'c3', accountLabel: null },
    ]);
  });

  it('throws unknown_connection when connection_name matches nothing', async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          execute: async input => ({ resolvedConnectionId: connectionId, issueId: (input as { id: string }).id }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const wrapped = tools.linear_get_issue as unknown as {
      execute: (input: unknown, ctx?: unknown) => Promise<unknown>;
    };
    await expect(wrapped.execute({ id: 'LIN-1', connection_name: 'Nope' }, {})).rejects.toMatchObject({
      code: 'unknown_connection',
    });
  });

  it('disambiguates duplicate accountLabels by suffixing with the connection id', async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          execute: async () => ({ resolvedConnectionId: connectionId }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Acme' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const list = tools.linear__list_connections as unknown as {
      execute: (
        input: unknown,
        ctx?: unknown,
      ) => Promise<{
        connections: Array<{ name: string; accountLabel: string | null }>;
      }>;
    };
    const listed = await list.execute({}, {});
    expect(listed.connections.map(c => c.name)).toEqual(['Acme', 'Acme (c2)']);
    // The raw id remains a valid connection_name so callers can always disambiguate.
    const wrapped = tools.linear_get_issue as unknown as {
      execute: (input: unknown, ctx?: unknown) => Promise<{ resolvedConnectionId: string }>;
    };
    const routed = await wrapped.execute({ id: 'LIN-1', connection_name: 'c1' }, {});
    expect(routed.resolvedConnectionId).toBe('c1');
  });

  it("does not let one connection's accountLabel shadow a different connection's raw id", async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        linear_get_issue: createTool({
          id: 'linear_get_issue',
          description: 'Get a Linear issue.',
          inputSchema: z.object({ id: z.string() }),
          outputSchema: z.object({ resolvedConnectionId: z.string() }),
          execute: async () => ({ resolvedConnectionId: connectionId }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          // The account label on the second connection is exactly the raw id of the first.
          // Without disambiguation, `connection_name: "c1"` would route to c2 (label match wins).
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'c1' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const list = tools.linear__list_connections as unknown as {
      execute: (
        input: unknown,
        ctx?: unknown,
      ) => Promise<{
        connections: Array<{ name: string; accountLabel: string | null }>;
      }>;
    };
    const listed = await list.execute({}, {});
    // The colliding label is suffixed so it can never masquerade as a raw id.
    expect(listed.connections.map(c => c.name)).toEqual(['Acme', 'c1 (c2)']);
    const wrapped = tools.linear_get_issue as unknown as {
      execute: (input: unknown, ctx?: unknown) => Promise<{ resolvedConnectionId: string }>;
    };
    // Raw id "c1" now unambiguously routes to c1.
    const byId = await wrapped.execute({ id: 'LIN-1', connection_name: 'c1' }, {});
    expect(byId.resolvedConnectionId).toBe('c1');
    // The disambiguated display name routes to c2.
    const byLabel = await wrapped.execute({ id: 'LIN-1', connection_name: 'c1 (c2)' }, {});
    expect(byLabel.resolvedConnectionId).toBe('c2');
  });

  it('throws invalid_options when a provider tool already uses the reserved list_connections helper key', async () => {
    installProvider({
      createTools: vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
        // Simulate a provider (e.g. WorkOS could ship this under a colliding key) whose
        // own toolset already defines the double-underscore reserved helper name.
        linear__list_connections: createTool({
          id: 'linear__list_connections',
          description: 'Real provider tool.',
          execute: async () => ({ connectionId }),
        }),
      })),
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    await expect(
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      })(),
    ).resolves.toEqual({});
    // The collision is warned about (invalid_options is downgraded to warn-and-skip by connect).
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("already defines 'linear__list_connections'"));
  });

  it('does not wrap tools when only one active connection exists (single-connection path unchanged)', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c_active', status: 'active' }),
          makeConnection({ id: 'c_stale', status: 'needs_reauth' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    // No list_connections tool, no wrapping — behaves like a single-connection provider.
    expect(Object.keys(tools)).toEqual(['linear_fake_tool']);
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_active' }));
  });

  it('threads disallowTools through the multi-connection wrapper', async () => {
    const createTools = vi
      .fn()
      .mockImplementation(({ connectionId, disallowTools }: { connectionId: string; disallowTools?: string[] }) => {
        const all = {
          linear_get_issue: createTool({
            id: 'linear_get_issue',
            description: 'Get a Linear issue.',
            inputSchema: z.object({ id: z.string() }),
            outputSchema: z.object({ resolvedConnectionId: z.string() }),
            execute: async () => ({ resolvedConnectionId: connectionId }),
          }),
          linear_delete_issue: createTool({
            id: 'linear_delete_issue',
            description: 'Delete a Linear issue.',
            inputSchema: z.object({ id: z.string() }),
            outputSchema: z.object({ ok: z.boolean() }),
            execute: async () => ({ ok: true }),
          }),
        };
        const remove = new Set(disallowTools ?? []);
        const filtered: Record<string, unknown> = {};
        for (const [key, tool] of Object.entries(all)) if (!remove.has(key)) filtered[key] = tool;
        return filtered;
      });
    installProvider({ createTools });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { disallowTools: ['linear_delete_issue'] } },
    })();
    // The wrapped toolset exposes the non-disallowed provider tool plus the list-connections helper.
    expect(Object.keys(tools).sort()).toEqual(['linear__list_connections', 'linear_get_issue']);
    // Every inner createTools call received the same disallowTools list (with the list_connections key stripped).
    for (const call of createTools.mock.calls) {
      expect(call[0].disallowTools).toEqual(['linear_delete_issue']);
      expect(call[0].allowTools).toBeUndefined();
    }
  });

  it('strips linear__list_connections from disallowTools before reaching the inner provider', async () => {
    const createTools = vi.fn().mockImplementation(({ connectionId }: { connectionId: string }) => ({
      linear_get_issue: createTool({
        id: 'linear_get_issue',
        description: 'Get a Linear issue.',
        inputSchema: z.object({ id: z.string() }),
        outputSchema: z.object({ resolvedConnectionId: z.string() }),
        execute: async () => ({ resolvedConnectionId: connectionId }),
      }),
    }));
    installProvider({ createTools });
    const fetchMock = platformFetch(
      Response.json({
        connections: [
          makeConnection({ id: 'c1', accountLabel: 'Acme' }),
          makeConnection({ id: 'c2', accountLabel: 'Globex' }),
        ],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      // Referencing the wrapper-only key must not blow up the inner provider.
      providers: { linear: { disallowTools: ['linear__list_connections'] } },
    })();
    for (const call of createTools.mock.calls) {
      expect(call[0].disallowTools).toEqual([]);
    }
  });

  it('uses the pinned connection id from integrations override', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(
      Response.json({
        connections: [makeConnection({ id: 'c1' }), makeConnection({ id: 'c2' })],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: { connectionId: 'c2' } },
    })();
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c2' }));
  });

  it('uses the env-var fallback when no pin is given', async () => {
    const { createTools } = installProvider();
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env');
    const fetchMock = platformFetch(
      Response.json({
        connections: [makeConnection({ id: 'c_env' }), makeConnection({ id: 'c_other' })],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_env' }));
  });

  it('excludes a provider set to false even when a connection exists', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: { linear: false },
    })();
    expect(tools).toEqual({});
    expect(createTools).not.toHaveBeenCalled();
  });

  it('rejects negative ttlMs synchronously', () => {
    installProvider();
    expect(() => connect({ projectId: 'proj_1', client: { accessToken: TOKEN }, ttlMs: -1 })).toThrow(
      expect.objectContaining({ code: 'invalid_options' }),
    );
  });

  it('surfaces multiple providers in one call', async () => {
    installProvider();
    const notionTools = { notion_fake: { id: 'notion_fake' } } as never;
    const notionCreate = vi.fn().mockReturnValue(notionTools);
    testProviders.push({
      integrationId: 'notion',
      envVar: 'MASTRA_NOTION_CONNECTION_ID',
      createTools: notionCreate,
    });
    const fetchMock = platformFetch(
      Response.json({
        connections: [makeConnection(), makeConnection({ id: 'c_not', integrationId: 'notion' })],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({
      linear_fake_tool: { id: 'linear_fake_tool' },
      notion_fake: { id: 'notion_fake' },
    });
  });
});

describe('connect with an options callback', () => {
  const roleOf = (ctx?: { requestContext?: unknown }): string | undefined =>
    (ctx?.requestContext as Map<string, string> | undefined)?.get('role');

  function callbackResolver(fetchMock: typeof fetch) {
    return connect(ctx => ({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      providers: {
        linear: roleOf(ctx) === 'viewer' ? { allowTools: ['linear_fake_tool'] } : {},
      },
    }));
  }

  it('derives provider options from the request context', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = callbackResolver(fetchMock as never);

    await resolver({ requestContext: new Map([['role', 'viewer']]) });
    await resolver({ requestContext: new Map([['role', 'admin']]) });

    expect(createTools.mock.calls[0]![0].allowTools).toEqual(['linear_fake_tool']);
    expect(createTools.mock.calls[1]![0].allowTools).toBeUndefined();
  });

  it('shares one cached snapshot across requests producing equal options', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = callbackResolver(fetchMock as never);

    // Distinct ctx objects, structurally equal options from the callback.
    const first = await resolver({ requestContext: new Map([['role', 'viewer']]) });
    const second = await resolver({ requestContext: new Map([['role', 'viewer']]) });

    expect(second).toBe(first);
    expect(createTools).toHaveBeenCalledTimes(1);
  });

  it('keeps separate caches per distinct options value', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = callbackResolver(fetchMock as never);

    await resolver({ requestContext: new Map([['role', 'viewer']]) });
    await resolver({ requestContext: new Map([['role', 'admin']]) });
    await resolver({ requestContext: new Map([['role', 'viewer']]) });
    await resolver({ requestContext: new Map([['role', 'admin']]) });

    // One platform refresh (and provider build) per distinct options value.
    expect(createTools).toHaveBeenCalledTimes(2);
  });

  it('fails resolution loudly when the callback produces invalid options', async () => {
    installProvider();
    const resolver = connect(() => ({
      projectId: 'proj_1',
      client: { accessToken: TOKEN },
      providers: {
        linear: { allowTools: ['a'], disallowTools: ['b'] } as unknown as Record<string, never>,
      },
    }));

    await expect(resolver()).rejects.toMatchObject({
      code: 'invalid_options',
      message: expect.stringMatching(/mutually exclusive/),
    });
  });

  it('rejects a callback that does not return an options object', async () => {
    installProvider();
    const resolver = connect(() => undefined as unknown as Record<string, never>);

    await expect(resolver()).rejects.toMatchObject({
      code: 'invalid_options',
      message: expect.stringMatching(/must return a ToolsOptions object/),
    });
  });

  it('refresh() re-fetches the no-context variant', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = callbackResolver(fetchMock as never);

    await resolver();
    await resolver.refresh();

    expect(createTools).toHaveBeenCalledTimes(2);
  });

  it('disconnect() clears every variant cache', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = callbackResolver(fetchMock as never);

    await resolver({ requestContext: new Map([['role', 'viewer']]) });
    await resolver.disconnect();
    await resolver({ requestContext: new Map([['role', 'viewer']]) });

    expect(createTools).toHaveBeenCalledTimes(2);
  });

  it('supports .with() extras on the callback form', async () => {
    installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const extra = createTool({
      id: 'extra_tool',
      description: 'extra',
      inputSchema: z.object({}),
      execute: async () => 'ok',
    });
    const resolver = callbackResolver(fetchMock as never).with({ extraTool: extra });

    const tools = await resolver({ requestContext: new Map([['role', 'admin']]) });
    expect(Object.keys(tools).sort()).toEqual(['extraTool', 'linear_fake_tool']);
  });

  it('evicts the least recently used variant past the cap', async () => {
    const { createTools } = installProvider();
    const fetchMock = platformFetch(Response.json({ connections: [makeConnection()] }));
    const resolver = connect(ctx => ({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      ttlMs: (ctx?.requestContext as number | undefined) ?? 30_000,
    }));

    // 33 distinct options values: the first becomes the LRU and is evicted.
    for (let variant = 0; variant < 33; variant++) {
      await resolver({ requestContext: 1_000 + variant });
    }
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('evicting the least recently used variant'));
    expect(createTools).toHaveBeenCalledTimes(33);

    // The evicted variant resolves again from scratch; a surviving one is cached.
    await resolver({ requestContext: 1_000 });
    expect(createTools).toHaveBeenCalledTimes(34);
    await resolver({ requestContext: 1_032 });
    expect(createTools).toHaveBeenCalledTimes(34);
  });

  it('keeps an evicted variant connected until its in-flight resolution settles', async () => {
    const { createTools } = installProvider();
    let releaseFirstFetch!: () => void;
    const firstFetchGate = new Promise<void>(resolve => (releaseFirstFetch = resolve));
    let connectionCalls = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
      const path = new URL(String(input)).pathname;
      if (path === '/v2/integrations') return Response.json({ integrations: [] });
      connectionCalls += 1;
      if (connectionCalls === 1) await firstFetchGate;
      return Response.json({ connections: [makeConnection()] });
    });
    const resolver = connect(ctx => ({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      ttlMs: (ctx?.requestContext as number | undefined) ?? 30_000,
    }));

    // The first variant hangs on its platform fetch…
    const inflight = resolver({ requestContext: 1_000 });
    await vi.waitFor(() => expect(connectionCalls).toBe(1));
    // …while 33 more variants evict it from the LRU cache.
    for (let variant = 1; variant <= 33; variant++) {
      await resolver({ requestContext: 1_000 + variant });
    }
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('evicting the least recently used variant'));

    // The eviction must not tear the variant down under the in-flight call.
    releaseFirstFetch();
    await expect(inflight).resolves.toHaveProperty('linear_fake_tool');
    expect(createTools).toHaveBeenCalledTimes(34);

    // Once that resolution settled the evicted variant was disconnected, so
    // resolving the same options again rebuilds from scratch.
    await resolver({ requestContext: 1_000 });
    expect(createTools).toHaveBeenCalledTimes(35);
  });

  it('does not memoize a variant behind an in-progress disconnect()', async () => {
    installProvider();
    const events: string[] = [];
    let releaseFirstFetch!: () => void;
    const firstFetchGate = new Promise<void>(resolve => (releaseFirstFetch = resolve));
    let connectionCalls = 0;
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async input => {
      const path = new URL(String(input)).pathname;
      if (path === '/v2/integrations') return Response.json({ integrations: [] });
      connectionCalls += 1;
      if (connectionCalls === 1) await firstFetchGate;
      if (connectionCalls === 2) events.push('second variant fetch');
      return Response.json({ connections: [makeConnection()] });
    });
    let releaseOptions!: () => void;
    const optionsGate = new Promise<void>(resolve => (releaseOptions = resolve));
    const resolver = connect(async ctx => {
      if (roleOf(ctx) === 'late') await optionsGate;
      return {
        projectId: 'proj_1',
        client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
        providers: { linear: roleOf(ctx) === 'late' ? {} : { allowTools: ['linear_fake_tool'] } },
      };
    });

    // First variant's platform fetch hangs, so disconnect() below stays
    // pending while that refresh drains.
    const first = resolver({ requestContext: new Map([['role', 'admin']]) });
    await vi.waitFor(() => expect(connectionCalls).toBe(1));
    // Second resolution is parked inside the options callback.
    const second = resolver({ requestContext: new Map([['role', 'late']]) });
    const closed = resolver.disconnect().then(() => events.push('disconnected'));

    // The callback settles while disconnect() is still draining; the
    // resolution must wait for the cleanup instead of inserting a variant
    // behind its back.
    releaseOptions();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(events).toEqual([]);

    releaseFirstFetch();
    await Promise.all([first, second, closed]);
    expect(events).toEqual(['disconnected', 'second variant fetch']);
  });
});
