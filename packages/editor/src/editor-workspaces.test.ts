import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { LibSQLStore } from '@mastra/libsql';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import type { FilesystemProvider, SandboxProvider } from '@mastra/core/editor';
import { MastraModelGateway, ProviderConfig } from '@mastra/core/llm';
import { convertArrayToReadableStream, LanguageModelV2, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { MastraEditor } from './index';

// =============================================================================
// Helpers
// =============================================================================

const mockLogger = () => ({
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
  trackException: vi.fn(),
});

let testStorageCount = 0;
const createSetup = async (editorConfig?: ConstructorParameters<typeof MastraEditor>[0]) => {
  const storage = new LibSQLStore({ id: `ws-test-${testStorageCount++}`, url: ':memory:' });
  const editor = new MastraEditor({ logger: mockLogger() as any, ...editorConfig });
  const mastra = new Mastra({ storage, editor });
  await storage.init();
  return { storage, editor, mastra };
};

// =============================================================================
// Mock LLM helpers for execution tests
// =============================================================================

const createMockLLM = (
  responses: Array<{ text?: string; toolCall?: { name: string; args: Record<string, unknown> } }>,
): MockLanguageModelV2 => {
  let responseIndex = 0;

  return new MockLanguageModelV2({
    doGenerate: async () => {
      const response = responses[responseIndex] || { text: 'Default response' };
      if (responseIndex < responses.length - 1) responseIndex++;

      const content: any[] = [];
      if (response.text) content.push({ type: 'text', text: response.text });
      if (response.toolCall) {
        content.push({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId: `call_${Date.now()}`,
          toolName: response.toolCall.name,
          input: JSON.stringify(response.toolCall.args),
        });
      }

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: response.toolCall ? 'tool-calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        content,
        warnings: [],
      };
    },
    doStream: async () => {
      const response = responses[responseIndex] || { text: 'Default response' };
      if (responseIndex < responses.length - 1) responseIndex++;

      const chunks: any[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
      ];
      if (response.text) {
        chunks.push(
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: response.text },
          { type: 'text-end', id: 'text-1' },
        );
      }
      if (response.toolCall) {
        chunks.push({
          type: 'tool-call',
          toolCallId: `call_${Date.now()}`,
          toolName: response.toolCall.name,
          input: JSON.stringify(response.toolCall.args),
          providerExecuted: false,
        });
      }
      chunks.push({
        type: 'finish',
        finishReason: response.toolCall ? 'tool-calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(chunks),
      };
    },
  });
};

class MockGateway extends MastraModelGateway {
  readonly id = 'models.dev';
  readonly name = 'Mock Gateway';

  private llmOverrides: Record<string, MockLanguageModelV2> = {};

  setLLM(modelId: string, llm: MockLanguageModelV2) {
    this.llmOverrides[modelId] = llm;
  }

  async fetchProviders(): Promise<Record<string, ProviderConfig>> {
    return {
      mock: { name: 'Mock Provider', models: ['mock-model'], apiKeyEnvVar: 'MOCK_API_KEY', gateway: 'models.dev' },
    };
  }
  buildUrl(): string {
    return 'https://api.mock-gateway.com/v1';
  }
  getApiKey(): Promise<string> {
    return Promise.resolve(process.env.MOCK_API_KEY || 'MOCK_API_KEY');
  }
  async resolveEmbeddingModel(): Promise<any> {
    return {
      specificationVersion: 'v2',
      modelId: 'mock-embedding',
      provider: 'mock',
      maxEmbeddingsPerCall: 2048,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: any[] }) => ({
        embeddings: values.map(() => new Array(1536).fill(0).map(() => Math.random())),
      }),
    };
  }
  async resolveLanguageModel({
    modelId,
  }: {
    modelId: string;
    providerId: string;
    apiKey: string;
  }): Promise<LanguageModelV2> {
    const key = modelId.replace('mock/', '');
    if (this.llmOverrides[key]) return this.llmOverrides[key];
    return createMockLLM([{ text: 'Default mock response' }]);
  }
}

