import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('resolves runtime accessors at call time, reporting undefined before the controller exists', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.runtime',
        tools: context => ({
          runtime_tool: {
            tool: {
              id: 'runtime_tool',
              description: [
                context.getController?.()?.id ?? 'no-controller',
                context.getActiveSession?.()?.id ?? 'no-session'
              ].join('|'),
              // A plugin that holds the accessor and calls it later — the shape a
              // signal provider needs, since it runs long after load.
              resolveLater: () => [
                context.getController?.()?.id ?? 'no-controller',
                context.getActiveSession?.()?.id ?? 'no-session'
              ].join('|')
            }
          }
        })
      };`,
    );

    // Mirrors the real ordering: plugins load before the controller and the
    // session exist, and the same accessors later report them.
    let controller: { id: string } | undefined;
    let session: { id: string } | undefined;
    const options = {
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      runtime: {
        getController: () => controller as never,
        getActiveSession: () => session as never,
      },
      projectRegistry: {
        plugins: {
          'acme.runtime': {
            enabled: true,
            source: 'local' as const,
            specifier: '../plugin',
            path: pluginDir,
            entry: 'src/index.ts',
          },
        },
      },
      globalRegistry: { plugins: {} },
    };

    const beforeController = await loadPlugins(options);
    expect(beforeController[0]?.status).toBe('active');
    expect(beforeController[0]?.tools.runtime_tool?.description).toBe('no-controller|no-session');

    controller = { id: 'mastra-code' };
    session = { id: 'session-1' };

    // The accessor the plugin captured at load time now reports the live values,
    // with no reload — this is what makes it lazy rather than a snapshot.
    const capturedAccessor = (beforeController[0]?.tools.runtime_tool as unknown as { resolveLater: () => string })
      .resolveLater;
    expect(capturedAccessor()).toBe('mastra-code|session-1');

    const afterController = await loadPlugins(options);
    expect(afterController[0]?.tools.runtime_tool?.description).toBe('mastra-code|session-1');
  });

  it('does not invoke runtime accessors while loading a plugin', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default { id: 'acme.quiet', tools: { quiet_tool: { tool: { id: 'quiet_tool' } } } };`,
    );

    const getController = vi.fn(() => undefined as never);
    const getActiveSession = vi.fn(() => undefined as never);

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      runtime: { getController, getActiveSession },
      projectRegistry: {
        plugins: {
          'acme.quiet': {
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

    expect(loaded[0]?.status).toBe('active');
    expect(getController).not.toHaveBeenCalled();
    expect(getActiveSession).not.toHaveBeenCalled();
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
