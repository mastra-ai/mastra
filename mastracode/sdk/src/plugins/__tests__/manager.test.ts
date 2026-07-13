import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

import { PluginManager } from '../manager.js';
import { findMastraCodePackageRoot } from '../package-link.js';
import { loadPluginRegistry } from '../registry.js';

const mastracodePackageRoot = findMastraCodePackageRoot(path.dirname(fileURLToPath(import.meta.url)));

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writePlugin(pluginDir: string, id: string, toolName: string, description = 'tool'): void {
  fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
  fs.writeFileSync(
    path.join(pluginDir, 'src/index.ts'),
    `export default { id: '${id}', name: '${id}', tools: { ${toolName}: { tool: { id: '${toolName}', description: '${description}' } } } };`,
  );
}

async function waitUntil(assertion: () => boolean, timeoutMs = 3000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (assertion()) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  expect(assertion()).toBe(true);
}

describe('PluginManager', () => {
  it('installs, lists, disables, enables, and uninstalls local plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(pluginDir, 'acme.manager', 'manager_tool');
    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();

    await expect(manager.installLocal(pluginDir, 'project')).resolves.toBe('acme.manager');
    expect(await manager.listPlugins()).toMatchObject([
      { id: 'acme.manager', scope: 'project', status: 'active', toolNames: ['manager_tool'] },
    ]);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual(['manager_tool']);

    await manager.setEnabled('acme.manager', 'project', false);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual([]);
    expect((await manager.listPlugins())[0]?.status).toBe('inactive');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.manager']?.enabled,
    ).toBe(false);

    await manager.setEnabled('acme.manager', 'project', true);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools)).toEqual(['manager_tool']);
    expect((await manager.listPlugins())[0]?.status).toBe('active');

    await manager.uninstall('acme.manager', 'project');
    expect(await manager.listPlugins()).toEqual([]);
    expect(fs.existsSync(pluginDir)).toBe(true);
  });

  it('persists plugin config values and reloads plugin context', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.config',
        config: { answerModel: { type: 'model', default: 'default-model' } },
        tools: context => ({ config_tool: { tool: { id: 'config_tool', description: context.config.answerModel } } })
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'project');
    expect(manager.getPluginTools().config_tool?.description).toBe('default-model');

    await manager.setConfigValue('acme.config', 'project', 'answerModel', 'chosen-model');

    expect(manager.getPluginTools().config_tool?.description).toBe('chosen-model');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.config']?.config,
    ).toEqual({ answerModel: 'chosen-model' });

    await manager.setConfigValue('acme.config', 'project', 'answerModel', '');

    expect(manager.getPluginTools().config_tool?.description).toBe('default-model');
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.config']?.config,
    ).toBeUndefined();
  });

  it('rejects setConfigValue for callback-typed config keys', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.callback',
        config: {
          authenticate: { type: 'callback', run: async () => ({ config: { connected: true } }) },
          connected: { type: 'boolean' }
        },
        tools: {}
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'project');

    await expect(manager.setConfigValue('acme.callback', 'project', 'authenticate', 'anything')).rejects.toThrow(
      /callback/i,
    );
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.callback']?.config,
    ).toBeUndefined();

    // Value-typed keys still write normally.
    await manager.setConfigValue('acme.callback', 'project', 'connected', true);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.callback']?.config,
    ).toEqual({ connected: true });
  });

  it('applies a multi-key config patch with one reload via setConfigValues', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.batch',
        config: {
          authenticate: { type: 'callback', run: async () => undefined },
          connected: { type: 'boolean' },
          label: { type: 'string' }
        },
        tools: {
          gated_tool: {
            tool: { id: 'gated_tool', description: 'needs connection' },
            isEnabled: ctx => ctx.config.connected === true
          }
        }
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();

    await manager.installLocal(pluginDir, 'project');
    await manager.setConfigValue('acme.batch', 'project', 'label', 'old');
    expect(Object.keys(pluginTools)).toEqual([]);

    // Set + clear in one call, one registry write, one reload.
    const reloadSpy = vi.spyOn(manager, 'reload');
    await manager.setConfigValues('acme.batch', 'project', { connected: true, label: undefined });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.batch']?.config,
    ).toEqual({ connected: true });
    // The single reload re-gated tools.
    expect(Object.keys(pluginTools)).toEqual(['gated_tool']);
    reloadSpy.mockRestore();

    // Callback-typed keys are rejected before any write.
    await expect(
      manager.setConfigValues('acme.batch', 'project', { authenticate: 'x', connected: false }),
    ).rejects.toThrow(/callback/i);
    expect(
      loadPluginRegistry(path.join(projectRoot, '.mastracode/plugins/plugins.json')).plugins['acme.batch']?.config,
    ).toEqual({ connected: true });
  });

  it('re-gates tools after setConfigValue reloads the plugin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.gated',
        config: { connected: { type: 'boolean', isEnabled: () => false } },
        tools: {
          status_tool: { tool: { id: 'status_tool', description: 'always on' } },
          gated_tool: {
            tool: { id: 'gated_tool', description: 'needs connection' },
            isEnabled: ctx => ctx.config.connected === true
          }
        }
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();

    await manager.installLocal(pluginDir, 'project');
    expect(Object.keys(pluginTools)).toEqual(['status_tool']);
    expect((await manager.listPlugins())[0]?.toolNames).toEqual(['status_tool']);

    await manager.setConfigValue('acme.gated', 'project', 'connected', true);
    expect(manager.getPluginTools()).toBe(pluginTools);
    expect(Object.keys(pluginTools).sort()).toEqual(['gated_tool', 'status_tool']);
    expect((await manager.listPlugins())[0]?.toolNames).toEqual(['gated_tool', 'status_tool']);

    await manager.setConfigValue('acme.gated', 'project', 'connected', undefined);
    expect(Object.keys(pluginTools)).toEqual(['status_tool']);
    expect((await manager.listPlugins())[0]?.toolNames).toEqual(['status_tool']);
  });

  it('re-runs init on reload and exposes fresh init state via getPluginInitStates', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `const g = globalThis;
      export default {
        id: 'acme.initstate',
        config: { mode: { type: 'string', default: 'off' } },
        init: context => ({ mode: context.config.mode, run: (g.__mcInitRuns = (g.__mcInitRuns ?? 0) + 1) }),
        tools: { state_tool: { tool: { id: 'state_tool', description: 'state' } } }
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'project');
    const first = manager.getPluginInitStates()['acme.initstate'] as { mode: string; run: number };
    expect(first.mode).toBe('off');

    await manager.setConfigValue('acme.initstate', 'project', 'mode', 'on');
    const second = manager.getPluginInitStates()['acme.initstate'] as { mode: string; run: number };
    expect(second.mode).toBe('on');
    // init re-ran on reload — a fresh state object, not the cached first result.
    expect(second.run).toBeGreaterThan(first.run);
  });

  it('hot reloads local plugin source changes into the stable tools object', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(pluginDir, 'acme.hot', 'hot_tool', 'first');
    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();

    await manager.installLocal(pluginDir, 'project');
    expect(pluginTools.hot_tool?.description).toBe('first');

    await new Promise(resolve => setTimeout(resolve, 20));
    writePlugin(pluginDir, 'acme.hot', 'hot_tool', 'second');

    await waitUntil(() => pluginTools.hot_tool?.description === 'second');
    expect(manager.getPluginTools()).toBe(pluginTools);
  });

  it('does not expose tools for plugins blocked by project config', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(pluginDir, 'alexandria', 'mastra_expert');
    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'global');
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({ plugins: {}, disabledPlugins: ['alexandria'] }),
    );

    await manager.reload();

    expect(await manager.listPlugins()).toMatchObject([{ id: 'alexandria', scope: 'global', status: 'blocked' }]);
    expect(Object.keys(manager.getPluginTools())).toEqual([]);
  });

  it('polls GitHub plugin checkouts and reloads changed tools', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (_cmd: string, args: string[], options: { cwd?: string } = {}) => {
      expect(options.cwd).toBe(checkoutDir);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return {
          stdout:
            execaMock.mock.calls.filter(call => call[1][0] === 'rev-parse' && call[1][1] === 'HEAD').length === 1
              ? 'old'
              : 'new',
        };
      }
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '0\t1' };
      if (args[0] === 'status') return { stdout: '' };
      if (args[0] === 'reset') {
        writePlugin(checkoutDir, 'acme.github', 'github_tool', 'second');
      }
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    const pluginTools = manager.getPluginTools();
    await manager.reload();
    expect(pluginTools.github_tool?.description).toBe('first');

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    expect(pluginTools.github_tool?.description).toBe('second');
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['fetch', 'origin'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['reset', '--hard', 'origin/main'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenCalledWith(
      'pnpm',
      ['install', '--ignore-workspace', '--pm-on-fail=ignore', '--ignore-scripts'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(fs.realpathSync(path.join(checkoutDir, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
  });

  it('installs dependencies for nested GitHub entry package roots during updates', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-alexandria');
    const nestedPluginDir = path.join(checkoutDir, '.mastracode/plugins/sources/local/alexandria');
    writePlugin(nestedPluginDir, 'alexandria', 'github_tool', 'first');
    fs.writeFileSync(path.join(nestedPluginDir, 'package.json'), JSON.stringify({ name: 'alexandria' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          alexandria: {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/alexandria',
            path: 'sources/github/acme-alexandria',
            entry: '.mastracode/plugins/sources/local/alexandria/src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (cmd: string, args: string[], options: { cwd?: string } = {}) => {
      if (cmd === 'npm') {
        expect(options.cwd).toBe(nestedPluginDir);
        return { stdout: '' };
      }
      expect(options.cwd).toBe(checkoutDir);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return {
          stdout:
            execaMock.mock.calls.filter(call => call[1][0] === 'rev-parse' && call[1][1] === 'HEAD').length === 1
              ? 'old'
              : 'new',
        };
      }
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '0\t1' };
      if (args[0] === 'status') return { stdout: '' };
      if (args[0] === 'reset') writePlugin(nestedPluginDir, 'alexandria', 'github_tool', 'second');
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();
    expect(manager.getPluginTools().github_tool?.description).toBe('first');

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    expect(manager.getPluginTools().github_tool?.description).toBe('second');
    expect(execaMock).toHaveBeenCalledWith(
      'npm',
      ['install', '--ignore-scripts'],
      expect.objectContaining({ cwd: nestedPluginDir }),
    );
    expect(fs.realpathSync(path.join(nestedPluginDir, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
  });

  it('does not install dependencies for unchanged GitHub plugin checkouts', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (_cmd: string, args: string[], options: { cwd?: string } = {}) => {
      expect(options.cwd).toBe(checkoutDir);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { stdout: 'same' };
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '0\t0' };
      if (args[0] === 'status') return { stdout: '' };
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(false);

    expect(execaMock.mock.calls.some(call => call[0] === 'pnpm')).toBe(false);
  });

  it('backs up divergent GitHub plugin checkouts before forcing them to origin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (_cmd: string, args: string[], options: { cwd?: string } = {}) => {
      expect(options.cwd).toBe(checkoutDir);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return { stdout: 'abc1234567890' };
      }
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '1\t1' };
      if (args[0] === 'status') return { stdout: '' };
      if (args[0] === 'reset') {
        writePlugin(checkoutDir, 'acme.github', 'github_tool', 'second');
        return { stdout: '' };
      }
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    const branchCall = execaMock.mock.calls.find(call => call[1][0] === 'branch');
    expect(branchCall?.[1][1]).toMatch(/^mastracode\/plugin-backup\/.*-abc12345$/);
    expect(branchCall?.[1][2]).toBe('HEAD');
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['reset', '--hard', 'origin/main'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(manager.getPluginTools().github_tool?.description).toBe('second');
  });

  it('commits dirty GitHub plugin checkout changes on the backup branch before reset', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (_cmd: string, args: string[], options: { cwd?: string } = {}) => {
      expect(options.cwd).toBe(checkoutDir);
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { stdout: 'abc1234567890' };
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '0\t1' };
      if (args[0] === 'status') return { stdout: ' M src/index.ts' };
      if (args[0] === 'branch') return { stdout: 'main' };
      if (args[0] === 'diff') throw new Error('staged changes');
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    expect(execaMock.mock.calls.map(call => call[1][0])).toEqual([
      'rev-parse',
      'fetch',
      'rev-parse',
      'rev-list',
      'status',
      'branch',
      'switch',
      'add',
      'diff',
      '-c',
      'switch',
      'reset',
      'install',
      'rev-parse',
    ]);
    expect(execaMock.mock.calls.find(call => call[1][0] === 'switch')?.[1][2]).toMatch(
      /^mastracode\/plugin-backup\/.*-abc12345$/,
    );
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['switch', 'main'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['reset', '--hard', 'origin/main'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
  });

  it('rejects update polling without reloading when dependency installation fails', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    const installError = new Error('dependency install failed');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0' }));
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );
    execaMock.mockImplementation(async (cmd: string, args: string[], options: { cwd?: string } = {}) => {
      expect(options.cwd).toBe(checkoutDir);
      if (cmd === 'pnpm') throw installError;
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { stdout: 'old' };
      if (args[0] === 'rev-parse') return { stdout: 'origin/main' };
      if (args[0] === 'rev-list') return { stdout: '0\t1' };
      if (args[0] === 'status') return { stdout: '' };
      if (args[0] === 'reset' && args[2] === 'origin/main')
        writePlugin(checkoutDir, 'acme.github', 'github_tool', 'second');
      if (args[0] === 'reset' && args[2] === 'old') writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();
    expect(manager.getPluginTools().github_tool?.description).toBe('first');

    await expect(manager.pollGithubSourcesForUpdates()).rejects.toThrow(installError);

    expect(manager.getPluginTools().github_tool?.description).toBe('first');
    expect(execaMock).toHaveBeenCalledWith(
      'git',
      ['reset', '--hard', 'old'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
  });

  it('removes GitHub checkout directories when uninstalling GitHub plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool');
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.github': {
            enabled: true,
            source: 'github',
            specifier: 'https://github.com/acme/plugin',
            path: 'sources/github/acme-plugin',
            entry: 'src/index.ts',
          },
        },
      }),
    );

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.uninstall('acme.github', 'project');

    expect(fs.existsSync(checkoutDir)).toBe(false);
  });
});
