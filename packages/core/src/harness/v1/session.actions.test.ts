/**
 * Harness v1 — read-only desktop action catalog surface.
 *
 * Covers PF-576's local action inventory over skill action metadata and MCP
 * tool descriptors. The surface is catalog-only: it does not execute actions
 * or manage MCP lifecycle/auth.
 */

import { describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MCPServerBase } from '../../mcp';
import type { MCPServerConfig, MCPServerHonoSSEOptions, MCPServerHTTPOptions, MCPServerSSEOptions } from '../../mcp';
import type { RequestContext } from '../../request-context';
import { InMemoryHarness } from '../../storage/domains/harness/inmemory';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryStore } from '../../storage/mock';
import type { InternalCoreTool, MCPToolType } from '../../tools';
import type { Workspace } from '../../workspace';

import { HarnessSessionClosedError, HarnessValidationError, HarnessWorkspaceLostError } from './errors';
import { Harness } from './harness';
import type { WorkspaceProvider } from './workspace-provider';

class MockMcpServer extends MCPServerBase {
  public toolListCallCount = 0;
  public lastToolListRequestContext?: RequestContext;

  constructor(config: MCPServerConfig) {
    super(config);
  }

  convertTools(tools: Record<string, InternalCoreTool>): Record<string, InternalCoreTool> {
    return tools;
  }

  async startStdio(): Promise<void> {}
  async startSSE(_options: MCPServerSSEOptions): Promise<void> {}
  async startHonoSSE(_options: MCPServerHonoSSEOptions): Promise<Response | undefined> {
    return undefined;
  }
  async startHTTP(_options: MCPServerHTTPOptions): Promise<void> {}
  async close(): Promise<void> {}

  getServerInfo() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      version_detail: {
        version: this.version,
        release_date: this.releaseDate,
        is_latest: this.isLatest,
      },
    };
  }

  getServerDetail() {
    return {
      ...this.getServerInfo(),
      package_canonical: this.packageCanonical,
      packages: this.packages,
      remotes: this.remotes,
    };
  }

  getToolListInfo(requestContext?: RequestContext) {
    this.toolListCallCount++;
    this.lastToolListRequestContext = requestContext;
    return {
      tools: Object.entries(this.convertedTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.parameters,
        outputSchema: tool.outputSchema,
        toolType: tool.mcp?.toolType,
        _meta: tool.mcp?._meta,
      })),
    };
  }

  getToolInfo(toolId: string) {
    const tool = this.convertedTools[toolId];
    if (!tool) return undefined;
    return {
      name: toolId,
      description: tool.description,
      inputSchema: tool.parameters,
      outputSchema: tool.outputSchema,
      toolType: tool.mcp?.toolType,
      _meta: tool.mcp?._meta,
    };
  }

  async executeTool(): Promise<unknown> {
    return {};
  }

  async readResource(): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string }> }> {
    return { contents: [] };
  }

  async listResources(): Promise<{ resources: Array<{ uri: string; name: string }> }> {
    return { resources: [] };
  }
}

class FailingMcpServer extends MockMcpServer {
  getToolListInfo(): never {
    this.toolListCallCount++;
    throw new Error('mcp unavailable');
  }
}

class FlakyMcpServer extends MockMcpServer {
  private shouldFail = true;

  getToolListInfo(requestContext?: RequestContext) {
    if (this.shouldFail) {
      this.shouldFail = false;
      this.toolListCallCount++;
      this.lastToolListRequestContext = requestContext;
      throw new Error('temporary mcp unavailable');
    }
    return super.getToolListInfo(requestContext);
  }
}

class HangingMcpServer extends MockMcpServer {
  getToolListInfo(requestContext?: RequestContext) {
    this.toolListCallCount++;
    this.lastToolListRequestContext = requestContext;
    return new Promise<ReturnType<MockMcpServer['getToolListInfo']>>(() => {});
  }
}

class GatedMcpServer extends MockMcpServer {
  private releaseGates: Array<() => void> = [];

