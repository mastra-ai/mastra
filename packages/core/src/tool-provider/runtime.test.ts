import { describe, expect, it, vi } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY } from '../request-context';
import { buildConnectionSuffix, resolveStoredToolProviders } from './runtime';
import type { ResolveToolsOpts, ToolProvider, ToolProviderConnectionScope, ToolProviders } from './types';
import { SHARED_BUCKET_ID } from './types';

function makeStubProvider(): {
  provider: ToolProvider;
  resolveToolsVNext: ReturnType<typeof vi.fn>;
} {
  const resolveToolsVNext = vi.fn(async (_opts: ResolveToolsOpts) => ({}));
  const provider: ToolProvider = {
    info: { id: 'composio', name: 'Composio' },
    capabilities: {
      multipleConnectionsPerToolkit: true,
      batchConnectionStatus: false,
      reauthorizeReusesConnectionId: false,
    },
    listTools: async () => ({ data: [] }),
    resolveTools: async () => ({}),
    resolveToolsVNext,
  };
  return { provider, resolveToolsVNext };
}

function buildToolProviders(scope: ToolProviderConnectionScope): ToolProviders {
  return {
    composio: {
      tools: {
        'gmail.fetch_emails': { toolkit: 'gmail' },
      },
      connections: {
        gmail: [
          {
            kind: 'author',
            toolkit: 'gmail',
            connectionId: 'ca_test',
            scope,
          },
        ],
      },
    },
  };
}

describe('resolveStoredToolProviders — resolveConnectionAuthorId branches', () => {
  it('forwards requestContext resourceId as authorId for caller-supplied scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await resolveStoredToolProviders(buildToolProviders('caller-supplied'), () => provider, {
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user_abc' },
      authorId: 'author_xyz',
    });

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe('user_abc');
    expect(resolveToolsVNext.mock.calls[0]![0].scope).toBe('caller-supplied');
  });

  it("falls back to 'default' for caller-supplied scope when resourceId is missing", async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await expect(
      resolveStoredToolProviders(buildToolProviders('caller-supplied'), () => provider, {
        authorId: 'author_xyz',
      }),
    ).resolves.toBeDefined();

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe('default');
    expect(resolveToolsVNext.mock.calls[0]![0].scope).toBe('caller-supplied');
  });

  it('uses SHARED_BUCKET_ID as authorId for shared scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await resolveStoredToolProviders(buildToolProviders('shared'), () => provider, {
      authorId: 'author_xyz',
    });

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe(SHARED_BUCKET_ID);
    expect(resolveToolsVNext.mock.calls[0]![0].scope).toBe('shared');
  });

  it('forwards caller authorId as authorId for per-author scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await resolveStoredToolProviders(buildToolProviders('per-author'), () => provider, {
      authorId: 'author_xyz',
    });

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe('author_xyz');
    expect(resolveToolsVNext.mock.calls[0]![0].scope).toBe('per-author');
  });
});