// =============================================================================
// Workspace CRUD Tests
// =============================================================================

describe('editor.workspace — CRUD', () => {
  it('should create and retrieve a workspace', async () => {
    const { editor, storage } = await createSetup();

    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-1',
        name: 'Test Workspace',
        description: 'A workspace for tests',
        filesystem: { provider: 'local', config: { basePath: '/tmp/test' } },
      },
    });

    const resolved = await editor.workspace.getById('ws-1');
    expect(resolved).toBeDefined();
    expect(resolved!.name).toBe('Test Workspace');
    expect(resolved!.description).toBe('A workspace for tests');
    expect(resolved!.filesystem).toEqual({ provider: 'local', config: { basePath: '/tmp/test' } });
  });

  it('should list workspaces', async () => {
    const { editor, storage } = await createSetup();

    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-list-1',
        name: 'WS 1',
        filesystem: { provider: 'local', config: { basePath: '/a' } },
      },
    });
    await workspaceStore!.create({
      workspace: {
        id: 'ws-list-2',
        name: 'WS 2',
        sandbox: { provider: 'local', config: {} },
      },
    });

    const result = await editor.workspace.list({});
    expect(result.workspaces).toHaveLength(2);
  });

  it('should update a workspace', async () => {
    const { editor, storage } = await createSetup();

    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-upd',
        name: 'Before Update',
        filesystem: { provider: 'local', config: { basePath: '/tmp/before' } },
      },
    });

    await editor.workspace.update({
      id: 'ws-upd',
      name: 'After Update',
      filesystem: { provider: 'local', config: { basePath: '/tmp/after' } },
    });

    const resolved = await editor.workspace.getById('ws-upd');
    expect(resolved!.name).toBe('After Update');
    expect(resolved!.filesystem?.config).toEqual({ basePath: '/tmp/after' });
  });

  it('should delete a workspace', async () => {
    const { editor, storage } = await createSetup();

    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-del',
        name: 'To Delete',
        filesystem: { provider: 'local', config: { basePath: '/tmp/del' } },
      },
    });

    const before = await editor.workspace.getById('ws-del');
    expect(before).toBeDefined();

    await editor.workspace.delete('ws-del');

    const after = await editor.workspace.getById('ws-del');
    expect(after).toBeNull();
  });

  it('should list resolved workspaces with active version data', async () => {
    const { editor, storage } = await createSetup();

    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-resolved',
        name: 'Resolved WS',
        sandbox: { provider: 'local', config: { workingDirectory: '/tmp' } },
        autoSync: true,
        operationTimeout: 5000,
      },
    });

    const result = await editor.workspace.listResolved({});
    expect(result.workspaces).toHaveLength(1);
    expect(result.workspaces[0]!.name).toBe('Resolved WS');
    expect(result.workspaces[0]!.autoSync).toBe(true);
    expect(result.workspaces[0]!.operationTimeout).toBe(5000);
  });

  it('should create a workspace via editor.workspace.create()', async () => {
    const { editor } = await createSetup();

    const resolved = await editor.workspace.create({
      id: 'ws-created',
      name: 'Created WS',
      filesystem: { provider: 'local', config: { basePath: '/tmp/created' } },
      tools: { enabled: true, requireApproval: false },
    });

    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('ws-created');
    expect(resolved.name).toBe('Created WS');

    // Retrieve to verify it persisted
    const fetched = await editor.workspace.getById('ws-created');
    expect(fetched!.tools).toEqual({ enabled: true, requireApproval: false });
  });
});

// =============================================================================
// Workspace Hydration Tests
// =============================================================================

