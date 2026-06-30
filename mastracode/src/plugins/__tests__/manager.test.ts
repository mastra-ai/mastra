import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const execaMock = vi.hoisted(() => vi.fn());

vi.mock('execa', () => ({ execa: execaMock }));

import { PluginManager } from '../manager.js';
import { loadPluginRegistry } from '../registry.js';

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
    expect(execaMock).toHaveBeenCalledWith('git', ['fetch', 'origin'], { cwd: checkoutDir });
    expect(execaMock).toHaveBeenCalledWith('git', ['reset', '--hard', 'origin/main'], { cwd: checkoutDir });
  });

  it('backs up divergent GitHub plugin checkouts before forcing them to origin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
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
    expect(execaMock).toHaveBeenCalledWith('git', ['reset', '--hard', 'origin/main'], { cwd: checkoutDir });
    expect(manager.getPluginTools().github_tool?.description).toBe('second');
  });

  it('commits dirty GitHub plugin checkout changes on the backup branch before reset', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePlugin(checkoutDir, 'acme.github', 'github_tool', 'first');
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
      'rev-parse',
    ]);
    expect(execaMock.mock.calls.find(call => call[1][0] === 'switch')?.[1][2]).toMatch(
      /^mastracode\/plugin-backup\/.*-abc12345$/,
    );
    expect(execaMock).toHaveBeenCalledWith('git', ['switch', 'main'], { cwd: checkoutDir });
    expect(execaMock).toHaveBeenCalledWith('git', ['reset', '--hard', 'origin/main'], { cwd: checkoutDir });
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
