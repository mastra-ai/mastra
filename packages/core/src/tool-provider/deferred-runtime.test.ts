import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../request-context';
import { createTool } from '../tools';
import { deferStoredToolProviders, resolveStoredToolProviders } from './runtime';
import type { ResolveToolsOpts, ToolProvider, ToolProviders } from './types';

function fixture() {
  let connected = true;
  const resolveToolsVNext = vi.fn(async (args: ResolveToolsOpts) =>
    Object.fromEntries(
      args.toolSlugs.map(id => [
        id,
        createTool({
          id,
          description: `Read ${id}`,
          inputSchema: z.object({ limit: z.number().int() }),
          execute: async () => ({ account: args.connectionId, owner: args.authorId }),
        }),
      ]),
    ),
  );
  const getConnectionStatus = vi.fn(async ({ items }: { items: Array<{ connectionId: string }> }) =>
    Object.fromEntries(items.map(item => [item.connectionId, { connected }])),
  );
  const provider: ToolProvider = {
    info: { id: 'composio', name: 'Composio' },
    capabilities: {
      multipleConnectionsPerToolkit: true,
      batchConnectionStatus: true,
      reauthorizeReusesConnectionId: false,
    },
    listTools: async () => ({ data: [] }),
    resolveTools: async () => ({}),
    resolveToolsVNext,
    getConnectionStatus,
  };
  const config: ToolProviders = {
    composio: {
      tools: {
        MAIL_READ: { toolkit: 'mail', description: 'Read inbox' },
        MAIL_SEND: { toolkit: 'mail', description: 'Send email' },
      },
      connections: {
        mail: [
          { kind: 'author', scope: 'per-author', toolkit: 'mail', connectionId: 'account-a', label: 'Work' },
          { kind: 'author', scope: 'per-author', toolkit: 'mail', connectionId: 'account-b', label: 'Work' },
        ],
      },
    },
  };
  return {
    config,
    provider,
    resolveToolsVNext,
    getConnectionStatus,
    revoke: () => {
      connected = false;
    },
  };
}

describe('deferred stored provider tools', () => {
  it('preserves full multi-account names and only resolves the selected account/action', async () => {
    const f = fixture();
    const requestContext = new RequestContext();
    const opts = { requestContext, authorId: 'alice' };
    const catalog = await deferStoredToolProviders(f.config, () => f.provider, opts);
    expect(Object.keys(catalog)).toEqual([
      'MAIL_READ__WORK',
      'MAIL_SEND__WORK',
      'MAIL_READ__WORK_2',
      'MAIL_SEND__WORK_2',
    ]);
    expect(f.resolveToolsVNext).not.toHaveBeenCalled();
    const loaded = await catalog.MAIL_READ__WORK_2!.resolve({ requestContext });
    expect(f.resolveToolsVNext).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ toolSlugs: ['MAIL_READ'], connectionId: 'account-b', authorId: 'alice' }),
    );
    expect(loaded.id).toBe('MAIL_READ__WORK_2');
    expect(await loaded.execute!({ limit: 1 }, {} as never)).toEqual({ account: 'account-b', owner: 'alice' });
    const eager = await resolveStoredToolProviders(f.config, () => f.provider, opts);
    expect(Object.keys(catalog)).toEqual(Object.keys(eager));
    expect(loaded.description).toBe(eager.MAIL_READ__WORK_2!.description);
  });

  it('rejects a changed request identity before provider resolution', async () => {
    const f = fixture();
    const catalog = await deferStoredToolProviders(f.config, () => f.provider, {
      requestContext: new RequestContext(),
      authorId: 'alice',
    });
    await expect(catalog.MAIL_READ__WORK!.resolve({ requestContext: new RequestContext() })).rejects.toThrow(
      'identity changed',
    );
    expect(f.resolveToolsVNext).not.toHaveBeenCalled();
  });

  it.each(['per-author', 'caller-supplied'] as const)(
    'rejects a revoked %s account before fetching its schema',
    async scope => {
      const f = fixture();
      f.config.composio!.connections!.mail![0]!.scope = scope;
      const requestContext = new RequestContext();
      const catalog = await deferStoredToolProviders(f.config, () => f.provider, { requestContext, authorId: 'alice' });
      f.revoke();
      await expect(catalog.MAIL_READ__WORK!.resolve({ requestContext })).rejects.toThrow('no longer active');
      expect(f.resolveToolsVNext).not.toHaveBeenCalled();
    },
  );

  it('does not silently activate a tool missing from the provider response', async () => {
    const f = fixture();
    const requestContext = new RequestContext();
    const catalog = await deferStoredToolProviders(f.config, () => f.provider, { requestContext, authorId: 'alice' });
    f.resolveToolsVNext.mockResolvedValueOnce({});
    await expect(catalog.MAIL_READ__WORK!.resolve({ requestContext })).rejects.toThrow('unavailable');
  });
});
