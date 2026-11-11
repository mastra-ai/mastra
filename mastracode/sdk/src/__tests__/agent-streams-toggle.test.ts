import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMastraCode } from '../index.js';
import { registerSessionAndWaitForMaintenance } from '../utils/maintenance-lock.js';
import { createStorage } from '../utils/storage-factory.js';

vi.mock('../utils/maintenance-lock.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils/maintenance-lock.js')>();
  return { ...actual, registerSessionAndWaitForMaintenance: vi.fn(actual.registerSessionAndWaitForMaintenance) };
});

vi.mock('../utils/storage-factory.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../utils/storage-factory.js')>();
  return { ...actual, createStorage: vi.fn(actual.createStorage) };
});

vi.setConfig({ testTimeout: 60_000 });

const directories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

async function codeAgent() {
  const directory = mkdtempSync(path.join(tmpdir(), 'mastracode-agent-streams-'));
  directories.push(directory);
  const code = await createMastraCode({
    cwd: directory,
    homeDir: directory,
    configDir: '.mastracode-test',
    settingsPath: path.join(directory, 'settings.json'),
    storage: new LibSQLStore({ id: 'agent-streams', url: `file:${path.join(directory, 'mastra.db')}` }),
    storageBackend: 'libsql',
    disableMcp: true,
    disableHooks: true,
    disableEnvFile: true,
    disablePlugins: true,
    disableGithubSignals: true,
    createInitialThread: false,
  });
  return code.controller.getMastra()!.getAgentById('code-agent');
}

describe('MASTRACODE_AGENT_STREAMS', () => {
  it('publishes code agent runs on a resumable stream by default', async () => {
    const agent = await codeAgent();
    expect(agent.__getStreamBus()).toBeDefined();
  });

  it('stops publishing code agent runs when set to off', async () => {
    vi.stubEnv('MASTRACODE_AGENT_STREAMS', 'off');
    const agent = await codeAgent();
    expect(agent.durable).toBe(false);
    expect(agent.__getStreamBus()).toBeUndefined();
  });

  it('rejects unknown values at startup', async () => {
    vi.stubEnv('MASTRACODE_AGENT_STREAMS', 'false');
    await expect(codeAgent()).rejects.toThrow('Invalid MASTRACODE_AGENT_STREAMS value "false"');
  });

  it('rejects an empty value at startup', async () => {
    vi.stubEnv('MASTRACODE_AGENT_STREAMS', '');
    await expect(codeAgent()).rejects.toThrow('Invalid MASTRACODE_AGENT_STREAMS value ""');
  });

  it('rejects a bad value from .env before registering a session or opening storage', async () => {
    vi.stubEnv('MASTRACODE_AGENT_STREAMS', undefined);
    const directory = mkdtempSync(path.join(tmpdir(), 'mastracode-agent-streams-'));
    directories.push(directory);
    writeFileSync(path.join(directory, '.env'), 'MASTRACODE_AGENT_STREAMS=\n');

    await expect(
      createMastraCode({
        cwd: directory,
        homeDir: directory,
        configDir: '.mastracode-test',
        settingsPath: path.join(directory, 'settings.json'),
        storage: { backend: 'libsql', url: `file:${path.join(directory, 'mastra.db')}` },
        disableMcp: true,
        disableHooks: true,
        disablePlugins: true,
        disableGithubSignals: true,
        createInitialThread: false,
      }),
    ).rejects.toThrow('Invalid MASTRACODE_AGENT_STREAMS value ""');
    expect(registerSessionAndWaitForMaintenance).not.toHaveBeenCalled();
    expect(createStorage).not.toHaveBeenCalled();
  });
});
