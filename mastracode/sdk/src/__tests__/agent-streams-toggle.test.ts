import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LibSQLStore } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMastraCode } from '../index.js';

vi.setConfig({ testTimeout: 60_000 });

const directories: string[] = [];

afterEach(() => {
  vi.unstubAllEnvs();
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
});
