import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handlePluginsCommand } from '../plugins.js';

vi.mock('@earendil-works/pi-tui', () => {
  class Box {
    children: any[] = [];
    constructor(..._args: any[]) {}
    addChild(child: any) {
      this.children.push(child);
    }
  }
  class Text {
    constructor(public text: string) {}
  }
  class Spacer {
    constructor(public size: number) {}
  }
  class SelectList {
    onSelect?: (item: any) => void;
    onCancel?: () => void;
    constructor(public items: any[]) {}
  }
  return { Box, Text, Spacer, SelectList };
});

const overlay = vi.hoisted(() => ({ showModalOverlay: vi.fn() }));
vi.mock('../../overlay.js', () => ({ showModalOverlay: overlay.showModalOverlay }));

const modal = vi.hoisted(() => ({ askModalQuestion: vi.fn() }));
vi.mock('../../modal-question.js', () => ({ askModalQuestion: modal.askModalQuestion }));
vi.mock('../../prompt-api-key.js', () => ({ promptForApiKeyIfNeeded: vi.fn(async () => undefined) }));
vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    focused = false;
    constructor(public options: any) {}
  },
}));
vi.mock('../../theme.js', () => ({
  getSelectListTheme: () => ({}),
  theme: {
    bg: (_name: string, text: string) => text,
    fg: (_name: string, text: string) => text,
    bold: (text: string) => text,
  },
}));