describe('editor.workspace — hydrateSnapshotToWorkspace', () => {
  it('should hydrate a workspace with a local filesystem', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-fs', {
      name: 'FS Workspace',
      filesystem: { provider: 'local', config: { basePath: '/tmp/hydrate' } },
    });

    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace.name).toBe('FS Workspace');
    expect(workspace.id).toBe('ws-hydrate-fs');
  });

  it('should hydrate a workspace with a local sandbox', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-sb', {
      name: 'SB Workspace',
      sandbox: { provider: 'local', config: { workingDirectory: '/tmp/sb' } },
    });

    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace.name).toBe('SB Workspace');
  });

  it('should hydrate a workspace with skills (standalone)', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-skills', {
      name: 'Skills Workspace',
      skills: ['skill-a', 'skill-b'],
    });

    expect(workspace).toBeInstanceOf(Workspace);
  });

  it('should hydrate a workspace with mounts', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-mounts', {
      name: 'Mounts Workspace',
      mounts: {
        '/data': { provider: 'local', config: { basePath: '/tmp/mount-data' } },
        '/logs': { provider: 'local', config: { basePath: '/tmp/mount-logs', readOnly: true } },
      },
    });

    expect(workspace).toBeInstanceOf(Workspace);
  });

  it('should hydrate BM25 search config', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-search', {
      name: 'Search Workspace',
      filesystem: { provider: 'local', config: { basePath: '/tmp/search' } },
      search: {
        bm25: { k1: 2.0, b: 0.8 },
        searchIndexName: 'test_search_idx',
      },
    });

    expect(workspace).toBeInstanceOf(Workspace);
  });

  it('should throw for unregistered filesystem provider', async () => {
    const { editor } = await createSetup();

    await expect(
      editor.workspace.hydrateSnapshotToWorkspace('ws-bad-fs', {
        name: 'Bad Provider WS',
        filesystem: { provider: 'nonexistent-fs', config: {} },
      }),
    ).rejects.toThrow('Filesystem provider "nonexistent-fs" is not registered');
  });

  it('should throw for unregistered sandbox provider', async () => {
    const { editor } = await createSetup();

    await expect(
      editor.workspace.hydrateSnapshotToWorkspace('ws-bad-sb', {
        name: 'Bad Provider WS',
        sandbox: { provider: 'nonexistent-sb', config: {} },
      }),
    ).rejects.toThrow('Sandbox provider "nonexistent-sb" is not registered');
  });

  it('should pass tools/autoSync/operationTimeout through to Workspace', async () => {
    const { editor } = await createSetup();

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-hydrate-opts', {
      name: 'Options Workspace',
      filesystem: { provider: 'local', config: { basePath: '/tmp/opts' } },
      tools: {
        enabled: true,
        requireApproval: true,
        tools: {
          mastra_workspace_read_file: { enabled: true },
          mastra_workspace_write_file: { enabled: false },
        },
      },
      autoSync: true,
      operationTimeout: 10000,
    });

    expect(workspace).toBeInstanceOf(Workspace);
  });
});

// =============================================================================
// Provider Registry Tests
// =============================================================================

describe('editor — provider registry', () => {
  it('should auto-register local filesystem and sandbox providers', () => {
    const editor = new MastraEditor();

    const fsProviders = editor.getFilesystemProviders();
    const sbProviders = editor.getSandboxProviders();

    expect(fsProviders.some(p => p.id === 'local')).toBe(true);
    expect(sbProviders.some(p => p.id === 'local')).toBe(true);
  });

  it('should merge custom providers with built-in ones', () => {
    const customFsProvider: FilesystemProvider<{ bucket: string }> = {
      id: 'custom-fs',
      name: 'Custom FS',
      createFilesystem: config => {
        throw new Error('Not implemented in test');
      },
    };

    const customSbProvider: SandboxProvider<{ token: string }> = {
      id: 'custom-sb',
      name: 'Custom Sandbox',
      createSandbox: config => {
        throw new Error('Not implemented in test');
      },
    };

    const editor = new MastraEditor({
      filesystems: { 'custom-fs': customFsProvider },
      sandboxes: { 'custom-sb': customSbProvider },
    });

    const fsProviders = editor.getFilesystemProviders();
    expect(fsProviders).toHaveLength(2);
    expect(fsProviders.some(p => p.id === 'local')).toBe(true);
    expect(fsProviders.some(p => p.id === 'custom-fs')).toBe(true);

    const sbProviders = editor.getSandboxProviders();
    expect(sbProviders).toHaveLength(2);
    expect(sbProviders.some(p => p.id === 'local')).toBe(true);
    expect(sbProviders.some(p => p.id === 'custom-sb')).toBe(true);
  });

  it('should allow custom provider to hydrate workspaces', async () => {
    const mockFsInstance = {
      id: 'mock-fs-inst',
      name: 'Mock FS',
      provider: 'mock-fs',
      readOnly: false,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      mkdir: vi.fn(),
      readdir: vi.fn(),
      stat: vi.fn(),
      exists: vi.fn(),
      rm: vi.fn(),
      watch: vi.fn(),
      destroy: vi.fn(),
    } as any;

    const customFsProvider: FilesystemProvider<{ endpoint: string }> = {
      id: 'mock-fs',
      name: 'Mock FS Provider',
      createFilesystem: config => {
        expect(config.endpoint).toBe('http://localhost:9000');
        return mockFsInstance;
      },
    };

    const { editor } = await createSetup({
      filesystems: { 'mock-fs': customFsProvider },
    });

    const workspace = await editor.workspace.hydrateSnapshotToWorkspace('ws-custom', {
      name: 'Custom FS Workspace',
      filesystem: { provider: 'mock-fs', config: { endpoint: 'http://localhost:9000' } },
    });

    expect(workspace).toBeInstanceOf(Workspace);
  });
});

