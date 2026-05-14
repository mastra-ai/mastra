import { describe, it, expect, vi } from 'vitest';
import type { ToolAction } from '../tools/types';
import { buildConnectionSuffix, resolveStoredToolIntegrations } from './runtime';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ListToolsOpts,
  ListToolsResult,
  ListToolServicesResult,
  ResolveToolsOpts,
  ToolIntegration,
  ToolIntegrationCapabilities,
  ToolIntegrationHealth,
  ToolIntegrations,
} from './tool-integration';

function makeTool(slug: string, description = ''): ToolAction<any, any, any> {
  return {
    id: slug,
    description,
    execute: async () => ({}),
  } as unknown as ToolAction<any, any, any>;
}

function makeIntegration(overrides: Partial<ToolIntegration> = {}): ToolIntegration {
  const capabilities: ToolIntegrationCapabilities = {
    multipleConnectionsPerService: true,
    batchConnectionStatus: true,
    reauthorizeReusesConnectionId: true,
    ...(overrides.capabilities ?? {}),
  };
  return {
    id: 'composio',
    displayName: 'Composio',
    capabilities,
    async listToolServices(): Promise<ListToolServicesResult> {
      return { data: [] };
    },
    async listTools(_opts?: ListToolsOpts): Promise<ListToolsResult> {
      return { data: [], pagination: { page: 1, hasMore: false } };
    },
    async resolveTools(opts: ResolveToolsOpts) {
      const out: Record<string, ToolAction<any, any, any>> = {};
      for (const slug of opts.toolSlugs) {
        out[slug] = makeTool(slug, `base description for ${slug}`);
      }
      return out;
    },
    async authorize(_opts: AuthorizeOpts) {
      return { url: 'https://example.com', authId: 'auth_1' };
    },
    async getAuthStatus(_authId: string): Promise<AuthFlowStatus> {
      return 'completed';
    },
    async getConnectionStatus(opts) {
      return Object.fromEntries(opts.items.map(i => [i.connectionId, { connected: true }]));
    },
    async getHealth(): Promise<ToolIntegrationHealth> {
      return { ok: true };
    },
    ...overrides,
  };
}

describe('buildConnectionSuffix', () => {
  it('uppercases and strips non-alphanumeric', () => {
    const used = new Set<string>();
    expect(buildConnectionSuffix('Work', used)).toBe('WORK');
    expect(buildConnectionSuffix('my-personal email!', used)).toBe('MY_PERSONAL_EMAIL');
  });

  it('disambiguates collisions with _2, _3', () => {
    const used = new Set<string>();
    expect(buildConnectionSuffix('Work', used)).toBe('WORK');
    expect(buildConnectionSuffix('work', used)).toBe('WORK_2');
    expect(buildConnectionSuffix('WORK', used)).toBe('WORK_3');
  });

  it('falls back to CONN for fully empty sanitized output', () => {
    const used = new Set<string>();
    expect(buildConnectionSuffix('!!!', used)).toBe('CONN');
  });
});

