import { describe, expect, it } from 'vitest';
import type {
  SourceFile,
  SourceFileHistoryEntry,
  SourceFileHistoryInput,
  SourceFileListEntry,
  SourceFileListInput,
  SourceFileRef,
  SourceStorageCapabilities,
  SourceStorageProvider,
  SourceWriteFileInput,
  SourceWriteResult,
} from '../../source-storage';
import { getSourceAgentFilePath } from '../../source-storage';
import { SourceAgentsStorage } from './source';

class MockSourceProvider implements SourceStorageProvider {
  id = 'mock-source';
  displayName = 'Mock Source';

  files = new Map<string, string>();
  refs = new Map<string, Map<string, string>>();
  writes: SourceWriteFileInput[] = [];
  history: SourceFileHistoryEntry[] = [];
  capabilities: SourceStorageCapabilities = {
    canRead: true,
    canWrite: true,
    canListHistory: true,
    canOpenChangeRequest: false,
  };

  async getCapabilities(): Promise<SourceStorageCapabilities> {
    return this.capabilities;
  }

  async readFile(input: SourceFileRef): Promise<SourceFile | null> {
    const content = input.ref ? this.refs.get(input.ref)?.get(input.path) : this.files.get(input.path);
    return content === undefined ? null : { path: input.path, ref: input.ref, content };
  }

  async writeFile(input: SourceWriteFileInput): Promise<SourceWriteResult> {
    this.writes.push(input);
    this.files.set(input.path, input.content);
    return { path: input.path, commitSha: `commit-${this.writes.length}` };
  }

  async listFileHistory(_input: SourceFileHistoryInput): Promise<SourceFileHistoryEntry[]> {
    return this.history;
  }

  async listFiles(input: SourceFileListInput): Promise<SourceFileListEntry[]> {
    const prefix = `${input.path.replace(/^\/+|\/+$/g, '')}/`;
    return [...this.files.keys()]
      .filter(path => path.startsWith(prefix))
      .map(path => ({ path }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }
}

const model = { provider: 'openai', name: 'gpt-4' };

describe('SourceAgentsStorage', () => {
  it('persists code-source snapshots through the source provider using canonical paths', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsStorage({ provider });
    storage.__registerMastra({
      getAgentById: () => ({
        source: 'code',
        __getEditorConfig: () => ({ instructions: true, tools: true }),
      }),
    });

    await storage.create({
      agent: {
        id: 'weather agent',
        name: 'Weather Agent',
        instructions: 'Use weather data.',
        model,
        tools: { weatherTool: { description: 'Get weather' } },
      },
    });

    expect(provider.writes).toHaveLength(1);
    expect(provider.writes[0]?.path).toBe('agents/weather%20agent.json');
    expect(JSON.parse(provider.writes[0]?.content ?? '{}')).toEqual({
      instructions: 'Use weather data.',
      tools: { weatherTool: { description: 'Get weather' } },
    });
  });

  it('omits instructions for descriptions-only code agents', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsStorage({ provider });
    storage.__registerMastra({
      getAgentById: () => ({
        source: 'code',
        __getEditorConfig: () => ({ tools: { description: true } }),
      }),
    });

    await storage.create({
      agent: {
        id: 'descriptions-only',
        name: 'Descriptions Only',
        instructions: 'Code owns these instructions.',
        model,
        tools: { weatherTool: { description: 'Editable description' } },
        integrationTools: { composio: {} },
        mcpClients: { local: {} },
      },
    });

    expect(JSON.parse(provider.writes[0]?.content ?? '{}')).toEqual({
      tools: { weatherTool: { description: 'Editable description' } },
    });
  });

  it('persists editable snapshots for storage-only agents without a code definition', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsStorage({ provider });

    await storage.create({
      agent: {
        id: 'storage-only',
        name: 'Storage Only',
        instructions: 'Created in studio.',
        model,
        scorers: { quality: { description: 'Quality scorer' } },
        skills: { coding: { description: 'Coding skill' } },
        integrationTools: { composio: {} },
        mcpClients: { local: {} },
        tools: { weatherTool: { description: 'Get weather' } },
      },
    });

    expect(provider.writes).toHaveLength(1);
    expect(provider.writes[0]?.path).toBe('agents/storage-only.json');
    expect(JSON.parse(provider.writes[0]?.content ?? '{}')).toEqual({
      name: 'Storage Only',
      instructions: 'Created in studio.',
      tools: { weatherTool: { description: 'Get weather' } },
    });
  });

