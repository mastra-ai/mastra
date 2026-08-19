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
import { cleanupResolvableDirs, makeResolvableDir } from './resolvable-dir.js';

const mastracodePackageRoot = findMastraCodePackageRoot(path.dirname(fileURLToPath(import.meta.url)));

let tempDir: string | undefined;

afterEach(() => {
  vi.clearAllMocks();
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  cleanupResolvableDirs();
});

function writePlugin(pluginDir: string, id: string, toolName: string, description = 'tool'): void {
  writePluginSource(path.join(pluginDir, 'src/index.ts'), id, id, toolName, description);
}

function writePluginSource(entryPath: string, id: string, name: string, toolName: string, description = 'tool'): void {
  fs.mkdirSync(path.dirname(entryPath), { recursive: true });
  fs.writeFileSync(
    entryPath,
    `export default { id: '${id}', name: '${name}', tools: { ${toolName}: { tool: { id: '${toolName}', description: '${description}' } } } };`,
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

  it('keeps concurrent public reload requests on one serialized publication lane', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    writePlugin(pluginDir, 'acme.reload-lane', 'reload_lane_tool');
    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.installLocal(pluginDir, 'project');
    let publications = 0;
    manager.onReload(() => {
      publications += 1;
    });

    await Promise.all([manager.reload(), manager.reload(), manager.reload()]);

    expect(publications).toBe(1);
    await manager.dispose();
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

  it('moves the version stamp when config changes, not just when source changes', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.stamp',
        config: { answerModel: { type: 'model', default: 'default-model' } },
        tools: context => ({ stamp_tool: { tool: { id: 'stamp_tool', description: context.config.answerModel } } })
      };`,
    );
    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'project');
    const installed = (await manager.listPlugins())[0]?.versionStamp;
    expect(installed).toBeTruthy();

    // A reload with nothing changed must not move the stamp: consumers that own
    // long-lived instances keep them only while the stamp holds still.
    await manager.reload();
    expect((await manager.listPlugins())[0]?.versionStamp).toBe(installed);

    // Config edits fire a reload without touching a single file, and the plugin
    // is handed different values — so the stamp has to move.
    await manager.setConfigValue('acme.stamp', 'project', 'answerModel', 'chosen-model');
    expect((await manager.listPlugins())[0]?.versionStamp).not.toBe(installed);
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

  it('keeps runtime accessors available to plugin resolvers across reloads', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.runtime',
        tools: context => ({
          runtime_tool: {
            tool: { id: 'runtime_tool', description: context.getController?.()?.id ?? 'no-controller' }
          }
        })
      };`,
    );

    let controller: { id: string } | undefined;
    const manager = new PluginManager({
      projectRoot,
      homeDir,
      runtime: { getController: () => controller as never },
    });

    await manager.installLocal(pluginDir, 'project');
    expect(manager.getPluginTools().runtime_tool?.description).toBe('no-controller');

    controller = { id: 'mastra-code' };
    await manager.reload();

    expect(manager.getPluginTools().runtime_tool?.description).toBe('mastra-code');
  });

  it('publishes runtime accessors to a manager constructed without one', async () => {
    // The injected-manager shape: `MastraCodeConfig.pluginManager` instances are
    // built without runtime accessors, and createMastraCode publishes its own
    // via setRuntime. Without that publish, plugins see undefined accessors.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const pluginDir = path.join(tempDir, 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.injected',
        tools: context => ({
          injected_tool: {
            tool: { id: 'injected_tool', description: context.getController?.()?.id ?? 'no-controller' }
          }
        })
      };`,
    );

    const manager = new PluginManager({ projectRoot, homeDir });

    await manager.installLocal(pluginDir, 'project');
    expect(manager.getPluginTools().injected_tool?.description).toBe('no-controller');

    manager.setRuntime({ getController: () => ({ id: 'mastra-code' }) as never });
    await manager.reload();

    expect(manager.getPluginTools().injected_tool?.description).toBe('mastra-code');
  });

  it('exposes processors and signal providers from active plugins only, tagged with their owner', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const contributorDir = makeResolvableDir('manager');
    const disabledDir = path.join(tempDir, 'disabled');
    const writeContributor = (dir: string, id: string, marker: string, withProvider: boolean) => {
      fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'src/index.ts'),
        `${withProvider ? `import { SignalProvider } from '@mastra/core/signals';\n` : ''}export default {
          id: '${id}',
          processors: {
            input: [{ id: '${marker}-in', processInputStep: async () => {} }],
            output: [{ id: '${marker}-out', processOutputStep: async ({ messageList }) => messageList }]
          },
          ${
            withProvider ? `signalProviders: [new (class extends SignalProvider { id = '${marker}-signals'; })()],` : ''
          }
        };`,
      );
    };
    writeContributor(contributorDir, 'acme.contributor', 'contributor', true);
    writeContributor(disabledDir, 'acme.disabled', 'disabled', false);

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.installLocal(contributorDir, 'project');
    await manager.installLocal(disabledDir, 'project');

    expect(manager.getPluginProcessors().input.map(entry => [entry.pluginId, entry.value.id])).toEqual([
      ['acme.contributor', 'contributor-in'],
      ['acme.disabled', 'disabled-in'],
    ]);
    expect(manager.getPluginProcessors().output.map(entry => entry.value.id)).toEqual([
      'contributor-out',
      'disabled-out',
    ]);
    expect(manager.getPluginSignalProviders().map(entry => [entry.pluginId, entry.value.id])).toEqual([
      ['acme.contributor', 'contributor-signals'],
    ]);

    await manager.setEnabled('acme.disabled', 'project', false);

    expect(manager.getPluginProcessors().input.map(entry => entry.pluginId)).toEqual(['acme.contributor']);
    expect(manager.getPluginProcessors().output.map(entry => entry.pluginId)).toEqual(['acme.contributor']);
    expect(manager.getPluginSignalProviders().map(entry => entry.pluginId)).toEqual(['acme.contributor']);

    // Accessors read the current load, so a reload keeps serving them. Phase 4b
    // is what decides whether the *instances* behind them are kept or cycled.
    await manager.reload();

    expect(manager.getPluginProcessors().input.map(entry => entry.value.id)).toEqual(['contributor-in']);
    expect(manager.getPluginSignalProviders().map(entry => entry.value.id)).toEqual(['contributor-signals']);
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
    const updateListener = vi.fn();
    manager.onGithubPluginsUpdated(updateListener);
    await manager.reload();
    expect(pluginTools.github_tool?.description).toBe('first');
    const stampBeforeUpdate = (await manager.listPlugins())[0]?.versionStamp;

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    expect(pluginTools.github_tool?.description).toBe('second');
    // The stamp for a GitHub plugin is its checkout's HEAD, so taking an update
    // moves it — which is what tells the signal lane to cycle its providers.
    expect((await manager.listPlugins())[0]?.versionStamp).not.toBe(stampBeforeUpdate);
    expect(updateListener).toHaveBeenCalledTimes(1);
    expect(updateListener).toHaveBeenCalledWith(['acme.github']);
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
      'corepack',
      ['pnpm@10.0.0', 'install', '--ignore-workspace', '--ignore-scripts'],
      expect.objectContaining({ cwd: checkoutDir, env: expect.objectContaining({ GIT_TERMINAL_PROMPT: '0' }) }),
    );
    expect(fs.realpathSync(path.join(checkoutDir, 'node_modules', 'mastracode'))).toBe(
      fs.realpathSync(mastracodePackageRoot),
    );
  });

  it('moves the version stamp when a GitHub plugin is installed over its own checkout', async () => {
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
    let head = 'old';
    execaMock.mockImplementation(async (command: string, args: string[]) => {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') return { stdout: head };
      if (command === 'gh' && args[0] === 'repo' && args[1] === 'clone') {
        const destination = args[3];
        if (!destination) throw new Error('missing checkout dir');
        head = 'new';
        writePlugin(destination, 'acme.github', 'github_tool', 'second');
        fs.mkdirSync(path.join(destination, '.git'), { recursive: true });
      }
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    await manager.reload();
    const stampBeforeReinstall = (await manager.listPlugins())[0]?.versionStamp;

    await manager.installGithub('https://github.com/acme/plugin', 'project');

    // Reinstalling replaces the checkout at the same path, so a cached head from
    // the previous install would report a different commit as no change and
    // leave the plugin's signal providers running on the old code.
    expect((await manager.listPlugins())[0]?.versionStamp).not.toBe(stampBeforeReinstall);
  });

  it('reports post-reload display names when an update renames a plugin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-plugin');
    writePluginSource(path.join(checkoutDir, 'src/index.ts'), 'acme.github', 'Acme Old', 'github_tool');
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
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
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
        writePluginSource(path.join(checkoutDir, 'src/index.ts'), 'acme.github', 'Acme New', 'github_tool');
      }
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    const updateListener = vi.fn();
    manager.onGithubPluginsUpdated(updateListener);
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    expect(updateListener).toHaveBeenCalledTimes(1);
    expect(updateListener).toHaveBeenCalledWith(['Acme New']);
  });

  it('reports every plugin sharing an updated checkout', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-suite');
    writePluginSource(path.join(checkoutDir, 'src/one.ts'), 'acme.one', 'acme.one', 'one_tool', 'first');
    writePluginSource(path.join(checkoutDir, 'src/two.ts'), 'acme.two', 'acme.two', 'two_tool', 'first');
    fs.mkdirSync(path.join(checkoutDir, '.git'), { recursive: true });
    fs.mkdirSync(path.join(projectRoot, '.mastracode/plugins'), { recursive: true });
    const sharedSource = {
      enabled: true,
      source: 'github',
      specifier: 'https://github.com/acme/suite',
      path: 'sources/github/acme-suite',
    };
    fs.writeFileSync(
      path.join(projectRoot, '.mastracode/plugins/plugins.json'),
      JSON.stringify({
        plugins: {
          'acme.one': { ...sharedSource, entry: 'src/one.ts' },
          'acme.two': { ...sharedSource, entry: 'src/two.ts' },
        },
      }),
    );
    execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
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
        writePluginSource(path.join(checkoutDir, 'src/one.ts'), 'acme.one', 'acme.one', 'one_tool', 'second');
        writePluginSource(path.join(checkoutDir, 'src/two.ts'), 'acme.two', 'acme.two', 'two_tool', 'second');
      }
      return { stdout: '' };
    });

    const manager = new PluginManager({ projectRoot, homeDir });
    const updateListener = vi.fn();
    manager.onGithubPluginsUpdated(updateListener);
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(true);

    // One checkout fetch despite two plugins, one notification naming both.
    expect(execaMock.mock.calls.filter(call => call[1][0] === 'fetch')).toHaveLength(1);
    expect(updateListener).toHaveBeenCalledTimes(1);
    expect(updateListener).toHaveBeenCalledWith(['acme.one', 'acme.two']);
  });

  it('installs dependencies for nested GitHub entry package roots during updates', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-manager-'));
    const projectRoot = path.join(tempDir, 'project');
    const homeDir = path.join(tempDir, 'home');
    const checkoutDir = path.join(projectRoot, '.mastracode/plugins/sources/github/acme-alexandria');
    const nestedPluginDir = path.join(checkoutDir, '.mastracode/plugins/sources/local/alexandria');
    writePlugin(nestedPluginDir, 'alexandria', 'github_tool', 'first');
    fs.writeFileSync(path.join(checkoutDir, 'package.json'), JSON.stringify({ packageManager: 'pnpm@11.8.0' }));
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
      if (cmd === 'corepack') {
        expect(args[0]).toBe('pnpm@11.8.0');
        expect([checkoutDir, nestedPluginDir]).toContain(options.cwd);
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
      'corepack',
      ['pnpm@11.8.0', 'install', '--ignore-workspace', '--ignore-scripts'],
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
    const updateListener = vi.fn();
    manager.onGithubPluginsUpdated(updateListener);
    await manager.reload();

    await expect(manager.pollGithubSourcesForUpdates()).resolves.toBe(false);

    expect(execaMock.mock.calls.some(call => call[0] === 'corepack' && call[1][0]?.startsWith('pnpm@'))).toBe(false);
    expect(updateListener).not.toHaveBeenCalled();
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

    expect(execaMock.mock.calls.map(call => (call[0] === 'corepack' ? call[1][1] : call[1][0]))).toEqual([
      // Reload stamps the plugin, which reads the checkout's HEAD once and
      // caches it; the poller keeps that cache current from then on.
      'rev-parse',
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
      if (cmd === 'corepack' && args[0] === 'pnpm@10.0.0') throw installError;
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
