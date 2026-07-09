import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { collectActivePluginTools, loadPluginFromEntry, loadPlugins } from '../loader.js';
import type { PluginRegistry } from '../types.js';

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function writePlugin(filePath: string, source: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, source);
}

describe('plugin loader', () => {
  it('loads default exported TypeScript plugins and resolves tools functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const entryPath = path.join(tempDir, 'plugin.ts');
    writePlugin(
      entryPath,
      `export default {
        id: 'acme.loader',
        name: 'Loader Plugin',
        version: '1.0.0',
        tools: context => ({ echo_tool: { tool: { id: 'echo_tool', description: context.cwd } } })
      };`,
    );

    await expect(loadPluginFromEntry(entryPath)).resolves.toMatchObject({ id: 'acme.loader', name: 'Loader Plugin' });
  });

  it('loads enabled registry records and marks disabled records inactive', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export const plugin = {
        id: 'acme.enabled',
        tools: { enabled_tool: { tool: { id: 'enabled_tool', description: 'enabled' } } }
      };`,
    );

    const projectRegistry: PluginRegistry = {
      plugins: {
        'acme.enabled': {
          enabled: true,
          source: 'local',
          specifier: '../plugin',
          path: pluginDir,
          entry: 'src/index.ts',
        },
        'acme.disabled': {
          enabled: false,
          source: 'local',
          specifier: '../disabled',
          path: path.join(projectRoot, '.mastracode', 'plugins', 'disabled'),
          entry: 'src/index.ts',
        },
      },
    };

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry,
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => [plugin.id, plugin.status])).toEqual([
      ['acme.disabled', 'inactive'],
      ['acme.enabled', 'active'],
    ]);
    expect(loaded.find(plugin => plugin.id === 'acme.enabled')?.toolNames).toEqual(['enabled_tool']);
  });

  it('passes configured plugin option values into tools functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.config',
        config: {
          answerModel: { type: 'model', default: 'default-model' },
          enabled: { type: 'boolean', default: true },
          prompt: { type: 'string', default: 'default prompt' }
        },
        tools: context => ({ configured_tool: { tool: { id: 'configured_tool', description: JSON.stringify(context.config) } } })
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.config': {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
            config: { answerModel: 'chosen-model', enabled: false },
          },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]).toMatchObject({
      id: 'acme.config',
      status: 'active',
      configValues: { answerModel: 'chosen-model', enabled: false, prompt: 'default prompt' },
    });
    expect(loaded[0]?.tools.configured_tool?.description).toContain('chosen-model');
  });

  it('accepts callback config options and preserves run/isEnabled functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.callback',
        config: {
          authenticate: {
            type: 'callback',
            label: 'Authenticate',
            description: 'Connect account',
            isEnabled: config => config.connected !== true,
            run: async () => ({ message: 'Connected', config: { connected: true } })
          },
          connected: { type: 'boolean', isEnabled: () => false }
        },
        tools: {}
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.callback': {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
          },
        },
      },
      globalRegistry: { plugins: {} },
    });

    const plugin = loaded[0];
    expect(plugin).toMatchObject({ id: 'acme.callback', status: 'active' });
    const authenticate = plugin?.configSchema?.authenticate;
    expect(authenticate?.type).toBe('callback');
    expect(authenticate?.label).toBe('Authenticate');
    expect(authenticate?.description).toBe('Connect account');
    expect(typeof authenticate?.isEnabled).toBe('function');
    expect(authenticate?.type === 'callback' && typeof authenticate.run).toBe('function');
    expect(plugin?.configSchema?.connected?.type).toBe('boolean');
    expect(typeof plugin?.configSchema?.connected?.isEnabled).toBe('function');
    // Callback options never produce a config value.
    expect(plugin?.configValues).toEqual({ connected: false });
    if (authenticate?.type === 'callback') {
      expect(authenticate.isEnabled?.({ connected: true })).toBe(false);
      await expect(authenticate.run({ config: {} })).resolves.toEqual({
        message: 'Connected',
        config: { connected: true },
      });
    }
  });

  it('drops malformed callback and isEnabled config options without failing the plugin load', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.malformed',
        config: {
          missingRun: { type: 'callback', label: 'No run' },
          nonFunctionRun: { type: 'callback', run: 'not-a-function' },
          callbackWithDefault: { type: 'callback', run: async () => {}, default: 'oops' },
          badIsEnabled: { type: 'string', isEnabled: 'not-a-function' },
          badCallbackIsEnabled: { type: 'callback', run: async () => {}, isEnabled: 42 },
          valid: { type: 'string', default: 'kept' }
        },
        tools: {}
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.malformed': {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
          },
        },
      },
      globalRegistry: { plugins: {} },
    });

    const plugin = loaded[0];
    expect(plugin).toMatchObject({ id: 'acme.malformed', status: 'active' });
    expect(Object.keys(plugin?.configSchema ?? {})).toEqual(['valid']);
    expect(plugin?.configValues).toEqual({ valid: 'kept' });
  });

  it('normalizes first-class tool render entries and discovers bundled assets and instructions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    fs.mkdirSync(path.join(pluginDir, 'skills', 'helper'), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'skills', 'helper', 'SKILL.md'), '# Helper');
    fs.mkdirSync(path.join(pluginDir, 'commands'), { recursive: true });
    fs.writeFileSync(path.join(pluginDir, 'commands', 'ask.md'), 'Ask template');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.assets',
        instructions: context => ` +
        '`Plugin instruction for ${context.cwd}`' +
        `,
        tools: {
          rendered_tool: {
            tool: { id: 'rendered_tool', description: 'rendered' },
            render: { type: 'subagent', agentType: 'assets' }
          }
        }
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.assets': {
            enabled: true,
            source: 'local',
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
          },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]?.renderConfigs?.rendered_tool).toEqual({ type: 'subagent', agentType: 'assets' });
    expect(loaded[0]?.instructions).toBe(`Plugin instruction for ${projectRoot}`);
    expect(loaded[0]?.skillPaths).toEqual([path.join(pluginDir, 'skills')]);
    expect(loaded[0]?.commandPaths).toEqual([path.join(pluginDir, 'commands')]);
  });

  it('surfaces load failures without throwing', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRegistry: PluginRegistry = {
      plugins: {
        broken: {
          enabled: true,
          source: 'local',
          specifier: '../broken',
          path: path.join(tempDir, 'project', '.mastracode', 'plugins', 'broken'),
          entry: 'index.ts',
        },
      },
    };

    const loaded = await loadPlugins({
      projectRoot: path.join(tempDir, 'project'),
      homeDir: path.join(tempDir, 'home'),
      projectRegistry,
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]).toMatchObject({ id: 'broken', status: 'load failed' });
    expect(loaded[0]?.error).toBeTruthy();
  });

  it('marks later duplicate tool names conflicted', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const firstDir = path.join(tempDir, 'first');
    const secondDir = path.join(tempDir, 'second');
    writePlugin(
      path.join(firstDir, 'index.ts'),
      `export default { id: 'a.first', tools: { same: { tool: { id: 'same' } } } };`,
    );
    writePlugin(
      path.join(secondDir, 'index.ts'),
      `export default { id: 'b.second', tools: { same: { tool: { id: 'same' } } } };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.first': { enabled: true, source: 'local', specifier: 'first', path: firstDir, entry: 'index.ts' },
          'b.second': { enabled: true, source: 'local', specifier: 'second', path: secondDir, entry: 'index.ts' },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => [plugin.id, plugin.status])).toEqual([
      ['a.first', 'active'],
      ['b.second', 'conflicted'],
    ]);
    expect(loaded[1]?.conflicts).toEqual(['same']);
    expect(Object.keys(collectActivePluginTools(loaded))).toEqual(['same']);
    expect(collectActivePluginTools(loaded).same).toBe(loaded[0]?.tools.same);
  });
});