// =============================================================================
// Agent + Workspace Integration Tests
// =============================================================================

describe('editor.agent — workspace integration', () => {
  it('should create an agent with an inline workspace', async () => {
    const { editor, storage } = await createSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-inline-ws',
        name: 'Agent With Inline Workspace',
        instructions: 'You are a test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        workspace: {
          type: 'inline',
          config: {
            name: 'Inline WS',
            filesystem: { provider: 'local', config: { basePath: '/tmp/inline-ws' } },
          },
        },
      },
    });

    const agent = await editor.agent.getById('agent-inline-ws');
    expect(agent).toBeInstanceOf(Agent);

    // The agent should have a workspace configured
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace!.name).toBe('Inline WS');
  });

  it('should create an agent with an ID-referenced workspace', async () => {
    const { editor, storage } = await createSetup();

    // First, create the workspace in storage
    const workspaceStore = await storage.getStore('workspaces');
    await workspaceStore!.create({
      workspace: {
        id: 'ws-ref',
        name: 'Referenced Workspace',
        sandbox: { provider: 'local', config: { workingDirectory: '/tmp/ref-ws' } },
      },
    });

    // Create the agent referencing the workspace by ID
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-ref-ws',
        name: 'Agent With Referenced Workspace',
        instructions: 'You are a test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        workspace: {
          type: 'id',
          workspaceId: 'ws-ref',
        },
      },
    });

    const agent = await editor.agent.getById('agent-ref-ws');
    expect(agent).toBeInstanceOf(Agent);

    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeInstanceOf(Workspace);
    expect(workspace!.name).toBe('Referenced Workspace');
  });

  it('should handle agent without workspace gracefully', async () => {
    const { editor, storage } = await createSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-no-ws',
        name: 'Agent Without Workspace',
        instructions: 'Just a simple agent',
        model: { provider: 'openai', name: 'gpt-4' },
      },
    });

    const agent = await editor.agent.getById('agent-no-ws');
    expect(agent).toBeInstanceOf(Agent);

    // getWorkspace should return undefined (no workspace configured, no global)
    const workspace = await agent!.getWorkspace({});
    expect(workspace).toBeUndefined();
  });

  it('should handle agent with missing workspace ID reference gracefully', async () => {
    const logger = mockLogger();
    const { editor, storage } = await createSetup({ logger: logger as any });

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-bad-ref',
        name: 'Agent With Bad Ref',
        instructions: 'Missing workspace',
        model: { provider: 'openai', name: 'gpt-4' },
        workspace: {
          type: 'id',
          workspaceId: 'nonexistent-ws',
        },
      },
    });

    // Should still create the agent, just without a workspace
    const agent = await editor.agent.getById('agent-bad-ref');
    expect(agent).toBeInstanceOf(Agent);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nonexistent-ws'));
  });

  it('should pass skillsFormat from stored config to agent', async () => {
    const { editor, storage } = await createSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-skills-format',
        name: 'Agent With Skills Format',
        instructions: 'You are a test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        workspace: {
          type: 'inline',
          config: {
            name: 'Skills WS',
            skills: ['skill-1', 'skill-2'],
          },
        },
        skillsFormat: 'xml',
      },
    });

    const agent = await editor.agent.getById('agent-skills-format');
    expect(agent).toBeInstanceOf(Agent);
  });

  it('should handle conditional workspace resolution', async () => {
    const { editor, storage } = await createSetup();

    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'agent-conditional-ws',
        name: 'Agent With Conditional Workspace',
        instructions: 'You are a test agent',
        model: { provider: 'openai', name: 'gpt-4' },
        workspace: [
          {
            value: {
              type: 'inline' as const,
              config: {
                name: 'Dev Workspace',
                filesystem: { provider: 'local', config: { basePath: '/tmp/dev' } },
              },
            },
            rules: {
              operator: 'AND' as const,
              conditions: [
                {
                  field: 'environment',
                  operator: 'equals' as const,
                  value: 'development',
                },
              ],
            },
          },
          {
            // Default fallback (no rules)
            value: {
              type: 'inline' as const,
              config: {
                name: 'Prod Workspace',
                filesystem: { provider: 'local', config: { basePath: '/tmp/prod' } },
              },
            },
          },
        ],
      },
    });

    // The agent should be created successfully with a dynamic workspace resolver
    const agent = await editor.agent.getById('agent-conditional-ws');
    expect(agent).toBeInstanceOf(Agent);
  });
});