describe('resolveStoredToolProviders — connectionless caller-supplied tools', () => {
  it('materializes selected tools without a pinned connection', async () => {
    const managementToolId = 'COMPOSIO_MANAGE_CONNECTIONS';
    const resolveToolsVNext = vi.fn(async (_opts: ResolveToolsOpts) => ({
      [managementToolId]: {
        id: 'provider-internal-id',
        description: 'Create or manage connections to user apps',
        execute: async () => ({ success: true }),
      },
    }));
    const provider: ToolProvider = {
      ...makeStubProvider().provider,
      defaultScope: 'caller-supplied',
      resolveToolsVNext,
    };
    const toolProviders: ToolProviders = {
      composio: {
        tools: {
          [managementToolId]: { toolkit: 'composio' },
        },
        connections: {},
      },
    };

    const resolved = await resolveStoredToolProviders(toolProviders, () => provider, {
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'tenant-user-1' },
      authorId: 'agent-author',
    });

    expect(resolved[managementToolId]).toBeDefined();
    expect(resolved[managementToolId]?.id).toBe(managementToolId);
    expect(resolveToolsVNext).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlugs: [managementToolId],
        connectionId: 'tenant-user-1',
        authorId: 'tenant-user-1',
        scope: 'caller-supplied',
        requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'tenant-user-1' },
      }),
    );
  });

  it('derives the toolkit from legacy dot-prefixed tool slugs', async () => {
    const legacyToolId = 'composio.manage_connections';
    const resolveToolsVNext = vi.fn(async (_opts: ResolveToolsOpts) => ({
      [legacyToolId]: {
        id: legacyToolId,
        description: 'Create or manage connections to user apps',
        execute: async () => ({ success: true }),
      },
    }));
    const provider: ToolProvider = {
      ...makeStubProvider().provider,
      defaultScope: 'caller-supplied',
      resolveToolsVNext,
    };
    const toolProviders: ToolProviders = {
      composio: {
        tools: {
          [legacyToolId]: {},
        },
        connections: {},
      },
    };

    const resolved = await resolveStoredToolProviders(toolProviders, () => provider, {
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'tenant-user-1' },
    });

    expect(resolved[legacyToolId]).toBeDefined();
    expect(resolveToolsVNext).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlugs: [legacyToolId],
        scope: 'caller-supplied',
      }),
    );
  });

  it('keeps requiring a pinned connection for providers without caller-supplied scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();
    const toolProviders: ToolProviders = {
      composio: {
        tools: {
          'gmail.fetch_emails': { toolkit: 'gmail' },
        },
        connections: {},
      },
    };

    const resolved = await resolveStoredToolProviders(toolProviders, () => provider, {
      authorId: 'agent-author',
    });

    expect(resolved).toEqual({});
    expect(resolveToolsVNext).not.toHaveBeenCalled();
  });
});

describe('buildConnectionSuffix', () => {
  it('uppercases a plain alphanumeric label', () => {
    const used = new Set<string>();
    expect(buildConnectionSuffix('work', used)).toBe('WORK');
    expect(used.has('WORK')).toBe(true);
  });

  it('replaces spaces and punctuation with underscores', () => {
    expect(buildConnectionSuffix('my gmail account', new Set())).toBe('MY_GMAIL_ACCOUNT');
    expect(buildConnectionSuffix('work.email-1', new Set())).toBe('WORK_EMAIL_1');
  });

  it('collapses internal runs of underscores and trims leading/trailing underscores', () => {
    expect(buildConnectionSuffix('___my___label___', new Set())).toBe('MY_LABEL');
    expect(buildConnectionSuffix('  spaced  out  ', new Set())).toBe('SPACED_OUT');
  });

  it('falls back to CONN for empty, undefined, or all-non-word labels', () => {
    expect(buildConnectionSuffix(undefined, new Set())).toBe('CONN');
    expect(buildConnectionSuffix('', new Set())).toBe('CONN');
    expect(buildConnectionSuffix('   ', new Set())).toBe('CONN');
    expect(buildConnectionSuffix('!!!', new Set())).toBe('CONN');
  });

  it('appends _2, _3, … on collisions and mutates the set in place', () => {
    const used = new Set<string>();
    expect(buildConnectionSuffix('work', used)).toBe('WORK');
    expect(buildConnectionSuffix('work', used)).toBe('WORK_2');
    expect(buildConnectionSuffix('work', used)).toBe('WORK_3');
    expect(used.has('WORK')).toBe(true);
    expect(used.has('WORK_2')).toBe(true);
    expect(used.has('WORK_3')).toBe(true);
  });

  it('handles pathological repeated separators in linear time (regression for CodeQL polynomial regex)', () => {
    // A long run of separators should never trigger backtracking. Just assert
    // the function returns the trimmed result; the real signal is that the
    // call returns at all under the test timeout.
    const longLabel = `${'_'.repeat(1000)}abc${'_'.repeat(1000)}`;
    expect(buildConnectionSuffix(longLabel, new Set())).toBe('ABC');
  });
});