  async getToolListInfo(requestContext?: RequestContext) {
    this.toolListCallCount++;
    this.lastToolListRequestContext = requestContext;
    await new Promise<void>(resolve => {
      this.releaseGates.push(resolve);
    });
    return {
      tools: Object.entries(this.convertedTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.parameters,
        outputSchema: tool.outputSchema,
        toolType: tool.mcp?.toolType,
        _meta: tool.mcp?._meta,
      })),
    };
  }

  release(index = 0): void {
    const [release] = this.releaseGates.splice(index, 1);
    release?.();
  }
}

class FakeWorkspaceSkills {
  public getCallCount = 0;
  public listCallCount = 0;
  public refreshCallCount = 0;
  private pendingEntries: Array<{
    name: string;
    description: string;
    path?: string;
    metadata?: Record<string, unknown>;
  }> = [];

  constructor(
    private readonly entries: Array<{
      name: string;
      description: string;
      path?: string;
      metadata?: Record<string, unknown>;
    }>,
  ) {}

  addOnRefresh(entry: { name: string; description: string; path?: string; metadata?: Record<string, unknown> }): void {
    this.pendingEntries.push(entry);
  }

  async list() {
    this.listCallCount++;
    return this.entries.map(entry => ({
      name: entry.name,
      description: entry.description,
      path: entry.path ?? `skills/${entry.name}`,
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
    }));
  }

  async get(name: string) {
    this.getCallCount++;
    const entry = this.entries.find(item => item.name === name || item.path === name || `skills/${item.name}` === name);
    if (!entry) return null;
    return {
      name: entry.name,
      description: entry.description,
      path: entry.path ?? `skills/${entry.name}`,
      instructions: `# ${entry.name}\n\nWorkspace body.`,
      source: { type: 'local' as const, projectPath: '/fake' },
      references: [],
      scripts: [],
      assets: [],
    };
  }

  async has(name: string) {
    return this.entries.some(entry => entry.name === name);
  }

  async refresh() {
    this.refreshCallCount++;
    this.entries.push(...this.pendingEntries);
    this.pendingEntries = [];
  }
  async maybeRefresh() {}
  async search() {
    return [];
  }
  async getReference() {
    return null;
  }
  async getScript() {
    return null;
  }
  async getAsset() {
    return null;
  }
  async listReferences() {
    return [];
  }
  async listScripts() {
    return [];
  }
  async listAssets() {
    return [];
  }
}

function makeAgent(name = 'default') {
  return new Agent({
    id: name,
    name,
    instructions: 'test',
    model: 'openai/gpt-4o-mini' as any,
  });
}

function makeTool(): InternalCoreTool {
  return {
    description: 'Search workspace files',
    parameters: {
      jsonSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
      },
    } as InternalCoreTool['parameters'],
    outputSchema: {
      jsonSchema: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' } },
        },
      },
    } as InternalCoreTool['outputSchema'],
    mcp: {
      toolType: 'tool' as MCPToolType,
      _meta: { ui: { resourceUri: 'ui://files/search' } },
    },
    strict: true,
  };
}

async function makeSession() {
  const server = new MockMcpServer({
    id: 'filesystem',
    name: 'Filesystem',
    version: '1.2.3',
    description: 'Filesystem tools',
    packageCanonical: 'npm',
    tools: {
      search_files: makeTool(),
    },
  });
  const harness = new Harness({
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    skills: [
      {
        name: 'open-ticket',
        description: 'Open a ticket',
        instructions: 'Open the ticket.',
        category: 'support',
        action: {
          displayName: 'Open ticket',
          icon: 'ticket',
          shortcuts: [{ id: 'ticket.open', label: 'Open ticket', keys: ['mod+o'] }],
          inputSchema: {
            type: 'object',
            properties: { ticketId: { type: 'string' } },
            required: ['ticketId'],
          },
          outputSchema: { type: 'object', properties: { status: { type: 'string' } } },
          artifactTypes: ['application/vnd.mastra.ticket'],
          permissions: {
            tools: ['tickets.open'],
            fileScopes: ['workspace'],
            networkScopes: ['api.example.test'],
            mcpScopes: ['tickets'],
          },
        },
      },
    ],
  });
  new Mastra({
    agents: { default: makeAgent() },
    storage: new InMemoryStore(),
    mcpServers: { files: server },
    harness,
  });
  const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
  return { session, server };
}

