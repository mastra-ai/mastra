import { describe, it, expect } from 'vitest';
import type { ToolAction } from '../tools/types';
import { BaseToolIntegration } from './base';
import type {
  AuthFlowStatus,
  AuthorizeOpts,
  ListToolsOpts,
  ListToolsResult,
  ResolveToolsOpts,
  ToolDescriptor,
  ToolIntegrationCapabilities,
  ToolService,
} from './tool-integration';

class FakeIntegration extends BaseToolIntegration {
  readonly id = 'fake';
  readonly displayName = 'Fake';
  readonly capabilities: ToolIntegrationCapabilities = {
    multipleConnectionsPerService: false,
    batchConnectionStatus: false,
    reauthorizeReusesConnectionId: true,
  };

  constructor(
    private readonly services: ToolService[],
    private readonly toolsByService: Record<string, ToolDescriptor[]>,
    opts: ConstructorParameters<typeof BaseToolIntegration>[0] = {},
  ) {
    super(opts);
  }

  protected async listAllToolServices(): Promise<ToolService[]> {
    return this.services;
  }

  protected async listAllTools(opts: ListToolsOpts): Promise<ListToolsResult> {
    const all = opts.toolService
      ? (this.toolsByService[opts.toolService] ?? [])
      : Object.values(this.toolsByService).flat();
    const filtered = opts.search
      ? all.filter(t => t.slug.includes(opts.search!) || t.name.includes(opts.search!))
      : all;
    const perPage = opts.perPage;
    const page = opts.page ?? 1;
    const data = perPage ? filtered.slice((page - 1) * perPage, page * perPage) : filtered;
    const hasMore = perPage !== undefined ? page * perPage < filtered.length : false;
    return { data, pagination: { page, perPage, hasMore } };
  }

  async resolveTools(_opts: ResolveToolsOpts): Promise<Record<string, ToolAction<any, any, any>>> {
    return {};
  }

  async authorize(_opts: AuthorizeOpts) {
    return { url: 'about:blank', authId: 'a' };
  }

  async getAuthStatus(_authId: string): Promise<AuthFlowStatus> {
    return 'pending';
  }

  async getConnectionStatus(_opts: { items: Array<{ connectionId: string; toolService: string }> }) {
    return {};
  }
}

const services: ToolService[] = [
  { slug: 'gmail', name: 'Gmail' },
  { slug: 'slack', name: 'Slack' },
  { slug: 'github', name: 'GitHub' },
];

const tools: Record<string, ToolDescriptor[]> = {
  gmail: [
    { slug: 'gmail.fetch_emails', name: 'Fetch emails', toolService: 'gmail' },
    { slug: 'gmail.send', name: 'Send email', toolService: 'gmail' },
  ],
  slack: [{ slug: 'slack.post_message', name: 'Post message', toolService: 'slack' }],
  github: [{ slug: 'github.create_issue', name: 'Create issue', toolService: 'github' }],
};

describe('BaseToolIntegration', () => {
  describe('listToolServices', () => {
    it('returns all services wrapped in { data } when no allowlist is set', async () => {
      const integration = new FakeIntegration(services, tools);
      expect(await integration.listToolServices()).toEqual({ data: services });
    });

    it('filters by exact slug match', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedToolServices: ['gmail', 'slack'],
      });
      const result = await integration.listToolServices();
      expect(result.data.map(s => s.slug)).toEqual(['gmail', 'slack']);
    });

    it('returns nothing when allowlist excludes everything', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedToolServices: ['nope'],
      });
      expect((await integration.listToolServices()).data).toEqual([]);
    });

    it('supports suffix wildcards on tool services', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedToolServices: ['g*'],
      });
      const matched = await integration.listToolServices();
      expect(matched.data.map(s => s.slug)).toEqual(['gmail', 'github']);
    });
  });

  describe('listTools', () => {
    it('returns tools across all services when toolService is omitted', async () => {
      const integration = new FakeIntegration(services, tools);
      const result = await integration.listTools();
      expect(result.data.map(t => t.slug).sort()).toEqual(
        ['github.create_issue', 'gmail.fetch_emails', 'gmail.send', 'slack.post_message'].sort(),
      );
      expect(result.pagination).toEqual({ page: 1, perPage: undefined, hasMore: false });
    });

    it('returns all tools for a service when no allowlist is set', async () => {
      const integration = new FakeIntegration(services, tools);
      const result = await integration.listTools({ toolService: 'gmail' });
      expect(result.data.map(t => t.slug)).toEqual(['gmail.fetch_emails', 'gmail.send']);
    });

    it('returns empty when the toolService itself is not allowed', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedToolServices: ['slack'],
      });
      const result = await integration.listTools({ toolService: 'gmail' });
      expect(result.data).toEqual([]);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('filters individual tools by exact slug', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedTools: ['gmail.send'],
      });
      const result = await integration.listTools({ toolService: 'gmail' });
      expect(result.data.map(t => t.slug)).toEqual(['gmail.send']);
    });

    it('supports suffix wildcards on tool slugs', async () => {
      const integration = new FakeIntegration(services, tools, {
        allowedTools: ['gmail.*'],
      });
      const result = await integration.listTools({ toolService: 'gmail' });
      expect(result.data.map(t => t.slug)).toEqual(['gmail.fetch_emails', 'gmail.send']);
    });

    it('forwards search and pagination opts to the adapter hook', async () => {
      const integration = new FakeIntegration(services, tools);
      const result = await integration.listTools({ search: 'send' });
      expect(result.data.map(t => t.slug)).toEqual(['gmail.send']);
    });

    it('reports hasMore when more pages remain', async () => {
      const integration = new FakeIntegration(services, tools);
      const result = await integration.listTools({ perPage: 2 });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.hasMore).toBe(true);
    });
  });

  it('returns ok health by default', async () => {
    const integration = new FakeIntegration(services, tools);
    expect(await integration.getHealth()).toEqual({ ok: true });
  });

  it('returns [] from listConnectionFields by default (opt-in capability)', async () => {
    const integration = new FakeIntegration(services, tools);
    await expect(integration.listConnectionFields({ toolService: 'gmail' })).resolves.toEqual([]);
  });
});
