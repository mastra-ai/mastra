import { describe, expect, it, vi } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY } from '../request-context';
import { resolveStoredToolProviders } from './runtime';
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
  });

  it('uses SHARED_BUCKET_ID as authorId for shared scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await resolveStoredToolProviders(buildToolProviders('shared'), () => provider, {
      authorId: 'author_xyz',
    });

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe(SHARED_BUCKET_ID);
  });

  it('forwards caller authorId as authorId for per-author scope', async () => {
    const { provider, resolveToolsVNext } = makeStubProvider();

    await resolveStoredToolProviders(buildToolProviders('per-author'), () => provider, {
      authorId: 'author_xyz',
    });

    expect(resolveToolsVNext).toHaveBeenCalledTimes(1);
    expect(resolveToolsVNext.mock.calls[0]![0].authorId).toBe('author_xyz');
  });
});