describe('handlePluginsCommand', () => {
  beforeEach(() => {
    overlay.showModalOverlay.mockClear();
    modal.askModalQuestion.mockReset();
  });

  it('shows setup guidance when plugin manager is missing', async () => {
    const ctx = { showInfo: vi.fn() } as any;

    await handlePluginsCommand(ctx);

    expect(ctx.showInfo).toHaveBeenCalledWith('Plugin system not initialized.');
  });

  it('opens the plugin list with install item and plugin metadata', async () => {
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => [
        {
          id: 'acme.foo',
          name: 'Foo Tools',
          scope: 'project',
          source: 'local',
          specifier: '../foo',
          enabled: true,
          status: 'active',
          path: '../foo',
          entry: 'src/index.ts',
          tools: {},
          toolNames: ['foo_search'],
        },
      ]),
    };
    const ctx = { pluginManager, state: { ui: { hideOverlay: vi.fn() } } } as any;

    await handlePluginsCommand(ctx);

    expect(pluginManager.reload).toHaveBeenCalledTimes(1);
    expect(overlay.showModalOverlay).toHaveBeenCalledTimes(1);
    const container = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const list = container.children.find((child: any) => Array.isArray(child.items));
    expect(list.items.map((item: any) => item.value)).toEqual(['__install__', 'project:acme.foo']);
    expect(list.items[1].label).toContain('Foo Tools');
    expect(list.items[1].label).toContain('acme.foo');
    expect(list.items[1].label).toContain('project');
    expect(list.items[1].label).toContain('active');
  });

  it('configures plugin string and boolean settings from the detail view', async () => {
    const plugin = {
      id: 'acme.foo',
      name: 'Foo Tools',
      scope: 'project',
      source: 'local',
      specifier: '../foo',
      enabled: true,
      status: 'active',
      path: '../foo',
      entry: 'src/index.ts',
      tools: {},
      toolNames: ['foo_search'],
      configSchema: {
        answerModel: { type: 'model', label: 'Answer model', default: 'default-model' },
        enabled: { type: 'boolean', label: 'Enabled', default: true },
        prompt: { type: 'string', label: 'Prompt', default: 'hello' },
      },
      configValues: { answerModel: 'default-model', enabled: true, prompt: 'hello' },
    };
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => [plugin]),
      setConfigValue: vi.fn(async () => undefined),
    };
    modal.askModalQuestion.mockResolvedValueOnce('Prompt').mockResolvedValueOnce('updated prompt');
    const ctx = {
      pluginManager,
      authStorage: {},
      state: {
        controller: { listAvailableModels: vi.fn(async () => [{ id: 'model-a', name: 'Model A' }]) },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx, ['acme.foo']);
    const detail = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const actions = detail.children.find((child: any) => Array.isArray(child.items));
    expect(actions.items.map((item: any) => item.value)).toContain('configure');
    actions.onSelect({ value: 'configure' });
    await new Promise(resolve => setImmediate(resolve));

    expect(pluginManager.setConfigValue).toHaveBeenCalledWith('acme.foo', 'project', 'prompt', 'updated prompt');
    expect(ctx.showInfo).toHaveBeenCalledWith('Updated plugin setting prompt.');
  });

  it('returns from plugin config selection to plugin detail on escape', async () => {
    const plugin = {
      id: 'acme.foo',
      name: 'Foo Tools',
      scope: 'project',
      source: 'local',
      specifier: '../foo',
      enabled: true,
      status: 'active',
      path: '../foo',
      entry: 'src/index.ts',
      tools: {},
      toolNames: ['foo_search'],
      configSchema: { answerModel: { type: 'model', label: 'Answer model' } },
      configValues: { answerModel: 'openai/broken' },
    };
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => [plugin]),
      setConfigValue: vi.fn(async () => undefined),
    };
    modal.askModalQuestion.mockResolvedValueOnce(null);
    const ctx = {
      pluginManager,
      state: {
        controller: { listAvailableModels: vi.fn(async () => [{ id: 'model-a', name: 'Model A' }]) },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx, ['acme.foo']);
    const detail = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const actions = detail.children.find((child: any) => Array.isArray(child.items));
    actions.onSelect({ value: 'configure' });
    await new Promise(resolve => setImmediate(resolve));

    expect(overlay.showModalOverlay).toHaveBeenCalledTimes(2);
    expect(pluginManager.setConfigValue).not.toHaveBeenCalled();
  });

  it('returns from a nested plugin config value view to config selection on escape', async () => {
    const plugin = {
      id: 'acme.foo',
      name: 'Foo Tools',
      scope: 'project',
      source: 'local',
      specifier: '../foo',
      enabled: true,
      status: 'active',
      path: '../foo',
      entry: 'src/index.ts',
      tools: {},
      toolNames: ['foo_search'],
      configSchema: { answerModel: { type: 'model', label: 'Answer model' } },
      configValues: { answerModel: 'openai/broken' },
    };
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => [plugin]),
      setConfigValue: vi.fn(async () => undefined),
    };
    modal.askModalQuestion
      .mockResolvedValueOnce('Answer model')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    const ctx = {
      pluginManager,
      state: {
        controller: { listAvailableModels: vi.fn(async () => [{ id: 'model-a', name: 'Model A' }]) },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx, ['acme.foo']);
    const detail = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const actions = detail.children.find((child: any) => Array.isArray(child.items));
    actions.onSelect({ value: 'configure' });
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));

    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(
      3,
      ctx.state.ui,
      expect.objectContaining({ question: 'Configure Foo Tools:' }),
    );
    expect(pluginManager.setConfigValue).not.toHaveBeenCalled();
  });

  it('clears plugin model settings to inherit the parent model', async () => {
    const plugin = {
      id: 'acme.foo',
      name: 'Foo Tools',
      scope: 'project',
      source: 'local',
      specifier: '../foo',
      enabled: true,
      status: 'active',
      path: '../foo',
      entry: 'src/index.ts',
      tools: {},
      toolNames: ['foo_search'],
      configSchema: {
        answerModel: {
          type: 'model',
          label: 'Answer model',
          description: 'Model mastra_expert uses to answer questions against the Alexandria repo.',
        },
      },
      configValues: { answerModel: 'openai/broken' },
    };
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => [plugin]),
      setConfigValue: vi.fn(async () => undefined),
    };
    modal.askModalQuestion.mockResolvedValueOnce('Answer model').mockResolvedValueOnce('Inherit parent model');
    const ctx = {
      pluginManager,
      authStorage: {},
      state: {
        controller: { listAvailableModels: vi.fn(async () => [{ id: 'model-a', name: 'Model A' }]) },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx, ['acme.foo']);
    const detail = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const actions = detail.children.find((child: any) => Array.isArray(child.items));
    actions.onSelect({ value: 'configure' });
    await new Promise(resolve => setImmediate(resolve));

    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(
      1,
      ctx.state.ui,
      expect.objectContaining({ allowCustomResponse: false }),
    );
    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        question: expect.stringContaining('Model mastra_expert uses to answer questions against the Alexandria repo.'),
        allowCustomResponse: false,
      }),
    );
    expect(pluginManager.setConfigValue).toHaveBeenCalledWith('acme.foo', 'project', 'answerModel', '');
    expect(ctx.state.controller.listAvailableModels).not.toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith('Updated plugin setting answerModel.');
  });

  it('asks for an entry path and retries local install when auto-detection fails', async () => {
    const entryError = new Error('Could not find a plugin entry file. Tried: src/index.ts, index.ts');
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => []),
      discoverLocal: vi.fn(() => []),
      installLocal: vi.fn().mockRejectedValueOnce(entryError).mockResolvedValueOnce('acme.foo'),
    };
    modal.askModalQuestion
      .mockResolvedValueOnce('Local path')
      .mockResolvedValueOnce('../foo')
      .mockResolvedValueOnce('project')
      .mockResolvedValueOnce('Install')
      .mockResolvedValueOnce('plugin.ts');
    const ctx = {
      pluginManager,
      state: { ui: { hideOverlay: vi.fn() } },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx);
    const container = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const list = container.children.find((child: any) => Array.isArray(child.items));
    list.onSelect({ value: '__install__' });
    await new Promise(resolve => setImmediate(resolve));

    expect(pluginManager.installLocal).toHaveBeenNthCalledWith(1, '../foo', 'project');
    expect(pluginManager.installLocal).toHaveBeenNthCalledWith(2, '../foo', 'project', { entry: 'plugin.ts' });
    expect(modal.askModalQuestion).toHaveBeenLastCalledWith(ctx.state.ui, {
      question: 'Could not auto-detect plugin entry. Entry file or directory path:',
      allowCustomResponse: true,
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Installed plugin acme.foo.');
    expect(ctx.showError).not.toHaveBeenCalled();
  });

  it('offers discovered local source plugins when choosing a local path', async () => {
    const discoveredPath = '/project/.mastracode/plugins/sources/local/foo';
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => []),
      discoverLocal: vi.fn(() => [{ name: 'foo', path: discoveredPath, entry: 'src/index.ts' }]),
      installLocal: vi.fn().mockResolvedValueOnce('acme.foo'),
    };
    modal.askModalQuestion
      .mockResolvedValueOnce('Local path')
      .mockResolvedValueOnce(discoveredPath)
      .mockResolvedValueOnce('project')
      .mockResolvedValueOnce('Install');
    const ctx = {
      pluginManager,
      state: { ui: { hideOverlay: vi.fn() } },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx);
    const container = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const list = container.children.find((child: any) => Array.isArray(child.items));
    list.onSelect({ value: '__install__' });
    await new Promise(resolve => setImmediate(resolve));

    expect(pluginManager.discoverLocal).toHaveBeenCalledWith('.');
    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(2, ctx.state.ui, {
      question: 'Local plugin path or discovered plugin:',
      options: [{ label: discoveredPath, description: 'foo' }],
      allowCustomResponse: true,
    });
    expect(pluginManager.installLocal).toHaveBeenCalledWith(discoveredPath, 'project');
  });

  it('offers nested discovered plugins when a local path is not itself a plugin', async () => {
    const entryError = new Error('Could not find a plugin entry file. Tried: src/index.ts, index.ts');
    const discoveredPath = '/other/.mastracode/plugins/sources/local/foo';
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => []),
      discoverLocal: vi.fn((path: string) =>
        path === '../other-project' ? [{ name: 'foo', path: discoveredPath, entry: 'src/index.ts' }] : [],
      ),
      installLocal: vi.fn().mockRejectedValueOnce(entryError).mockResolvedValueOnce('acme.foo'),
    };
    modal.askModalQuestion
      .mockResolvedValueOnce('Local path')
      .mockResolvedValueOnce('../other-project')
      .mockResolvedValueOnce('project')
      .mockResolvedValueOnce('Install')
      .mockResolvedValueOnce(discoveredPath);
    const ctx = {
      pluginManager,
      state: { ui: { hideOverlay: vi.fn() } },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx);
    const container = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const list = container.children.find((child: any) => Array.isArray(child.items));
    list.onSelect({ value: '__install__' });
    await new Promise(resolve => setImmediate(resolve));

    expect(pluginManager.discoverLocal).toHaveBeenCalledWith('../other-project');
    expect(modal.askModalQuestion).toHaveBeenLastCalledWith(ctx.state.ui, {
      question: 'That path is not a plugin. Install discovered plugin:',
      options: [{ label: discoveredPath, description: 'foo' }],
    });
    expect(pluginManager.installLocal).toHaveBeenNthCalledWith(1, '../other-project', 'project');
    expect(pluginManager.installLocal).toHaveBeenNthCalledWith(2, discoveredPath, 'project');
  });

  it('asks for an entry path and retries GitHub install when auto-detection fails', async () => {
    const entryError = new Error('Could not find a plugin entry file. Tried: src/index.ts, index.ts');
    const pluginManager = {
      reload: vi.fn(async () => undefined),
      getLoadedPlugins: vi.fn(() => []),
      discoverLocal: vi.fn(() => []),
      installGithub: vi.fn().mockRejectedValueOnce(entryError).mockResolvedValueOnce('acme.foo'),
    };
    modal.askModalQuestion
      .mockResolvedValueOnce('GitHub URL')
      .mockResolvedValueOnce('https://github.com/acme/foo')
      .mockResolvedValueOnce('global')
      .mockResolvedValueOnce('Install')
      .mockResolvedValueOnce('plugin.ts');
    const ctx = {
      pluginManager,
      state: { ui: { hideOverlay: vi.fn() } },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as any;

    await handlePluginsCommand(ctx);
    const container = overlay.showModalOverlay.mock.calls[0]?.[1] as any;
    const list = container.children.find((child: any) => Array.isArray(child.items));
    list.onSelect({ value: '__install__' });
    await new Promise(resolve => setImmediate(resolve));

    expect(modal.askModalQuestion).toHaveBeenNthCalledWith(4, ctx.state.ui, {
      question:
        'Plugins run code inside Mastra Code and can access your workspace. GitHub plugins also auto-update from their repository, so only install plugins from sources you trust. Continue?',
      options: [{ label: 'Install' }, { label: 'Cancel' }],
    });
    expect(pluginManager.installGithub).toHaveBeenNthCalledWith(1, 'https://github.com/acme/foo', 'global');
    expect(pluginManager.installGithub).toHaveBeenNthCalledWith(2, 'https://github.com/acme/foo', 'global', {
      entry: 'plugin.ts',
    });
    expect(modal.askModalQuestion).toHaveBeenLastCalledWith(ctx.state.ui, {
      question: 'Could not auto-detect plugin entry. Entry file or directory path:',
      allowCustomResponse: true,
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Installed plugin acme.foo.');
    expect(ctx.showError).not.toHaveBeenCalled();
  });
});
