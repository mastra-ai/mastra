import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { defineMastraCodePlugin, SignalProvider } from '../../plugin.js';
import { collectActivePluginTools, loadPluginFromEntry, loadPlugins } from '../loader.js';
import type { PluginRegistry } from '../types.js';
import { cleanupResolvableDirs, makeResolvableDir } from './resolvable-dir.js';

/** Minimal concrete provider — `SignalProvider` only requires an `id`. */
class FixtureSignalProvider extends SignalProvider<'fixture-signals'> {
  readonly id = 'fixture-signals' as const;
  constructor(readonly cwd: string) {
    super();
  }
}

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
  cleanupResolvableDirs();
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

  it('accepts plugins declaring processors and signal providers', async () => {
    // Compile-time half: `sdk check` fails if either field rejects these shapes.
    const inputOnly = defineMastraCodePlugin({
      id: 'acme.input-only',
      processors: [{ id: 'plugin-input', processInputStep: async () => {} }],
    });
    const bothLanes = defineMastraCodePlugin({
      id: 'acme.both-lanes',
      processors: async () => ({
        input: [{ id: 'plugin-input', processInputStep: async () => undefined }],
        output: [{ id: 'plugin-output', processOutputStep: async ({ messageList }) => messageList }],
      }),
      signalProviders: context => [new FixtureSignalProvider(context.cwd)],
    });
    expect(Array.isArray(inputOnly.processors)).toBe(true);
    expect(typeof bothLanes.signalProviders).toBe('function');

    // Runtime half: a plugin carrying both fields still loads.
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(projectRoot, '.mastracode', 'plugins', 'plugin');
    writePlugin(
      path.join(pluginDir, 'src/index.ts'),
      `export default {
        id: 'acme.contributor',
        processors: [{ id: 'plugin-input', processInputStep: async () => {} }],
        signalProviders: () => [],
        tools: { still_works: { tool: { id: 'still_works' } } }
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'acme.contributor': {
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

    expect(loaded[0]).toMatchObject({ id: 'acme.contributor', status: 'active' });
    expect(Object.keys(loaded[0]?.tools ?? {})).toEqual(['still_works']);
  });

  it('resolves processors and signal providers from objects and from sync and async functions', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const objectDir = path.join(tempDir, 'object-plugin');
    const functionDir = path.join(tempDir, 'function-plugin');
    const asyncDir = makeResolvableDir('loader');
    writePlugin(
      path.join(objectDir, 'index.ts'),
      `export default {
        id: 'a.object',
        processors: { input: [{ id: 'obj-in', processInputStep: async () => {} }], output: [{ id: 'obj-out', processOutputStep: async ({ messageList }) => messageList }] }
      };`,
    );
    writePlugin(
      path.join(functionDir, 'index.ts'),
      // Bare array shorthand, resolved from a sync function.
      `export default {
        id: 'b.function',
        processors: () => [{ id: 'fn-in', processInputStep: async () => {} }]
      };`,
    );
    writePlugin(
      path.join(asyncDir, 'index.ts'),
      `import { SignalProvider } from '@mastra/core/signals';
      class AsyncProvider extends SignalProvider {
        id = 'async-signals';
      }
      export default {
        id: 'c.async',
        signalProviders: async () => [new AsyncProvider()]
      };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.object': { enabled: true, source: 'local', specifier: 'o', path: objectDir, entry: 'index.ts' },
          'b.function': { enabled: true, source: 'local', specifier: 'f', path: functionDir, entry: 'index.ts' },
          'c.async': { enabled: true, source: 'local', specifier: 'a', path: asyncDir, entry: 'index.ts' },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => plugin.status)).toEqual(['active', 'active', 'active']);
    expect(loaded[0]?.processors?.input.map(processor => processor.id)).toEqual(['obj-in']);
    expect(loaded[0]?.processors?.output.map(processor => processor.id)).toEqual(['obj-out']);
    // Bare array is input-lane shorthand.
    expect(loaded[1]?.processors).toEqual({ input: [expect.objectContaining({ id: 'fn-in' })], output: [] });
    expect(loaded[2]?.signalProviders?.map(provider => provider.id)).toEqual(['async-signals']);
  });

  it('fails the whole plugin record when processors or signal providers are the wrong shape', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const badProcessorsDir = path.join(tempDir, 'bad-processors');
    const badReturnDir = path.join(tempDir, 'bad-return');
    const notAProviderDir = path.join(tempDir, 'not-a-provider');
    const throwingDir = path.join(tempDir, 'throwing');
    writePlugin(path.join(badProcessorsDir, 'index.ts'), `export default { id: 'a.bad', processors: 'nope' };`);
    writePlugin(path.join(badReturnDir, 'index.ts'), `export default { id: 'b.bad', signalProviders: () => 'nope' };`);
    writePlugin(
      path.join(notAProviderDir, 'index.ts'),
      `export default { id: 'c.bad', signalProviders: [{ id: 'imposter' }] };`,
    );
    // A plugin that wants its provider treated as required says so by throwing.
    writePlugin(
      path.join(throwingDir, 'index.ts'),
      `export default { id: 'd.bad', signalProviders: () => { throw new Error('needs a token'); } };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.bad': { enabled: true, source: 'local', specifier: 'a', path: badProcessorsDir, entry: 'index.ts' },
          'b.bad': { enabled: true, source: 'local', specifier: 'b', path: badReturnDir, entry: 'index.ts' },
          'c.bad': { enabled: true, source: 'local', specifier: 'c', path: notAProviderDir, entry: 'index.ts' },
          'd.bad': { enabled: true, source: 'local', specifier: 'd', path: throwingDir, entry: 'index.ts' },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => plugin.status)).toEqual(['load failed', 'load failed', 'load failed', 'load failed']);
    expect(loaded[0]?.error).toBe('Plugin processors must be an array, object, or function');
    expect(loaded[1]?.error).toBe('Plugin signal providers function must return an array');
    expect(loaded[2]?.error).toBe(
      'Plugin signal provider at index 0 must be a SignalProvider (an object with an id that implements connect, startPolling, stop and __registerMastra)',
    );
    expect(loaded[3]?.error).toBe('needs a token');
  });

  it('accepts a provider from a plugin that carries its own copy of the signals class', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const pluginDir = path.join(tempDir, 'foreign-provider');
    // A plugin depending on a published provider package (the motivating case: a plugin wrapping
    // `@mastra/github-signals`) gets that package's own `@mastra/core`, so its provider is not an
    // instance of the class Mastra Code loaded. Nothing in the lifecycle needs class identity.
    writePlugin(
      path.join(pluginDir, 'index.ts'),
      `class ForeignSignalProvider {
         id = 'foreign-signals';
         connect() {}
         startPolling() {}
         stopPolling() {}
         stop() {}
         __registerMastra() {}
       }
       export default { id: 'a.foreign', signalProviders: () => [new ForeignSignalProvider()] };`,
    );

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.foreign': { enabled: true, source: 'local', specifier: 'a', path: pluginDir, entry: 'index.ts' },
        },
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded[0]?.status).toBe('active');
    expect(loaded[0]?.signalProviders?.map(provider => provider.id)).toEqual(['foreign-signals']);
  });

  it('contributes no processors or signal providers from inactive or blocked plugins', async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-plugin-loader-'));
    const projectRoot = path.join(tempDir, 'project');
    const disabledDir = path.join(tempDir, 'disabled');
    const blockedDir = path.join(tempDir, 'blocked');
    const source = (id: string) =>
      `export default { id: '${id}', processors: [{ id: '${id}-in', processInputStep: async () => {} }] };`;
    writePlugin(path.join(disabledDir, 'index.ts'), source('a.disabled'));
    writePlugin(path.join(blockedDir, 'index.ts'), source('b.blocked'));

    const loaded = await loadPlugins({
      projectRoot,
      homeDir: path.join(tempDir, 'home'),
      projectRegistry: {
        plugins: {
          'a.disabled': { enabled: false, source: 'local', specifier: 'a', path: disabledDir, entry: 'index.ts' },
          'b.blocked': { enabled: true, source: 'local', specifier: 'b', path: blockedDir, entry: 'index.ts' },
        },
        disabledPlugins: ['b.blocked'],
      },
      globalRegistry: { plugins: {} },
    });

    expect(loaded.map(plugin => plugin.status)).toEqual(['inactive', 'blocked']);
    expect(loaded.every(plugin => plugin.processors === undefined)).toBe(true);
    expect(loaded.every(plugin => plugin.signalProviders === undefined)).toBe(true);
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
