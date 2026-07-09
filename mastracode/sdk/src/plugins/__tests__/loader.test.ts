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
            isEnabled: ctx => ctx.config.connected !== true,
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
      expect(authenticate.isEnabled?.({ config: { connected: true } })).toBe(false);
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

  it('gates tools on isEnabled(context) at tool resolution', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.gated',
        config: {
          connected: { type: 'boolean', isEnabled: () => false }
        },
        tools: {
          ungated_tool: { tool: { id: 'ungated_tool', description: 'always on' } },
          gated_tool: {
            tool: { id: 'gated_tool', description: 'needs connection' },
            render: { type: 'subagent', agentType: 'gated' },
            isEnabled: ctx => ctx.config.connected === true
          }
        }
      };`,
    );

    const record = {
      enabled: true,
      source: 'local',
      specifier: '../plugin',
      path: pluginDir,
      entry: 'src/index.ts',
    } as const;

    const disconnected = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: { plugins: { 'acme.gated': { ...record } } },
      globalRegistry: { plugins: {} },
    });

    expect(disconnected[0]).toMatchObject({ id: 'acme.gated', status: 'active' });
    expect(disconnected[0]?.toolNames).toEqual(['ungated_tool']);
    expect(Object.keys(disconnected[0]?.tools ?? {})).toEqual(['ungated_tool']);
    expect(disconnected[0]?.renderConfigs?.gated_tool).toBeUndefined();
    expect(Object.keys(collectActivePluginTools(disconnected))).toEqual(['ungated_tool']);

    const connected = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: { plugins: { 'acme.gated': { ...record, config: { connected: true } } } },
      globalRegistry: { plugins: {} },
    });

    expect(connected[0]?.toolNames).toEqual(['gated_tool', 'ungated_tool']);
    expect(connected[0]?.renderConfigs?.gated_tool).toEqual({ type: 'subagent', agentType: 'gated' });
    expect(Object.keys(collectActivePluginTools(connected)).sort()).toEqual(['gated_tool', 'ungated_tool']);
  });

  it('fails closed when a tool isEnabled predicate throws without failing the plugin load', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.throwing',
        tools: {
          safe_tool: { tool: { id: 'safe_tool', description: 'safe' } },
          broken_tool: {
            tool: { id: 'broken_tool', description: 'broken predicate' },
            isEnabled: () => { throw new Error('predicate exploded'); }
          }
        }
      };`,
    );

    const stderrWrites: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrWrites.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const loaded = await loadPlugins({
        projectRoot,
        homeDir: path.join(tempDir, 'home'),
        projectRegistry: {
          plugins: {
            'acme.throwing': {
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

      expect(loaded[0]).toMatchObject({ id: 'acme.throwing', status: 'active' });
      expect(loaded[0]?.toolNames).toEqual(['safe_tool']);
      expect(stderrWrites.join('')).toContain('broken_tool');
      expect(stderrWrites.join('')).toContain('predicate exploded');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('keeps config options with an explicit isEnabled: undefined', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.undefined-gate',
        config: {
          value: { type: 'string', default: 'kept', isEnabled: undefined },
          action: { type: 'callback', run: async () => {}, isEnabled: undefined }
        },
        tools: {}
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.undefined-gate': {
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
    expect(plugin).toMatchObject({ id: 'acme.undefined-gate', status: 'active' });
    expect(Object.keys(plugin?.configSchema ?? {}).sort()).toEqual(['action', 'value']);
    expect(plugin?.configValues).toEqual({ value: 'kept' });
  });

  it('fails closed when a tool isEnabled is present but not a function', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.malformed-gate',
        tools: {
          safe_tool: { tool: { id: 'safe_tool', description: 'safe' } },
          explicit_undefined_tool: {
            tool: { id: 'explicit_undefined_tool', description: 'treated as ungated' },
            isEnabled: undefined
          },
          malformed_tool: {
            tool: { id: 'malformed_tool', description: 'non-function gate' },
            isEnabled: false
          }
        }
      };`,
    );

    const stderrWrites: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrWrites.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;

    try {
      const loaded = await loadPlugins({
        projectRoot,
        homeDir: path.join(tempDir, 'home'),
        projectRegistry: {
          plugins: {
            'acme.malformed-gate': {
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

      expect(loaded[0]).toMatchObject({ id: 'acme.malformed-gate', status: 'active' });
      expect(loaded[0]?.toolNames.sort()).toEqual(['explicit_undefined_tool', 'safe_tool']);
      expect(stderrWrites.join('')).toContain('malformed_tool');
      expect(stderrWrites.join('')).toContain('non-function isEnabled');
    } finally {
      process.stderr.write = originalWrite;
    }
  });

  it('runs init with resolved config and stores the returned state on the loaded plugin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.init',
        config: { label: { type: 'string', default: 'from-default' } },
        init: context => ({ label: context.config.label }),
        tools: { init_tool: { tool: { id: 'init_tool', description: 'init' } } }
      };`,
    );

    const record = {
      enabled: true,
      source: 'local',
      specifier: '../plugin',
      path: pluginDir,
      entry: 'src/index.ts',
    } as const;

    const withDefaults = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: { plugins: { 'acme.init': { ...record } } },
      globalRegistry: { plugins: {} },
    });

    expect(withDefaults[0]).toMatchObject({ id: 'acme.init', status: 'active', initState: { label: 'from-default' } });

    const withConfig = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: { plugins: { 'acme.init': { ...record, config: { label: 'configured' } } } },
      globalRegistry: { plugins: {} },
    });

    expect(withConfig[0]?.initState).toEqual({ label: 'configured' });
  });

  it('marks the plugin load failed when init throws', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.initfail',
        init: () => { throw new Error('init exploded'); },
        tools: { unreachable_tool: { tool: { id: 'unreachable_tool', description: 'never' } } }
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.initfail': {
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

    expect(loaded[0]?.status).toBe('load failed');
    expect(loaded[0]?.error).toContain('init exploded');
    expect(loaded[0]?.toolNames).toEqual([]);
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