// =============================================================================
// Agent + Workspace Execution Integration Tests
// =============================================================================
// These tests verify the full E2E flow: store agent w/ workspace → hydrate →
// execute agent.generate() → verify workspace context is available to tools.

describe('editor.agent — workspace execution integration', () => {
  let tempDir: string;
  let gateway: MockGateway;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'editor-ws-exec-'));
    gateway = new MockGateway();
    // Use a unique API key per test to avoid ModelRouterLanguageModel's static cache
    process.env.MOCK_API_KEY = `test-key-${Date.now()}-${Math.random()}`;
  });

  afterEach(async () => {
    delete process.env.MOCK_API_KEY;
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  const createExecutionSetup = async (extraTools?: Record<string, any>) => {
    const storage = new LibSQLStore({ id: `ws-exec-${testStorageCount++}`, url: ':memory:' });
    const editor = new MastraEditor({ logger: mockLogger() as any });
    const mastra = new Mastra({
      storage,
      editor,
      gateways: { 'models.dev': gateway },
      tools: extraTools ?? {},
    });
    await storage.init();
    return { storage, editor, mastra };
  };

  it('should pass workspace context to tools during agent.generate()', async () => {
    let capturedWorkspace: Workspace | undefined;

    const workspaceCheckTool = createTool({
      id: 'workspace-check',
      description: 'Checks workspace availability',
      inputSchema: z.object({ action: z.string() }),
      execute: async (_input, context) => {
        capturedWorkspace = context.workspace;
        return {
          workspaceAvailable: !!context.workspace,
          workspaceId: context.workspace?.id,
          filesystemAvailable: !!context.workspace?.filesystem,
        };
      },
    });

    // Configure mock model to call the workspace-check tool
    gateway.setLLM(
      'workspace-mock',
      createMockLLM([
        { toolCall: { name: 'workspace-check', args: { action: 'test' } } },
        { text: 'Workspace check complete.' },
      ]),
    );

    const { storage, editor } = await createExecutionSetup({ 'workspace-check': workspaceCheckTool });
    const agentsStore = await storage.getStore('agents');

    // Create an agent with inline workspace + tool
    await agentsStore!.create({
      agent: {
        id: 'ws-exec-agent',
        name: 'WS Execution Agent',
        instructions: 'Use workspace-check tool.',
        model: { provider: 'mock', name: 'workspace-mock' },
        tools: { 'workspace-check': {} },
        workspace: {
          type: 'inline',
          config: {
            name: 'Execution Workspace',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
          },
        },
      },
    });

    const agent = await editor.agent.getById('ws-exec-agent');
    expect(agent).toBeInstanceOf(Agent);

    // Verify workspace is properly configured
    const ws = await agent!.getWorkspace({});
    expect(ws).toBeInstanceOf(Workspace);
    expect(ws!.name).toBe('Execution Workspace');

    // Execute the agent — mock model will call workspace-check tool
    const response = await agent!.generate('Check workspace');

    // Verify the tool received the workspace in its context
    expect(capturedWorkspace).toBeInstanceOf(Workspace);
    expect(capturedWorkspace!.name).toBe('Execution Workspace');
    expect(capturedWorkspace!.filesystem).toBeDefined();

    // Verify the response completed
    expect(response.text).toBe('Workspace check complete.');
  });

  it('should pass workspace context to tools during agent.stream()', async () => {
    let capturedWorkspace: Workspace | undefined;

    const workspaceCheckTool = createTool({
      id: 'workspace-check',
      description: 'Checks workspace availability',
      inputSchema: z.object({ action: z.string() }),
      execute: async (_input, context) => {
        capturedWorkspace = context.workspace;
        return {
          workspaceAvailable: !!context.workspace,
          workspaceId: context.workspace?.id,
        };
      },
    });

    gateway.setLLM(
      'workspace-mock',
      createMockLLM([
        { toolCall: { name: 'workspace-check', args: { action: 'stream-test' } } },
        { text: 'Stream workspace check done.' },
      ]),
    );

    const { storage, editor } = await createExecutionSetup({ 'workspace-check': workspaceCheckTool });
    const agentsStore = await storage.getStore('agents');

    await agentsStore!.create({
      agent: {
        id: 'ws-stream-agent',
        name: 'WS Stream Agent',
        instructions: 'Use workspace-check tool.',
        model: { provider: 'mock', name: 'workspace-mock' },
        tools: { 'workspace-check': {} },
        workspace: {
          type: 'inline',
          config: {
            name: 'Stream Workspace',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
          },
        },
      },
    });

    const agent = await editor.agent.getById('ws-stream-agent');
    expect(agent).toBeInstanceOf(Agent);

    // Execute via streaming
    const stream = await agent!.stream('Check workspace');
    // Wait for full stream consumption including tool results
    const toolResults = await stream.toolResults;

    // Verify the tool received the workspace in its context
    expect(capturedWorkspace).toBeInstanceOf(Workspace);
    expect(capturedWorkspace!.name).toBe('Stream Workspace');
  });

  it('should pass ID-referenced workspace context to tools during execution', async () => {
    let capturedWorkspace: Workspace | undefined;

    const workspaceCheckTool = createTool({
      id: 'workspace-check',
      description: 'Checks workspace availability',
      inputSchema: z.object({ action: z.string() }),
      execute: async (_input, context) => {
        capturedWorkspace = context.workspace;
        return {
          workspaceAvailable: !!context.workspace,
          workspaceId: context.workspace?.id,
        };
      },
    });

    gateway.setLLM(
      'workspace-mock',
      createMockLLM([
        { toolCall: { name: 'workspace-check', args: { action: 'id-ref' } } },
        { text: 'ID workspace check done.' },
      ]),
    );

    const { storage, editor } = await createExecutionSetup({ 'workspace-check': workspaceCheckTool });

    // First, create the workspace in storage
    const wsStore = await storage.getStore('workspaces');
    await wsStore!.create({
      workspace: {
        id: 'shared-ws',
        name: 'Shared Workspace',
        filesystem: { provider: 'local', config: { basePath: tempDir } },
      },
    });

    // Create the agent referencing the workspace by ID
    const agentsStore = await storage.getStore('agents');
    await agentsStore!.create({
      agent: {
        id: 'ws-idref-agent',
        name: 'WS ID-Ref Agent',
        instructions: 'Use workspace-check tool.',
        model: { provider: 'mock', name: 'workspace-mock' },
        tools: { 'workspace-check': {} },
        workspace: { type: 'id', workspaceId: 'shared-ws' },
      },
    });

    const agent = await editor.agent.getById('ws-idref-agent');
    expect(agent).toBeInstanceOf(Agent);

    const response = await agent!.generate('Check workspace');

    expect(capturedWorkspace).toBeInstanceOf(Workspace);
    expect(capturedWorkspace!.name).toBe('Shared Workspace');
    expect(response.text).toBe('ID workspace check done.');
  });

  it('should make workspace filesystem operational during tool execution', async () => {
    // Write a file to tempDir, then verify the tool can read it via workspace.filesystem
    const testContent = 'Hello from workspace filesystem!';
    await fs.writeFile(path.join(tempDir, 'test.txt'), testContent);

    const readFileTool = createTool({
      id: 'read-file',
      description: 'Reads a file from workspace',
      inputSchema: z.object({ filePath: z.string() }),
      execute: async ({ filePath }, context) => {
        const wsFs = context.workspace?.filesystem;
        if (!wsFs) return { content: null, error: 'No workspace filesystem' };
        try {
          const data = await wsFs.readFile(filePath);
          return { content: data.toString(), error: null };
        } catch (e: any) {
          return { content: null, error: e.message };
        }
      },
    });

    gateway.setLLM(
      'fs-mock',
      createMockLLM([
        { toolCall: { name: 'read-file', args: { filePath: 'test.txt' } } },
        { text: 'File read successfully.' },
      ]),
    );

    const { storage, editor } = await createExecutionSetup({ 'read-file': readFileTool });
    const agentsStore = await storage.getStore('agents');

    await agentsStore!.create({
      agent: {
        id: 'ws-fs-agent',
        name: 'WS Filesystem Agent',
        instructions: 'Use read-file tool.',
        model: { provider: 'mock', name: 'fs-mock' },
        tools: { 'read-file': {} },
        workspace: {
          type: 'inline',
          config: {
            name: 'FS Workspace',
            filesystem: { provider: 'local', config: { basePath: tempDir } },
          },
        },
      },
    });

    const agent = await editor.agent.getById('ws-fs-agent');
    expect(agent).toBeInstanceOf(Agent);

    const response = await agent!.generate('Read test.txt');

    // The tool should have been called and returned the file content
    const toolResult = response.toolResults.find((r: any) => r.payload.toolName === 'read-file')?.payload as any;
    expect(toolResult?.result?.content).toBe(testContent);
    expect(toolResult?.result?.error).toBeNull();
  });

  it('should handle agent without workspace — tools get undefined workspace', async () => {
    let capturedWorkspace: Workspace | undefined = new Workspace({
      name: 'sentinel',
      skills: ['placeholder'],
    });

    const workspaceCheckTool = createTool({
      id: 'workspace-check',
      description: 'Checks workspace availability',
      inputSchema: z.object({ action: z.string() }),
      execute: async (_input, context) => {
        capturedWorkspace = context.workspace;
        return { workspaceAvailable: !!context.workspace };
      },
    });

    gateway.setLLM(
      'no-ws-mock',
      createMockLLM([{ toolCall: { name: 'workspace-check', args: { action: 'check' } } }, { text: 'No workspace.' }]),
    );

    const { storage, editor } = await createExecutionSetup({ 'workspace-check': workspaceCheckTool });
    const agentsStore = await storage.getStore('agents');

    await agentsStore!.create({
      agent: {
        id: 'no-ws-agent',
        name: 'No WS Agent',
        instructions: 'Use workspace-check tool.',
        model: { provider: 'mock', name: 'no-ws-mock' },
        tools: { 'workspace-check': {} },
        // No workspace
      },
    });

    const agent = await editor.agent.getById('no-ws-agent');
    expect(agent).toBeInstanceOf(Agent);

    await agent!.generate('Check workspace');

    // With no workspace configured, the tool should receive undefined
    expect(capturedWorkspace).toBeUndefined();
  });
});