  it('still strips non-editable fields when getAgentById throws for storage-only agents', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsStorage({ provider });
    storage.__registerMastra({
      getAgentById: () => {
        throw new Error('Agent with id storage-only not found');
      },
    });

    await expect(
      storage.create({
        agent: {
          id: 'storage-only',
          name: 'Storage Only',
          instructions: 'Created in studio.',
          model,
        },
      }),
    ).resolves.toBeDefined();

    expect(JSON.parse(provider.writes[0]?.content ?? '{}')).toEqual({
      name: 'Storage Only',
      instructions: 'Created in studio.',
    });
  });

  it('hydrates an agent snapshot from the source provider on demand', async () => {
    const provider = new MockSourceProvider();
    provider.files.set(
      getSourceAgentFilePath('weather-agent'),
      JSON.stringify({ instructions: 'Stored instructions', tools: { weatherTool: { description: 'Stored' } } }),
    );
    const storage = new SourceAgentsStorage({ provider });

    const agent = await storage.getByIdResolved('weather-agent');

    expect(agent).toMatchObject({
      id: 'weather-agent',
      status: 'published',
      instructions: 'Stored instructions',
      tools: { weatherTool: { description: 'Stored' } },
    });
  });

  it('discovers storage-only agents from provider files on cold start', async () => {
    const provider = new MockSourceProvider();
    provider.files.set(
      getSourceAgentFilePath('studio only'),
      JSON.stringify({ name: 'Studio Only', instructions: 'Persisted in source storage.', model }),
    );
    const storage = new SourceAgentsStorage({ provider });

    await storage.init();
    const list = await storage.listResolved();

    expect(list.agents).toHaveLength(1);
    expect(list.agents[0]).toMatchObject({
      id: 'studio only',
      name: 'Studio Only',
      instructions: 'Persisted in source storage.',
    });
  });

  it('maps source file history to versions with snapshot content from each ref', async () => {
    const provider = new MockSourceProvider();
    const firstRef = new Map<string, string>();
    firstRef.set(getSourceAgentFilePath('weather-agent'), JSON.stringify({ instructions: 'First' }));
    const secondRef = new Map<string, string>();
    secondRef.set(getSourceAgentFilePath('weather-agent'), JSON.stringify({ instructions: 'Second' }));
    provider.refs.set('sha-1', firstRef);
    provider.refs.set('sha-2', secondRef);
    provider.history = [
      { id: 'sha-2', ref: 'sha-2', message: 'Second save', createdAt: '2026-06-01T02:00:00.000Z' },
      { id: 'sha-1', ref: 'sha-1', message: 'First save', createdAt: '2026-06-01T01:00:00.000Z' },
    ];
    const storage = new SourceAgentsStorage({ provider });

    const versions = await storage.listVersions({
      agentId: 'weather-agent',
      orderBy: { field: 'versionNumber', direction: 'ASC' },
    });

    expect(versions.versions).toHaveLength(2);
    expect(versions.versions.map(version => version.changeMessage)).toEqual(['First save', 'Second save']);
    expect(versions.versions.map(version => version.instructions)).toEqual(['First', 'Second']);
  });

  it('rejects writes when the source provider cannot write', async () => {
    const provider = new MockSourceProvider();
    provider.capabilities = {
      canRead: true,
      canWrite: false,
      canListHistory: true,
      canOpenChangeRequest: false,
      reason: 'missing-permissions',
    };
    const storage = new SourceAgentsStorage({ provider });

    await expect(
      storage.create({
        agent: {
          id: 'weather-agent',
          name: 'Weather Agent',
          instructions: 'Use weather data.',
          model,
        },
      }),
    ).rejects.toThrow('missing-permissions');
  });

  it('checks provider capabilities during init', async () => {
    const provider = new MockSourceProvider();
    provider.capabilities = {
      canRead: false,
      canWrite: true,
      canListHistory: true,
      canOpenChangeRequest: false,
      reason: 'provider-unavailable',
    };
    const storage = new SourceAgentsStorage({ provider });

    await expect(storage.init()).rejects.toThrow('provider-unavailable');
  });
});
