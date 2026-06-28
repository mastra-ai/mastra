import { Box, SelectList, Spacer, Text } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';

import type { LoadedPlugin, PluginScope } from '../../plugins/types.js';
import { askModalQuestion } from '../modal-question.js';
import { showModalOverlay } from '../overlay.js';
import { getSelectListTheme, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

const INSTALL_VALUE = '__install__';
const BACK_VALUE = '__back__';

export async function handlePluginsCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (!ctx.pluginManager) {
    ctx.showInfo('Plugin system not initialized.');
    return;
  }

  await ctx.pluginManager.reload();
  const pluginId = args[0];
  if (pluginId) {
    const plugins = ctx.pluginManager.getLoadedPlugins();
    const plugin = plugins.find(
      candidate => candidate.id === pluginId || `${candidate.scope}:${candidate.id}` === pluginId,
    );
    if (!plugin) {
      ctx.showError(`Plugin not found: ${pluginId}`);
      return;
    }
    showPluginDetail(ctx, plugin);
    return;
  }

  showPluginsList(ctx);
}

function pluginStatus(plugin: LoadedPlugin): string {
  if (plugin.status === 'active') return theme.fg('success', 'active');
  if (plugin.status === 'inactive') return theme.fg('dim', 'inactive');
  if (plugin.status === 'conflicted') return theme.fg('warning', 'conflicted');
  return theme.fg('error', 'load failed');
}

function pluginLabel(plugin: LoadedPlugin): string {
  const name = plugin.name ? `${plugin.name} ` : '';
  return `  ${name}${theme.fg('dim', `(${plugin.id})`)}  ${theme.fg('dim', plugin.scope)}  ${pluginStatus(plugin)}`;
}

function buildPluginItems(plugins: LoadedPlugin[]): SelectItem[] {
  const project = plugins.filter(plugin => plugin.scope === 'project');
  const global = plugins.filter(plugin => plugin.scope === 'global');
  return [
    { value: INSTALL_VALUE, label: '  Install new plugin' },
    ...project.map(plugin => ({ value: `project:${plugin.id}`, label: pluginLabel(plugin) })),
    ...global.map(plugin => ({ value: `global:${plugin.id}`, label: pluginLabel(plugin) })),
  ];
}

function showPluginsList(ctx: SlashCommandContext): void {
  const plugins = ctx.pluginManager?.getLoadedPlugins() ?? [];
  const items = buildPluginItems(plugins);
  const container = new Box(4, 2, text => theme.bg('overlayBg', text));
  container.addChild(new Text(theme.bold(theme.fg('accent', 'Plugins')), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg('dim', 'Scaffold with: mastracode plugin scaffold <dir>'), 0, 0));
  container.addChild(new Spacer(1));

  const list = new SelectList(items, Math.min(items.length, 15), getSelectListTheme());
  list.onSelect = item => {
    if (item.value === INSTALL_VALUE) {
      ctx.state.ui.hideOverlay();
      void installPluginFlow(ctx);
      return;
    }
    const [scope, id] = item.value.split(':', 2) as [PluginScope, string];
    const plugin = plugins.find(candidate => candidate.scope === scope && candidate.id === id);
    if (plugin) {
      ctx.state.ui.hideOverlay();
      showPluginDetail(ctx, plugin);
    }
  };
  list.onCancel = () => ctx.state.ui.hideOverlay();

  container.addChild(list);
  container.addChild(new Spacer(1));
  container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter select · Esc close'), 0, 0));
  const modal = container as Box & { handleInput: (data: string) => void };
  modal.handleInput = (data: string) => list.handleInput(data);
  showModalOverlay(ctx.state.ui, modal, { maxHeight: '80%' });
}

