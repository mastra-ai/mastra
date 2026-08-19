import { Box, SelectList, Spacer, Text, matchesKey } from '@earendil-works/pi-tui';
import type { SelectItem } from '@earendil-works/pi-tui';

import type { LoadedPlugin, PluginScope } from '@mastra/code-sdk/plugins/types';
import type { MastraCodePluginConfigOption, MastraCodePluginConfigValue } from '../../plugin.js';
import { ModelSelectorComponent } from '../components/model-selector.js';
import type { ModelItem } from '../components/model-selector.js';
import { askModalQuestion } from '../modal-question.js';
import { showModalOverlay } from '../overlay.js';
import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';
import { getSelectListTheme, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

const INSTALL_VALUE = '__install__';
const BACK_VALUE = '__back__';

class PluginInstallProgress extends Box {
  private lines: string[] = [];
  private _focused = false;

  constructor(
    private title: string,
    private specifier: string,
    private onCancel: () => void,
  ) {
    super(4, 2, text => theme.bg('overlayBg', text));
    this.rebuild();
  }

  get focused(): boolean {
    return this._focused;
  }

  set focused(value: boolean) {
    this._focused = value;
  }

  handleInput(data: string): void {
    if (matchesKey(data, 'escape') || matchesKey(data, 'ctrl+c') || data === '\x1b' || data === '\x1b\x1b') {
      this.onCancel();
    }
  }

  addOutput(chunk: Buffer | string): void {
    const lines = chunk
      .toString()
      .split(/\r?\n/)
      .map(line => line.trimEnd())
      .filter(Boolean);
    this.lines = [...this.lines, ...lines].slice(-8);
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();
    this.addChild(new Text(theme.bold(theme.fg('accent', this.title)), 0, 0));
    this.addChild(new Text(this.specifier, 0, 0));
    this.addChild(new Text(theme.fg('dim', 'Press Esc or Ctrl-C to cancel.'), 0, 0));
    this.addChild(new Spacer(1));
    const output = this.lines.length > 0 ? this.lines : ['Waiting for clone output...'];
    for (const line of output) {
      this.addChild(new Text(line, 0, 0));
    }
  }
}

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
  if (plugin.status === 'blocked') return theme.fg('warning', 'blocked');
  if (plugin.status === 'conflicted') return theme.fg('warning', 'conflicted');
  return theme.fg('error', 'load failed');
}