describe('resolveStoredToolIntegrations', () => {
  it('returns empty map for missing / empty integrations', async () => {
    expect(await resolveStoredToolIntegrations(undefined, () => makeIntegration())).toEqual({});
    expect(await resolveStoredToolIntegrations({}, () => makeIntegration())).toEqual({});
  });

  it('single connection keeps original slug and description', async () => {
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {}, 'gmail.send_email': {} },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
        },
      },
    };
    const integration = makeIntegration();
    const out = await resolveStoredToolIntegrations(stored, () => integration);

    expect(Object.keys(out).sort()).toEqual(['gmail.fetch_emails', 'gmail.send_email']);
    expect(out['gmail.fetch_emails']!.description).toBe('base description for gmail.fetch_emails');
    expect(out['gmail.fetch_emails']!.id).toBe('gmail.fetch_emails');
  });

  it('two connections produce suffixed entries with routing hints', async () => {
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'Personal' },
          ],
        },
      },
    };
    const integration = makeIntegration();
    const out = await resolveStoredToolIntegrations(stored, () => integration);

    expect(Object.keys(out).sort()).toEqual(['gmail.fetch_emails__PERSONAL', 'gmail.fetch_emails__WORK']);
    expect(out['gmail.fetch_emails__WORK']!.id).toBe('gmail.fetch_emails__WORK');
    expect(out['gmail.fetch_emails__WORK']!.description).toContain('Routes through connection: Work');
    expect(out['gmail.fetch_emails__PERSONAL']!.description).toContain('Routes through connection: Personal');
  });

  it('colliding sanitized labels disambiguate with _2', async () => {
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'work' },
          ],
        },
      },
    };
    const out = await resolveStoredToolIntegrations(stored, () => makeIntegration());
    expect(Object.keys(out).sort()).toEqual(['gmail.fetch_emails__WORK', 'gmail.fetch_emails__WORK_2']);
  });

  it('adapter error on one connection does not poison siblings', async () => {
    let call = 0;
    const integration = makeIntegration({
      async resolveTools(opts: ResolveToolsOpts) {
        call += 1;
        if (opts.connectionId === 'ca_bad') throw new Error('boom');
        return { [opts.toolSlugs[0]!]: makeTool(opts.toolSlugs[0]!, 'ok') };
      },
    });
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_bad', label: 'Bad' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_ok', label: 'Good' },
          ],
        },
      },
    };
    const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
    const out = await resolveStoredToolIntegrations(stored, () => integration, { logger });

    expect(call).toBe(2);
    expect(Object.keys(out)).toEqual(['gmail.fetch_emails__GOOD']);
    expect(logger.warn).toHaveBeenCalled();
  });

  it('plumbs requestContext through to every resolveTools call', async () => {
    const spy = vi.fn(async (opts: ResolveToolsOpts) => ({
      [opts.toolSlugs[0]!]: makeTool(opts.toolSlugs[0]!),
    }));
    const integration = makeIntegration({ resolveTools: spy });
    const ctx = { 'mastra/resource-id': 'user_123' };
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'Personal' },
          ],
        },
      },
    };
    await resolveStoredToolIntegrations(stored, () => integration, { requestContext: ctx });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0]![0].requestContext).toBe(ctx);
    expect(spy.mock.calls[1]![0].requestContext).toBe(ctx);
  });

  it('throws when multipleConnectionsPerService=false but >1 connection supplied', async () => {
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: false,
        batchConnectionStatus: false,
        reauthorizeReusesConnectionId: true,
      },
    });
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
            { kind: 'author', toolService: 'gmail', connectionId: 'ca_2', label: 'Personal' },
          ],
        },
      },
    };
    await expect(resolveStoredToolIntegrations(stored, () => integration)).rejects.toThrow(
      /does not support multiple connections/,
    );
  });

  it('logs and skips when the registry lookup throws (unknown integration)', async () => {
    const stored: ToolIntegrations = {
      ghost: {
        tools: { 'gmail.fetch_emails': {} },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
        },
      },
    };
    const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
    const out = await resolveStoredToolIntegrations(
      stored,
      () => {
        throw new Error('unknown');
      },
      { logger },
    );
    expect(out).toEqual({});
    expect(logger.warn).toHaveBeenCalled();
  });

  it('only resolves tool slugs that belong to the current tool service', async () => {
    const spy = vi.fn(async (opts: ResolveToolsOpts) => {
      const out: Record<string, ToolAction<any, any, any>> = {};
      for (const slug of opts.toolSlugs) out[slug] = makeTool(slug);
      return out;
    });
    const integration = makeIntegration({ resolveTools: spy });
    const stored: ToolIntegrations = {
      composio: {
        tools: { 'gmail.fetch_emails': {}, 'slack.send_message': {} },
        connections: {
          gmail: [{ kind: 'author', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' }],
          slack: [{ kind: 'author', toolService: 'slack', connectionId: 'ca_2', label: 'Team' }],
        },
      },
    };
    const out = await resolveStoredToolIntegrations(stored, () => integration);

    expect(spy).toHaveBeenCalledTimes(2);
    const firstCallSlugs = spy.mock.calls[0]![0].toolSlugs;
    const secondCallSlugs = spy.mock.calls[1]![0].toolSlugs;
    expect([firstCallSlugs, secondCallSlugs].flat().sort()).toEqual(['gmail.fetch_emails', 'slack.send_message']);
    expect(Object.keys(out).sort()).toEqual(['gmail.fetch_emails', 'slack.send_message']);
  });
});