function showPluginDetail(ctx: SlashCommandContext, plugin: LoadedPlugin): void {
  const container = new Box(4, 2, text => theme.bg('overlayBg', text));
  container.addChild(new Text(theme.bold(theme.fg('accent', plugin.name ?? plugin.id)), 0, 0));
  container.addChild(new Spacer(1));
  container.addChild(new Text(`id: ${plugin.id}`, 0, 0));
  container.addChild(new Text(`scope: ${plugin.scope}`, 0, 0));
  container.addChild(new Text(`source: ${plugin.source} ${plugin.specifier}`, 0, 0));
  container.addChild(new Text(`status: ${plugin.status}`, 0, 0));
  if (plugin.version) container.addChild(new Text(`version: ${plugin.version}`, 0, 0));
  if (plugin.description) container.addChild(new Text(`description: ${plugin.description}`, 0, 0));
  container.addChild(new Text(`tools: ${plugin.toolNames.length ? plugin.toolNames.join(', ') : '(none)'}`, 0, 0));
  if (plugin.error) container.addChild(new Text(theme.fg('error', `error: ${plugin.error}`), 0, 0));
  if (plugin.conflicts?.length)
    container.addChild(new Text(theme.fg('warning', `conflicts: ${plugin.conflicts.join(', ')}`), 0, 0));
  container.addChild(new Spacer(1));

  const actionLabel = plugin.enabled ? 'Deactivate' : 'Activate';
  const actions = new SelectList(
    [
      { value: 'toggle', label: `  ${actionLabel}` },
      { value: 'uninstall', label: '  Uninstall' },
      { value: BACK_VALUE, label: '  Back' },
    ],
    3,
    getSelectListTheme(),
  );
  actions.onSelect = item => {
    if (!ctx.pluginManager) return;
    if (item.value === BACK_VALUE) {
      ctx.state.ui.hideOverlay();
      showPluginsList(ctx);
      return;
    }
    if (item.value === 'toggle') {
      void ctx.pluginManager.setEnabled(plugin.id, plugin.scope, !plugin.enabled).then(() => {
        ctx.state.ui.hideOverlay();
        showPluginsList(ctx);
      });
      return;
    }
    if (item.value === 'uninstall') {
      void ctx.pluginManager.uninstall(plugin.id, plugin.scope).then(() => {
        ctx.state.ui.hideOverlay();
        showPluginsList(ctx);
      });
    }
  };
  actions.onCancel = () => {
    ctx.state.ui.hideOverlay();
    showPluginsList(ctx);
  };
  container.addChild(actions);
  const modal = container as Box & { handleInput: (data: string) => void };
  modal.handleInput = (data: string) => actions.handleInput(data);
  showModalOverlay(ctx.state.ui, modal, { maxHeight: '80%' });
}

async function installPluginFlow(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.pluginManager) return;
  const source = await askModalQuestion(ctx.state.ui, {
    question: 'Install plugin from:',
    options: [{ label: 'Local path' }, { label: 'GitHub URL' }],
  });
  if (!source) return;

  const specifier =
    source === 'Local path'
      ? await askLocalPluginPath(ctx)
      : await askModalQuestion(ctx.state.ui, {
          question: 'GitHub URL:',
          allowCustomResponse: true,
        });
  if (!specifier) return;

  const scopeAnswer = await askModalQuestion(ctx.state.ui, {
    question: 'Install scope:',
    options: [{ label: 'project' }, { label: 'global' }],
  });
  if (scopeAnswer !== 'project' && scopeAnswer !== 'global') return;

  const confirmed = await askModalQuestion(ctx.state.ui, {
    question: 'Plugins run code inside Mastra Code and can access your workspace. Continue?',
    options: [{ label: 'Install' }, { label: 'Cancel' }],
  });
  if (confirmed !== 'Install') return;

  try {
    const id = await installPluginWithOptionalEntryPrompt(ctx, source, specifier, scopeAnswer);
    if (!id) return;
    ctx.showInfo(`Installed plugin ${id}.`);
    showPluginsList(ctx);
  } catch (error) {
    ctx.showError(error instanceof Error ? error.message : String(error));
  }
}

async function askLocalPluginPath(ctx: SlashCommandContext): Promise<string | null> {
  const discovered = ctx.pluginManager?.discoverLocal('.') ?? [];
  return askModalQuestion(ctx.state.ui, {
    question: discovered.length ? 'Local plugin path or discovered plugin:' : 'Local plugin path:',
    ...(discovered.length
      ? {
          options: discovered.map(plugin => ({ label: plugin.path, description: plugin.name })),
          allowCustomResponse: true,
        }
      : { allowCustomResponse: true }),
  });
}

async function installPluginWithOptionalEntryPrompt(
  ctx: SlashCommandContext,
  source: string,
  specifier: string,
  scope: PluginScope,
): Promise<string | undefined> {
  if (!ctx.pluginManager) return undefined;
  const install = (entry?: string) => {
    if (source === 'Local path') {
      return entry
        ? ctx.pluginManager!.installLocal(specifier, scope, { entry })
        : ctx.pluginManager!.installLocal(specifier, scope);
    }
    return entry
      ? ctx.pluginManager!.installGithub(specifier, scope, { entry })
      : ctx.pluginManager!.installGithub(specifier, scope);
  };

  try {
    return await install();
  } catch (error) {
    if (!isEntryDetectionError(error)) throw error;
    if (source === 'Local path') {
      const discovered = ctx.pluginManager.discoverLocal(specifier);
      if (discovered.length > 0) {
        const selected = await askModalQuestion(ctx.state.ui, {
          question: 'That path is not a plugin. Install discovered plugin:',
          options: discovered.map(plugin => ({ label: plugin.path, description: plugin.name })),
        });
        if (!selected) return undefined;
        return ctx.pluginManager.installLocal(selected, scope);
      }
    }

    const entry = await askModalQuestion(ctx.state.ui, {
      question: 'Could not auto-detect plugin entry. Entry file or directory path:',
      allowCustomResponse: true,
    });
    if (!entry) return undefined;
    return install(entry);
  }
}

function isEntryDetectionError(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith('Could not find a plugin entry file.');
}