function makeHarnessWithWorkspaceSkills(skills: FakeWorkspaceSkills): Harness {
  const provider = makeWorkspaceSkillsProvider(skills);
  return new Harness({
    agents: { default: makeAgent() } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    workspace: { kind: 'per-session', provider },
  });
}

function makeRegisteredHarnessWithWorkspaceSkills(skills: FakeWorkspaceSkills): Harness {
  const provider = makeWorkspaceSkillsProvider(skills);
  return new Harness({
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
    workspace: { kind: 'per-session', provider },
  });
}

function makeWorkspaceSkillsProvider(skills: FakeWorkspaceSkills): WorkspaceProvider {
  const workspace: Workspace = {
    id: 'workspace-actions',
    name: 'workspace-actions',
    status: 'ready',
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    skills,
    async init() {},
    async destroy() {},
  } as unknown as Workspace;
  const provider: WorkspaceProvider = {
    providerId: 'workspace-actions',
    resumable: true,
    create: async () => workspace,
    resume: async () => workspace,
  };
  return provider;
}

describe('Session action catalog (PF-576)', () => {
  it('lists skill action metadata and MCP tool descriptors as read-only catalog entries', async () => {
    const { session, server } = await makeSession();

    await expect(session.actions.list()).resolves.toEqual([
      {
        id: 'skill:open-ticket',
        source: { kind: 'skill', ref: 'open-ticket', skillName: 'open-ticket' },
        status: 'available',
        label: 'Open ticket',
        description: 'Open a ticket',
        category: 'support',
        icon: 'ticket',
        shortcuts: [{ id: 'ticket.open', label: 'Open ticket', keys: ['mod+o'] }],
        inputSchema: {
          type: 'object',
          properties: { ticketId: { type: 'string' } },
          required: ['ticketId'],
        },
        outputSchema: { type: 'object', properties: { status: { type: 'string' } } },
        artifactTypes: ['application/vnd.mastra.ticket'],
        permissions: {
          tools: ['tickets.open'],
          fileScopes: ['workspace'],
          networkScopes: ['api.example.test'],
          mcpScopes: ['tickets'],
        },
      },
      {
        id: 'mcp-tool:files:search_files',
        source: { kind: 'mcp-tool', serverKey: 'files', toolName: 'search_files' },
        status: 'available',
        label: 'search_files',
        description: 'Search workspace files',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
        outputSchema: {
          type: 'object',
          properties: { paths: { type: 'array', items: { type: 'string' } } },
        },
        permissions: { mcpScopes: ['files'] },
        mcp: {
          serverName: 'Filesystem',
          serverVersion: '1.2.3',
          toolType: 'tool',
          strict: true,
          meta: { ui: { resourceUri: 'ui://files/search' } },
        },
      },
    ]);
    expect(server.lastToolListRequestContext?.get('harness')).toMatchObject({
      resourceId: 'u1',
      sessionId: session.id,
      modeId: 'default',
    });
  });

  it('filters, searches, limits, and offsets deterministically', async () => {
    const { session, server } = await makeSession();

    await expect(session.actions.list({ source: 'skill', query: 'ticket', limit: 1 })).resolves.toMatchObject([
      { id: 'skill:open-ticket' },
    ]);
    expect(server.toolListCallCount).toBe(0);

    await expect(session.actions.search('workspace', { source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:files:search_files' },
    ]);
    await expect(session.actions.list({ limit: 1, offset: 1 })).resolves.toMatchObject([
      { id: 'mcp-tool:files:search_files' },
    ]);
    await expect(session.actions.list({ limit: 0 })).resolves.toEqual([]);
  });

  it('lists trusted workspace skill metadata.action descriptors', async () => {
    const skills = new FakeWorkspaceSkills([
      {
        name: 'workspace-action',
        description: 'Workspace action',
        path: 'skills/workspace-action/SKILL.md',
        metadata: {
          action: {
            displayName: 'Workspace action',
            inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
            permissions: { fileScopes: ['workspace'] },
          },
        },
      },
    ]);
    const harness = makeHarnessWithWorkspaceSkills(skills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'skill' })).resolves.toMatchObject([
      {
        id: 'skill:skills%2Fworkspace-action%2FSKILL.md',
        source: {
          kind: 'skill',
          ref: 'skills/workspace-action/SKILL.md',
          skillName: 'workspace-action',
          filePath: 'skills/workspace-action/SKILL.md',
        },
        label: 'Workspace action',
        inputSchema: { type: 'object', properties: { path: { type: 'string' } } },
        permissions: { fileScopes: ['workspace'] },
      },
    ]);
    expect(skills.getCallCount).toBe(0);

    await session.actions.list({ source: 'skill' });
    expect(skills.listCallCount).toBe(1);
    await session.skills.refresh();
    await session.actions.list({ source: 'skill' });
    expect(skills.listCallCount).toBe(2);
  });

  it('keeps same-name workspace actions when the code skill has no action metadata', async () => {
    const skills = new FakeWorkspaceSkills([
      {
        name: 'shared-name',
        description: 'Workspace action',
        path: 'skills/shared-name/SKILL.md',
        metadata: {
          action: {
            displayName: 'Workspace shared action',
          },
        },
      },
    ]);
    const provider = makeWorkspaceSkillsProvider(skills);
    const harness = new Harness({
      agents: { default: makeAgent() } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
      workspace: { kind: 'per-session', provider },
      skills: [
        {
          name: 'shared-name',
          description: 'Code skill without palette metadata',
          instructions: 'Run shared code skill.',
        },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'skill' })).resolves.toMatchObject([
      {
        id: 'skill:skills%2Fshared-name%2FSKILL.md',
        source: {
          kind: 'skill',
          ref: 'skills/shared-name/SKILL.md',
          skillName: 'shared-name',
          filePath: 'skills/shared-name/SKILL.md',
        },
        label: 'Workspace shared action',
      },
    ]);
  });

  it('keeps path-addressable same-name workspace actions when the code skill also has action metadata', async () => {
    const skills = new FakeWorkspaceSkills([
      {
        name: 'shared-name',
        description: 'Workspace action',
        path: 'skills/shared-name/SKILL.md',
        metadata: {
          action: {
            displayName: 'Workspace shared action',
          },
        },
      },
    ]);
    const provider = makeWorkspaceSkillsProvider(skills);
    const harness = new Harness({
      agents: { default: makeAgent() } as any,
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
      workspace: { kind: 'per-session', provider },
      skills: [
        {
          name: 'shared-name',
          description: 'Code skill with palette metadata',
          instructions: 'Run shared code skill.',
          action: {
            displayName: 'Code shared action',
          },
        },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'skill' })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill:shared-name',
          source: { kind: 'skill', ref: 'shared-name', skillName: 'shared-name' },
          label: 'Code shared action',
        }),
        expect.objectContaining({
          id: 'skill:skills%2Fshared-name%2FSKILL.md',
          source: {
            kind: 'skill',
            ref: 'skills/shared-name/SKILL.md',
            skillName: 'shared-name',
            filePath: 'skills/shared-name/SKILL.md',
          },
          label: 'Workspace shared action',
        }),
      ]),
    );
  });

  it('refreshes an already-materialized workspace skill source before rebuilding skill actions', async () => {
    const skills = new FakeWorkspaceSkills([
      {
        name: 'workspace-action',
        description: 'Workspace action',
        path: 'skills/workspace-action/SKILL.md',
        metadata: {
          action: {
            displayName: 'Workspace action',
          },
        },
      },
    ]);
    const harness = makeHarnessWithWorkspaceSkills(skills);
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'skill' })).resolves.toMatchObject([
      { id: 'skill:skills%2Fworkspace-action%2FSKILL.md' },
    ]);
    await expect(session.skills.list()).resolves.toMatchObject([{ name: 'workspace-action' }]);

    skills.addOnRefresh({
      name: 'new-workspace-action',
      description: 'New workspace action',
      path: 'skills/new-workspace-action/SKILL.md',
      metadata: {
        action: {
          displayName: 'New workspace action',
        },
      },
    });

    await session.actions.refresh();
    await expect(session.actions.list({ source: 'skill' })).resolves.toMatchObject([
      { id: 'skill:skills%2Fnew-workspace-action%2FSKILL.md' },
      { id: 'skill:skills%2Fworkspace-action%2FSKILL.md' },
    ]);
    await expect(session.skills.list()).resolves.toMatchObject([
      { name: 'workspace-action' },
      { name: 'new-workspace-action' },
    ]);
    expect(skills.refreshCallCount).toBe(1);
  });

  it('keeps code-registered actions listable when a per-session workspace is lost', async () => {
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
      workspace: { kind: 'per-session', provider: makeWorkspaceSkillsProvider(new FakeWorkspaceSkills([])) },
      skills: [
        {
          name: 'code-action',
          description: 'Code action',
          instructions: 'Run code action.',
          action: { displayName: 'Code action' },
        },
      ],
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });
    session._markWorkspaceLost();

    await expect(session.getWorkspace()).rejects.toBeInstanceOf(HarnessWorkspaceLostError);
    await expect(session.actions.list({ source: 'skill' })).resolves.toMatchObject([
      {
        id: 'skill:code-action',
        source: { kind: 'skill', skillName: 'code-action' },
        label: 'Code action',
      },
    ]);
  });

  it('caches successful MCP action entries and negative-caches failing MCP servers', async () => {
    const healthy = new MockMcpServer({
      id: 'healthy',
      name: 'Healthy',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    const failing = new FailingMcpServer({
      id: 'failing',
      name: 'Failing',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { healthy, failing },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:healthy:search_files' },
    ]);
    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:healthy:search_files' },
    ]);
    expect(healthy.toolListCallCount).toBe(1);
    expect(failing.toolListCallCount).toBe(1);
  });

  it('expires successful MCP action cache entries so context-filtered catalogs refresh', async () => {
    vi.useFakeTimers();
    try {
      const server = new MockMcpServer({
        id: 'ttl',
        name: 'TTL',
        version: '1.0.0',
        tools: { search_files: makeTool() },
      });
      const harness = new Harness({
        modes: [{ id: 'default', agentId: 'default' }],
        defaultModeId: 'default',
      });
      new Mastra({
        agents: { default: makeAgent() },
        storage: new InMemoryStore(),
        mcpServers: { ttl: server },
        harness,
      });
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
        { id: 'mcp-tool:ttl:search_files' },
      ]);
      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
        { id: 'mcp-tool:ttl:search_files' },
      ]);
      expect(server.toolListCallCount).toBe(1);

      await vi.advanceTimersByTimeAsync(5_001);
      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
        { id: 'mcp-tool:ttl:search_files' },
      ]);
      expect(server.toolListCallCount).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out hung MCP action discovery and bounds automatic retries', async () => {
    vi.useFakeTimers();
    try {
      const hanging = new HangingMcpServer({
        id: 'hanging',
        name: 'Hanging',
        version: '1.0.0',
        tools: { search_files: makeTool() },
      });
      const harness = new Harness({
        modes: [{ id: 'default', agentId: 'default' }],
        defaultModeId: 'default',
      });
      new Mastra({
        agents: { default: makeAgent() },
        storage: new InMemoryStore(),
        mcpServers: { hanging },
        harness,
      });
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

      const first = session.actions.list({ source: 'mcp-tool' });
      await vi.waitFor(() => expect(hanging.toolListCallCount).toBe(1));
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(first).resolves.toEqual([]);

      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toEqual([]);
      expect(hanging.toolListCallCount).toBe(1);

      await vi.advanceTimersByTimeAsync(5_001);
      const afterBackoff = session.actions.list({ source: 'mcp-tool' });
      await vi.waitFor(() => expect(hanging.toolListCallCount).toBe(2));
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(afterBackoff).resolves.toEqual([]);

      await vi.advanceTimersByTimeAsync(5_001);
      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toEqual([]);
      expect(hanging.toolListCallCount).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates a timed-out MCP action cache when the original discovery eventually resolves', async () => {
    vi.useFakeTimers();
    try {
      const slow = new GatedMcpServer({
        id: 'slow',
        name: 'Slow',
        version: '1.0.0',
        tools: { search_files: makeTool() },
      });
      const harness = new Harness({
        modes: [{ id: 'default', agentId: 'default' }],
        defaultModeId: 'default',
      });
      new Mastra({
        agents: { default: makeAgent() },
        storage: new InMemoryStore(),
        mcpServers: { slow },
        harness,
      });
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

      const first = session.actions.list({ source: 'mcp-tool' });
      await vi.waitFor(() => expect(slow.toolListCallCount).toBe(1));
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(first).resolves.toEqual([]);

      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toEqual([]);
      expect(slow.toolListCallCount).toBe(1);

      slow.release();
      await vi.waitFor(async () => {
        await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
          { id: 'mcp-tool:slow:search_files' },
        ]);
      });
      expect(slow.toolListCallCount).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps a late successful timed-out MCP discovery after a retry starts', async () => {
    vi.useFakeTimers();
    try {
      const slow = new GatedMcpServer({
        id: 'late-success',
        name: 'Late success',
        version: '1.0.0',
        tools: { search_files: makeTool() },
      });
      const harness = new Harness({
        modes: [{ id: 'default', agentId: 'default' }],
        defaultModeId: 'default',
      });
      new Mastra({
        agents: { default: makeAgent() },
        storage: new InMemoryStore(),
        mcpServers: { late: slow },
        harness,
      });
      const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

      const first = session.actions.list({ source: 'mcp-tool' });
      await vi.waitFor(() => expect(slow.toolListCallCount).toBe(1));
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(first).resolves.toEqual([]);

      await vi.advanceTimersByTimeAsync(5_001);
      const retry = session.actions.list({ source: 'mcp-tool' });
      await vi.waitFor(() => expect(slow.toolListCallCount).toBe(2));

      slow.release(0);
      await vi.advanceTimersByTimeAsync(0);
      await vi.waitFor(async () => {
        await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
          { id: 'mcp-tool:late:search_files' },
        ]);
      });

      await vi.advanceTimersByTimeAsync(2_000);
      await expect(retry).resolves.toEqual([]);
      await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
        { id: 'mcp-tool:late:search_files' },
      ]);
      expect(slow.toolListCallCount).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the resolved workspace identity for MCP action cache keys when available', async () => {
    const skills = new FakeWorkspaceSkills([]);
    const server = new MockMcpServer({
      id: 'workspace-mcp',
      name: 'Workspace MCP',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    const harness = makeRegisteredHarnessWithWorkspaceSkills(skills);
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { workspace: server },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await session.getWorkspace();
    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:workspace:search_files' },
    ]);
    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:workspace:search_files' },
    ]);
    expect(server.toolListCallCount).toBe(1);
  });

  it('does not provision or block behind a slow workspace provider for MCP action discovery', async () => {
    const server = new MockMcpServer({
      id: 'slow-workspace-mcp',
      name: 'Slow Workspace MCP',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    let createCalls = 0;
    let resumeCalls = 0;
    const provider: WorkspaceProvider = {
      providerId: 'slow-workspace-actions',
      resumable: true,
      create: async () => {
        createCalls++;
        return new Promise<Workspace>(() => {});
      },
      resume: async () => {
        resumeCalls++;
        return new Promise<Workspace>(() => {});
      },
    };
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      sessions: { storage: new InMemoryHarness({ db: new InMemoryDB() }) },
      workspace: { kind: 'per-session', provider },
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { workspace: server },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:workspace:search_files' },
    ]);
    expect(server.toolListCallCount).toBe(1);
    expect(createCalls).toBe(0);
    expect(resumeCalls).toBe(0);

    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:workspace:search_files' },
    ]);
    expect(server.toolListCallCount).toBe(1);
    expect(createCalls).toBe(0);
    expect(resumeCalls).toBe(0);
  });

  it('does not repopulate MCP action caches from discovery cleared by refresh', async () => {
    const server = new GatedMcpServer({
      id: 'gated-mcp',
      name: 'Gated MCP',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { gated: server },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    const first = session.actions.list({ source: 'mcp-tool' });
    while (server.toolListCallCount === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await session.actions.refresh();
    server.release();
    await expect(first).resolves.toMatchObject([{ id: 'mcp-tool:gated:search_files' }]);

    const second = session.actions.list({ source: 'mcp-tool' });
    while (server.toolListCallCount === 1) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    server.release();
    await expect(second).resolves.toMatchObject([{ id: 'mcp-tool:gated:search_files' }]);
    expect(server.toolListCallCount).toBe(2);
  });

  it('recovers MCP action entries after a transient tool-list failure', async () => {
    const flaky = new FlakyMcpServer({
      id: 'flaky',
      name: 'Flaky',
      version: '1.0.0',
      tools: { search_files: makeTool() },
    });
    const harness = new Harness({
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
    });
    new Mastra({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      mcpServers: { flaky },
      harness,
    });
    const session = await harness.session({ resourceId: 'u1', threadId: { fresh: true } });

    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toEqual([]);
    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toEqual([]);
    expect(flaky.toolListCallCount).toBe(1);

    await session.actions.refresh();
    await expect(session.actions.list({ source: 'mcp-tool' })).resolves.toMatchObject([
      { id: 'mcp-tool:flaky:search_files' },
    ]);
    expect(flaky.toolListCallCount).toBe(2);
  });

  it('validates malformed list and search options', async () => {
    const { session } = await makeSession();

    await expect(session.actions.list(null as any)).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.list({ query: 123 as any })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.list({ source: 'tool' as any })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.list({ limit: -1 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.list({ limit: 501 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.list({ offset: -1 })).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.search(123 as any)).rejects.toBeInstanceOf(HarnessValidationError);
    await expect(session.actions.search('ticket', null as any)).rejects.toBeInstanceOf(HarnessValidationError);
  });

  it('returns clone-safe action catalog snapshots', async () => {
    const { session } = await makeSession();
    const first = await session.actions.list();

    (first[0]!.permissions!.tools as string[]).push('tickets.delete');
    ((first[0]!.inputSchema as Record<string, any>).properties.ticketId as Record<string, unknown>).type = 'number';
    (first[0]!.shortcuts![0]!.keys as string[]).push('mod+d');
    (first[1]!.mcp!.meta!.ui as Record<string, unknown>).resourceUri = 'mutated';

    const second = await session.actions.list();
    expect(second[0]!.permissions!.tools).toEqual(['tickets.open']);
    expect(((second[0]!.inputSchema as Record<string, any>).properties.ticketId as Record<string, unknown>).type).toBe(
      'string',
    );
    expect(second[0]!.shortcuts![0]!.keys).toEqual(['mod+o']);
    expect((second[1]!.mcp!.meta!.ui as Record<string, unknown>).resourceUri).toBe('ui://files/search');
  });

  it('throws HarnessSessionClosedError after close()', async () => {
    const { session } = await makeSession();

    await session.close();

    await expect(session.actions.list()).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.actions.search('ticket')).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.actions.search(123 as any)).rejects.toBeInstanceOf(HarnessSessionClosedError);
    await expect(session.actions.refresh()).rejects.toBeInstanceOf(HarnessSessionClosedError);
  });
});
