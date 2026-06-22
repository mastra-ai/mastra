import fs from 'node:fs';
import os from 'node:os';
import type * as NodeOs from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockHomeDir = vi.hoisted(() => ({ value: '' }));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof NodeOs>('node:os');
  return {
    ...actual,
    default: {
      ...actual,
      homedir: () => mockHomeDir.value,
    },
    homedir: () => mockHomeDir.value,
  };
});

import { loadHooksConfig } from './config';

let tempDir: string | undefined;

afterEach(() => {
  vi.restoreAllMocks();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  mockHomeDir.value = '';
});

describe('loadHooksConfig', () => {
  it('merges global then project hooks from the configured configDir and includes notification hooks', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-hooks-'));
    const homeDir = path.join(tempDir, 'home');
    const projectDir = path.join(tempDir, 'project');
    mockHomeDir.value = homeDir;

    fs.mkdirSync(path.join(homeDir, '.acme-code'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, '.acme-code'), { recursive: true });
    fs.writeFileSync(
      path.join(homeDir, '.acme-code', 'hooks.json'),
      JSON.stringify({
        PreToolUse: [{ type: 'command', command: 'echo global-pre', description: 'global pre' }],
        Notification: [{ type: 'command', command: 'echo global-notify', description: 'global notify' }],
        Stop: [{ type: 'command' }, { type: 'command', command: 'echo valid-stop' }],
        UnknownEvent: [{ type: 'command', command: 'echo ignored' }],
      }),
    );
    fs.writeFileSync(
      path.join(projectDir, '.acme-code', 'hooks.json'),
      JSON.stringify({
        PreToolUse: [{ type: 'command', command: 'echo project-pre', description: 'project pre' }],
        Notification: [{ type: 'command', command: 'echo project-notify', description: 'project notify' }],
      }),
    );

    const config = loadHooksConfig(projectDir, '.acme-code');

    expect(config.PreToolUse?.map(hook => hook.command)).toEqual(['echo global-pre', 'echo project-pre']);
    expect(config.Notification?.map(hook => hook.command)).toEqual(['echo global-notify', 'echo project-notify']);
    expect(config.Stop?.map(hook => hook.command)).toEqual(['echo valid-stop']);
    expect(config).not.toHaveProperty('UnknownEvent');
  });

  it('returns an empty config when hook files contain invalid JSON', () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-hooks-'));
    const homeDir = path.join(tempDir, 'home');
    const projectDir = path.join(tempDir, 'project');
    mockHomeDir.value = homeDir;

    fs.mkdirSync(path.join(homeDir, '.mastracode'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, '.mastracode'), { recursive: true });
    fs.writeFileSync(path.join(homeDir, '.mastracode', 'hooks.json'), '{invalid');
    fs.writeFileSync(path.join(projectDir, '.mastracode', 'hooks.json'), JSON.stringify({ NotAnEvent: [] }));

    expect(loadHooksConfig(projectDir)).toEqual({});
  });
});