function pluginLabel(plugin: LoadedPlugin): string {
  const name = plugin.name ? `${plugin.name} ` : '';
  const compatibilityStatus = plugin.piCompatibility?.status ?? plugin.piPackage?.compatibilityReport.status;
  const compatibility = plugin.compatibility === 'pi' ? `  ${compatibilityStatus ?? 'load failed'}` : '';
  return `  ${name}${theme.fg('dim', `(${plugin.id})`)}  ${theme.fg('dim', plugin.scope)}  ${pluginStatus(plugin)}${compatibility}`;
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

function formatCompatibilityCapabilities(capabilities: readonly { name: string; support: string }[]): string[] {
  const groups = new Map<string, string[]>();
  for (const capability of capabilities) {
    const names = groups.get(capability.support) ?? [];
    names.push(capability.name);
    groups.set(capability.support, names);
  }
  return ['direct', 'adapted', 'version-gated', 'unsupported'].flatMap(support => {
    const names = groups.get(support);
    return names?.length ? [`${support}: ${names.sort().join(', ')}`] : [];
  });
}

function reportPluginMutationError(ctx: SlashCommandContext, action: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  ctx.showError(`${action} failed: ${message}`);
}

async function withPluginInstallProgress<T>(
  ctx: SlashCommandContext,
  title: string,
  specifier: string,
  cancelledMessage: string,
  install: (options: { onOutput: (chunk: Buffer | string) => void; signal: AbortSignal }) => Promise<T>,
  discardCancelledResult?: (result: T) => void,
): Promise<T> {
  const controller = new AbortController();
  const progress = new PluginInstallProgress(title, specifier, () => controller.abort());
  const overlay = showModalOverlay(ctx.state.ui, progress, { maxHeight: '70%' });
  overlay?.focus?.();
  ctx.state.ui.requestRender?.();
  try {
    let result: T;
    try {
      result = await install({
        onOutput: chunk => {
          progress.addOutput(chunk);
          ctx.state.ui.requestRender?.();
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error(cancelledMessage);
      throw error;
    }
    if (controller.signal.aborted) {
      discardCancelledResult?.(result);
      throw new Error(cancelledMessage);
    }
    return result;
  } finally {
    overlay?.hide?.();
    ctx.state.ui.requestRender?.();
  }
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
  if (plugin.piPackage) {
    container.addChild(new Text(`immutable source: ${plugin.piPackage.resolution.resolvedSpecifier}`, 0, 0));
    container.addChild(new Text(`target Pi API: ${plugin.piPackage.targetApiVersion}`, 0, 0));
    if (plugin.piPackage.observedApiVersion) {
      container.addChild(new Text(`observed Pi API: ${plugin.piPackage.observedApiVersion}`, 0, 0));
    }
    container.addChild(new Text(`compatibility: ${plugin.piPackage.compatibilityReport.status}`, 0, 0));
    for (const line of formatCompatibilityCapabilities(plugin.piPackage.compatibilityReport.capabilities)) {
      container.addChild(new Text(line, 0, 0));
    }
  }
  if (plugin.description) container.addChild(new Text(`description: ${plugin.description}`, 0, 0));
  container.addChild(new Text(`tools: ${plugin.toolNames.length ? plugin.toolNames.join(', ') : '(none)'}`, 0, 0));
  const configEntries = Object.entries(plugin.configSchema ?? {});
  if (configEntries.length) {
    container.addChild(new Text(`config: ${configEntries.map(([key]) => key).join(', ')}`, 0, 0));
  }
  if (plugin.error) container.addChild(new Text(theme.fg('error', `error: ${plugin.error}`), 0, 0));
  if (plugin.candidateError) {
    container.addChild(new Text(theme.fg('warning', `last update failed: ${plugin.candidateError}`), 0, 0));
  }
  if (plugin.status === 'blocked')
    container.addChild(new Text(theme.fg('warning', 'blocked by plugins.json disabledPlugins'), 0, 0));
  if (plugin.conflicts?.length)
    container.addChild(new Text(theme.fg('warning', `conflicts: ${plugin.conflicts.join(', ')}`), 0, 0));
  container.addChild(new Spacer(1));

  const actionLabel = plugin.enabled ? 'Deactivate' : 'Activate';
  const actionItems: SelectItem[] = [
    ...(configEntries.length && plugin.status !== 'blocked' ? [{ value: 'configure', label: '  Configure' }] : []),
    ...(plugin.compatibility === 'pi' && plugin.status !== 'blocked'
      ? [
          { value: 'update', label: '  Update from source' },
          { value: 'reload', label: '  Reload' },
        ]
      : []),
    ...(plugin.status === 'blocked' ? [] : [{ value: 'toggle', label: `  ${actionLabel}` }]),
    { value: 'uninstall', label: '  Uninstall' },
    { value: BACK_VALUE, label: '  Back' },
  ];
  const actions = new SelectList(actionItems, actionItems.length, getSelectListTheme());
  actions.onSelect = item => {
    if (!ctx.pluginManager) return;
    if (item.value === BACK_VALUE) {
      ctx.state.ui.hideOverlay();
      showPluginsList(ctx);
      return;
    }
    if (item.value === 'configure') {
      ctx.state.ui.hideOverlay();
      void configurePluginFlow(ctx, plugin);
      return;
    }
    if (item.value === 'update') {
      ctx.state.ui.hideOverlay();
      void installPiPackageFlow(ctx, plugin.specifier, plugin.scope, true);
      return;
    }
    if (item.value === 'reload') {
      void ctx.pluginManager
        .reloadPiPackage(plugin.id, plugin.scope)
        .then(() => {
          ctx.state.ui.hideOverlay();
          showPluginsList(ctx);
        })
        .catch(error => reportPluginMutationError(ctx, 'Reload', error));
      return;
    }
    if (item.value === 'toggle') {
      void ctx.pluginManager
        .setEnabled(plugin.id, plugin.scope, !plugin.enabled)
        .then(() => {
          ctx.state.ui.hideOverlay();
          showPluginsList(ctx);
        })
        .catch(error => reportPluginMutationError(ctx, actionLabel, error));
      return;
    }
    if (item.value === 'uninstall') {
      void ctx.pluginManager
        .uninstall(plugin.id, plugin.scope)
        .then(() => {
          ctx.state.ui.hideOverlay();
          showPluginsList(ctx);
        })
        .catch(error => reportPluginMutationError(ctx, 'Uninstall', error));
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

async function configurePluginFlow(ctx: SlashCommandContext, plugin: LoadedPlugin): Promise<void> {
  if (!ctx.pluginManager || !plugin.configSchema) return;
  const entries = Object.entries(plugin.configSchema);
  const selected = await askModalQuestion(ctx.state.ui, {
    question: `Configure ${plugin.name ?? plugin.id}:`,
    options: entries.map(([key, option]) => ({
      label: option.label ?? key,
      description: formatConfigDescription(key, option, plugin.configValues?.[key]),
    })),
    allowCustomResponse: false,
  });
  if (!selected) {
    showPluginDetail(ctx, plugin);
    return;
  }

  const entry = entries.find(([key, option]) => selected === (option.label ?? key));
  if (!entry) {
    showPluginDetail(ctx, plugin);
    return;
  }
  const [key, option] = entry;
  const value = await askPluginConfigValue(ctx, plugin, key, option);
  if (value === undefined) {
    await configurePluginFlow(ctx, plugin);
    return;
  }
  try {
    await ctx.pluginManager.setConfigValue(plugin.id, plugin.scope, key, value);
    ctx.showInfo(`Updated plugin setting ${key}.`);
  } catch (error) {
    reportPluginMutationError(ctx, `Update setting ${key}`, error);
  }
}

function formatConfigDescription(
  key: string,
  option: MastraCodePluginConfigOption,
  value: MastraCodePluginConfigValue,
): string {
  const current = value === undefined ? '(unset)' : String(value);
  return `${option.type} · ${option.description ?? key} · current: ${current}`;
}

function formatConfigValueQuestion(key: string, option: MastraCodePluginConfigOption): string {
  const label = option.label ?? key;
  return option.description ? `${label}\n${theme.fg('dim', option.description)}` : label;
}

async function askPluginConfigValue(
  ctx: SlashCommandContext,
  plugin: LoadedPlugin,
  key: string,
  option: MastraCodePluginConfigOption,
): Promise<MastraCodePluginConfigValue> {
  const current = plugin.configValues?.[key];
  if (option.type === 'boolean') {
    const answer = await askModalQuestion(ctx.state.ui, {
      question: formatConfigValueQuestion(key, option),
      options: [
        { label: 'Use default', description: 'Clear this setting and use the plugin default' },
        { label: 'On', description: 'true' },
        { label: 'Off', description: 'false' },
      ],
      allowCustomResponse: false,
    });
    if (!answer) return undefined;
    if (answer === 'Use default') return '';
    return answer === 'On';
  }

  if (option.type === 'model') {
    return askPluginModelValue(
      ctx,
      formatConfigValueQuestion(key, option),
      typeof current === 'string' ? current : undefined,
    );
  }

  const answer = await askModalQuestion(ctx.state.ui, {
    question: formatConfigValueQuestion(key, option),
    defaultValue: typeof current === 'string' ? current : undefined,
    allowCustomResponse: true,
    allowEmptyInput: true,
  });
  return answer ?? undefined;
}

async function askPluginModelValue(
  ctx: SlashCommandContext,
  title: string,
  currentModelId?: string,
): Promise<string | undefined> {
  const action = await askModalQuestion(ctx.state.ui, {
    question: title,
    options: [
      { label: 'Select model', description: currentModelId ? `current: ${currentModelId}` : 'Choose a specific model' },
      { label: 'Inherit parent model', description: 'Clear this setting and use the active session model' },
    ],
    allowCustomResponse: false,
  });
  if (!action) return undefined;
  if (action === 'Inherit parent model') return '';

  const availableModels = await ctx.state.controller.listAvailableModels();
  if (availableModels.length === 0) return undefined;

  return new Promise<string | undefined>(resolve => {
    const selector = new ModelSelectorComponent({
      tui: ctx.state.ui,
      models: availableModels,
      currentModelId,
      title,
      onSelect: async (model: ModelItem) => {
        ctx.state.ui.hideOverlay();
        await promptForApiKeyIfNeeded(ctx.state.ui, model, ctx.authStorage);
        resolve(model.id);
      },
      onCancel: () => {
        ctx.state.ui.hideOverlay();
        resolve(undefined);
      },
    });

    showModalOverlay(ctx.state.ui, selector, { maxHeight: '75%' });
    selector.focused = true;
  });
}

async function installPluginFlow(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.pluginManager) return;
  const kind = await askModalQuestion(ctx.state.ui, {
    question: 'Install plugin type:',
    options: [{ label: 'Native Mastra Code plugin' }, { label: 'Pi Package' }],
  });
  if (kind === 'Native Mastra Code plugin') {
    await installNativePluginFlow(ctx);
  } else if (kind === 'Pi Package') {
    await installPiPackageFlow(ctx);
  }
}

async function installNativePluginFlow(ctx: SlashCommandContext): Promise<void> {
  if (!ctx.pluginManager) return;
  const source = await askModalQuestion(ctx.state.ui, {
    question: 'Install native plugin from:',
    options: [{ label: 'GitHub URL' }, { label: 'Local path' }],
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

  const scopeAnswer = await askPluginScope(ctx);
  if (!scopeAnswer) return;

  const installWarning =
    source === 'GitHub URL'
      ? 'Plugins run code inside Mastra Code and can access your workspace. GitHub plugins also auto-update from their repository, so only install plugins from sources you trust. Continue?'
      : 'Plugins run code inside Mastra Code and can access your workspace. Continue?';
  const confirmed = await askModalQuestion(ctx.state.ui, {
    question: installWarning,
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

async function installPiPackageFlow(
  ctx: SlashCommandContext,
  existingSpecifier?: string,
  existingScope?: PluginScope,
  updating = false,
): Promise<void> {
  if (!ctx.pluginManager) return;
  const source = existingSpecifier
    ? undefined
    : await askModalQuestion(ctx.state.ui, {
        question: 'Pi Package source:',
        options: [{ label: 'npm package' }, { label: 'Git or GitHub' }, { label: 'Local directory' }],
      });
  if (!existingSpecifier && !source) return;
  const specifier = existingSpecifier ?? (await askPiPackageSpecifier(ctx, source!));
  if (!specifier) return;
  const scope = existingScope ?? (await askPluginScope(ctx));
  if (!scope) return;

  let prepared: Awaited<ReturnType<NonNullable<typeof ctx.pluginManager>['preparePiPackage']>> | undefined;
  let characterized: Awaited<ReturnType<NonNullable<typeof ctx.pluginManager>['characterizePiPackage']>> | undefined;
  let installed = false;
  try {
    prepared = await withPluginInstallProgress(
      ctx,
      'Resolving Pi Package',
      specifier,
      'Pi Package resolution cancelled',
      options => ctx.pluginManager!.preparePiPackage(specifier, scope, options),
      candidate => ctx.pluginManager!.discardPiPackageCandidate(candidate),
    );
    const scripts = Object.keys(prepared.manifest.lifecycleScripts);
    const identity = prepared.resolution.resolvedSpecifier;
    const trust = await askModalQuestion(ctx.state.ui, {
      question: [
        `${updating ? 'Update' : 'Install'} Pi Package ${prepared.manifest.name}`,
        `Immutable source: ${identity}`,
        '',
        'ARBITRARY CODE WARNING: Pi extensions are trusted in-process code. They can access your files, workspace, processes, network, environment variables, and credentials with your user permissions. Mastra Code does not sandbox them.',
        `Lifecycle scripts declared: ${scripts.length ? scripts.join(', ') : 'none'}.`,
        'Trust this source for code execution?',
      ].join('\n'),
      options: [{ label: 'Trust code' }, { label: 'Cancel' }],
    });
    if (trust !== 'Trust code') return;

    if (scope === 'project') {
      const projectTrust = await askModalQuestion(ctx.state.ui, {
        question: 'This package belongs to the current project. Trust the project to execute this Pi Package?',
        options: [{ label: 'Trust project' }, { label: 'Cancel' }],
      });
      if (projectTrust !== 'Trust project') return;
    }

    const scriptPolicy = await askModalQuestion(ctx.state.ui, {
      question: scripts.length
        ? `Dependency installation can run these lifecycle scripts: ${scripts.join(', ')}. Choose a policy:`
        : 'Dependency installation script policy:',
      options: [
        { label: 'Block lifecycle scripts', description: 'Install dependencies with --ignore-scripts' },
        { label: 'Allow lifecycle scripts', description: 'Run package lifecycle scripts with your user permissions' },
      ],
    });
    if (scriptPolicy !== 'Block lifecycle scripts' && scriptPolicy !== 'Allow lifecycle scripts') return;

    characterized = await withPluginInstallProgress(
      ctx,
      'Characterizing Pi Package',
      identity,
      'Pi Package characterization cancelled',
      options =>
        ctx.pluginManager!.characterizePiPackage(prepared!, {
          trustCodeExecution: true,
          ...(scope === 'project' ? { projectTrust: true } : {}),
          installScripts: scriptPolicy === 'Allow lifecycle scripts' ? 'allow' : 'deny',
          ...options,
        }),
      candidate => ctx.pluginManager!.discardPiPackageCandidate(candidate),
    );

    const enable = await askModalQuestion(ctx.state.ui, {
      question: formatPiPackageCapabilityReport(characterized),
      options: [{ label: updating ? 'Enable update' : 'Enable package' }, { label: 'Cancel' }],
    });
    if (enable !== (updating ? 'Enable update' : 'Enable package')) return;

    const id = await ctx.pluginManager.installPiPackage(characterized, { confirmEnable: true });
    installed = true;
    ctx.showInfo(`${updating ? 'Updated' : 'Installed'} Pi Package ${id}.`);
    showPluginsList(ctx);
  } catch (error) {
    ctx.showError(error instanceof Error ? error.message : String(error));
  } finally {
    const discarded = characterized ?? prepared;
    if (discarded && !installed) {
      try {
        ctx.pluginManager.discardPiPackageCandidate(discarded);
      } catch (error) {
        reportPluginMutationError(ctx, 'Pi Package cleanup', error);
      }
    }
  }
}

async function askPluginScope(ctx: SlashCommandContext): Promise<PluginScope | undefined> {
  const answer = await askModalQuestion(ctx.state.ui, {
    question: 'Install scope:',
    options: [{ label: 'global' }, { label: 'project' }],
  });
  return answer === 'project' || answer === 'global' ? answer : undefined;
}

async function askPiPackageSpecifier(ctx: SlashCommandContext, source: string): Promise<string | null> {
  if (source === 'Local directory') {
    return askModalQuestion(ctx.state.ui, { question: 'Local Pi Package directory:', allowCustomResponse: true });
  }
  if (source === 'npm package') {
    const value = await askModalQuestion(ctx.state.ui, {
      question: 'Exact npm package and version (for example, acme-pi@1.2.3):',
      allowCustomResponse: true,
    });
    return value ? (value.startsWith('npm:') ? value : `npm:${value}`) : null;
  }
  return askModalQuestion(ctx.state.ui, {
    question: 'Git/GitHub URL with ref (for example, github:owner/repo@v1.2.3):',
    allowCustomResponse: true,
  });
}

function formatPiPackageCapabilityReport(
  candidate: Awaited<ReturnType<NonNullable<SlashCommandContext['pluginManager']>['characterizePiPackage']>>,
): string {
  const lines = [
    `${candidate.manifest.name}${candidate.manifest.version ? `@${candidate.manifest.version}` : ''}`,
    `Immutable source: ${candidate.resolution.resolvedSpecifier}`,
    `Target Pi API: ${candidate.compatibility.targetApiVersion}`,
    `Observed Pi API: ${candidate.manifest.observedApiVersion ?? 'not declared'}`,
    `Compatibility: ${candidate.compatibility.status}`,
  ];
  for (const extension of candidate.extensions) {
    lines.push(
      '',
      `Extension: ${extension.entry}`,
      ...formatCompatibilityCapabilities(extension.compatibility.capabilities),
    );
    for (const diagnostic of extension.compatibility.diagnostics) lines.push(`diagnostic: ${diagnostic.message}`);
  }
  lines.push('', 'Enable this characterized package? Trust and enablement are separate decisions.');
  return lines.join('\n');
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
    return withPluginInstallProgress(
      ctx,
      'Installing GitHub plugin',
      specifier,
      'GitHub plugin install cancelled',
      options =>
        entry
          ? ctx.pluginManager!.installGithub(specifier, scope, { entry, ...options })
          : ctx.pluginManager!.installGithub(specifier, scope, options),
    );
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
