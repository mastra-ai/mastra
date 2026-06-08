import { describe, expect, it, vi } from 'vitest';
import type {
  SourceFile,
  SourceFileHistoryEntry,
  SourceFileHistoryInput,
  SourceFileListEntry,
  SourceFileListInput,
  SourceFileRef,
  SourceControlCapabilities,
  SourceControlProvider,
  SourceWriteFileInput,
  SourceWriteResult,
} from '../../source-control';
import { getSourceAgentFilePath } from '../../source-control';
import { SourceAgentsSourceControl } from './source';

class MockSourceProvider implements SourceControlProvider {
  id = 'mock-source';
  displayName = 'Mock Source';

  files = new Map<string, string>();
  refs = new Map<string, Map<string, string>>();
  writes: SourceWriteFileInput[] = [];
  history: SourceFileHistoryEntry[] = [];
  capabilities: SourceControlCapabilities = {
    canRead: true,
    canWrite: true,
    canListHistory: true,
    canOpenChangeRequest: false,
  };

  async getCapabilities(): Promise<SourceControlCapabilities> {
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

describe('SourceAgentsSourceControl', () => {
  it('persists code-source snapshots through the source provider using canonical paths', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsSourceControl({ provider });
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
    const storage = new SourceAgentsSourceControl({ provider });
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
    const storage = new SourceAgentsSourceControl({ provider });

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
    const storage = new SourceAgentsSourceControl({ provider });
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
    const storage = new SourceAgentsSourceControl({ provider });

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
      JSON.stringify({ name: 'Studio Only', instructions: 'Persisted in source control.', model }),
    );
    const storage = new SourceAgentsSourceControl({ provider });

    await storage.init();
    const list = await storage.listResolved();

    expect(list.agents).toHaveLength(1);
    expect(list.agents[0]).toMatchObject({
      id: 'studio only',
      name: 'Studio Only',
      instructions: 'Persisted in source control.',
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
    const storage = new SourceAgentsSourceControl({ provider });

    const versions = await storage.listVersions({
      agentId: 'weather-agent',
      orderBy: { field: 'versionNumber', direction: 'ASC' },
    });

    expect(versions.versions).toHaveLength(2);
    expect(versions.versions.map(version => version.changeMessage)).toEqual(['First save', 'Second save']);
    expect(versions.versions.map(version => version.instructions)).toEqual(['First', 'Second']);
  });

  it('rejects writes when the source provider cannot write without mutating memory', async () => {
    const provider = new MockSourceProvider();
    provider.capabilities = {
      canRead: true,
      canWrite: false,
      canListHistory: true,
      canOpenChangeRequest: false,
      reason: 'missing-permissions',
    };
    const storage = new SourceAgentsSourceControl({ provider });

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
    await expect(storage.getById('weather-agent')).resolves.toBeNull();
  });

  it('reads and writes through an activated provider ref', async () => {
    const provider = new MockSourceProvider();
    provider.files.set(getSourceAgentFilePath('weather-agent'), JSON.stringify({ instructions: 'From main' }));
    const draft = new Map<string, string>();
    draft.set(getSourceAgentFilePath('weather-agent'), JSON.stringify({ instructions: 'From proposal' }));
    provider.refs.set('mastra/weather-agent', draft);
    const storage = new SourceAgentsSourceControl({ provider });

    await expect(storage.getByIdResolved('weather-agent')).resolves.toMatchObject({ instructions: 'From main' });

    await storage.useProviderRef('weather-agent', 'mastra/weather-agent');

    await expect(storage.getByIdResolved('weather-agent')).resolves.toMatchObject({ instructions: 'From proposal' });

    await storage.createVersion({
      id: 'version-2',
      agentId: 'weather-agent',
      versionNumber: 2,
      name: 'Weather Agent',
      instructions: 'Updated proposal',
      model,
      changedFields: ['instructions'],
    });

    expect(provider.writes.at(-1)?.ref).toBe('mastra/weather-agent');
  });

  it('does not create an in-memory version when source persistence fails', async () => {
    const provider = new MockSourceProvider();
    const storage = new SourceAgentsSourceControl({ provider });
    await storage.create({
      agent: {
        id: 'weather-agent',
        name: 'Weather Agent',
        instructions: 'Use weather data.',
        model,
      },
    });

    provider.writeFile = vi.fn().mockRejectedValue(new Error('provider-write-failed'));

    await expect(
      storage.createVersion({
        id: 'version-2',
        agentId: 'weather-agent',
        versionNumber: 2,
        name: 'Weather Agent',
        instructions: 'Updated instructions',
        model,
        changedFields: ['instructions'],
      }),
    ).rejects.toThrow('provider-write-failed');
    await expect(storage.getVersion('version-2')).resolves.toBeNull();
  });

  it('retries provider discovery after transient failures', async () => {
    const provider = new MockSourceProvider();
    provider.files.set(
      getSourceAgentFilePath('retry-agent'),
      JSON.stringify({ name: 'Retry Agent', instructions: 'Loaded after retry.' }),
    );
    const listFiles = vi
      .spyOn(provider, 'listFiles')
      .mockRejectedValueOnce(new Error('temporary-list-failure'))
      .mockImplementation(input => MockSourceProvider.prototype.listFiles.call(provider, input));
    const storage = new SourceAgentsSourceControl({ provider });

    await expect(storage.listResolved()).rejects.toThrow('temporary-list-failure');
    const list = await storage.listResolved();

    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(list.agents[0]).toMatchObject({ id: 'retry-agent', instructions: 'Loaded after retry.' });
  });

  it('retries provider hydration after transient failures', async () => {
    const provider = new MockSourceProvider();
    provider.files.set(getSourceAgentFilePath('retry-agent'), JSON.stringify({ instructions: 'Loaded after retry.' }));
    const readFile = vi
      .spyOn(provider, 'readFile')
      .mockRejectedValueOnce(new Error('temporary-read-failure'))
      .mockImplementation(input => MockSourceProvider.prototype.readFile.call(provider, input));
    const storage = new SourceAgentsSourceControl({ provider });

    await expect(storage.getByIdResolved('retry-agent')).rejects.toThrow('temporary-read-failure');
    const agent = await storage.getByIdResolved('retry-agent');

    expect(readFile).toHaveBeenCalledTimes(2);
    expect(agent).toMatchObject({ id: 'retry-agent', instructions: 'Loaded after retry.' });
  });

  it('retries provider history loading after transient failures', async () => {
    const provider = new MockSourceProvider();
    const ref = new Map<string, string>();
    ref.set(getSourceAgentFilePath('weather-agent'), JSON.stringify({ instructions: 'From history' }));
    provider.refs.set('sha-1', ref);
    provider.history = [{ id: 'sha-1', ref: 'sha-1', message: 'History save', createdAt: '2026-06-01T01:00:00.000Z' }];
    const listFileHistory = vi
      .spyOn(provider, 'listFileHistory')
      .mockRejectedValueOnce(new Error('temporary-history-failure'))
      .mockImplementation(input => MockSourceProvider.prototype.listFileHistory.call(provider, input));
    const storage = new SourceAgentsSourceControl({ provider });

    await expect(storage.listVersions({ agentId: 'weather-agent' })).rejects.toThrow('temporary-history-failure');
    const versions = await storage.listVersions({ agentId: 'weather-agent' });

    expect(listFileHistory).toHaveBeenCalledTimes(2);
    expect(versions.versions).toHaveLength(1);
    expect(versions.versions[0]).toMatchObject({ instructions: 'From history' });
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
    const storage = new SourceAgentsSourceControl({ provider });

    await expect(storage.init()).rejects.toThrow('provider-unavailable');
  });
});
