import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { MastraCodePlugin, MastraCodePluginContext, MastraCodePluginTools } from '../plugin.js';
import { getPluginRoot } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, mergePluginRegistries } from './registry.js';
import type { LoadedPlugin, PluginRegistry, ScopedInstalledPluginRecord } from './types.js';

export type LoadPluginsOptions = PluginPathOptions & {
  globalRegistry?: PluginRegistry;
  projectRegistry?: PluginRegistry;
};

export async function loadPlugins(options: LoadPluginsOptions): Promise<LoadedPlugin[]> {
  const globalRegistry =
    options.globalRegistry ?? loadPluginRegistry(path.join(getPluginRoot('global', options), 'plugins.json'));
  const projectRegistry =
    options.projectRegistry ?? loadPluginRegistry(path.join(getPluginRoot('project', options), 'plugins.json'));
  const records = mergePluginRegistries(globalRegistry, projectRegistry);
  const loaded: LoadedPlugin[] = [];

  for (const record of records) {
    if (!record.enabled) {
      loaded.push({ ...record, status: 'inactive', tools: {}, toolNames: [] });
      continue;
    }

    loaded.push(await loadPluginRecord(record, options));
  }

  return markToolConflicts(loaded);
}

export async function loadPluginRecord(
  record: ScopedInstalledPluginRecord,
  options: PluginPathOptions,
): Promise<LoadedPlugin> {
  try {
    const entryPath = resolvePluginEntryPath(record, options);
    const plugin = await importPluginModule(entryPath);
    if (plugin.id !== record.id) {
      throw new Error(`Plugin id mismatch: registry has "${record.id}" but module exports "${plugin.id}"`);
    }

    const context: MastraCodePluginContext = {
      cwd: options.projectRoot,
      scope: record.scope,
      pluginDir: path.dirname(entryPath),
    };
    const tools = await resolvePluginTools(plugin, context);

    return {
      ...record,
      name: plugin.name,
      version: plugin.version ?? record.version,
      description: plugin.description,
      status: 'active',
      tools,
      toolNames: Object.keys(tools).sort(),
    };
  } catch (error) {
    return {
      ...record,
      status: 'load failed',
      error: error instanceof Error ? error.message : String(error),
      tools: {},
      toolNames: [],
    };
  }
}

export async function loadPluginFromEntry(entryPath: string): Promise<MastraCodePlugin> {
  return validatePluginExport(await importPluginModule(entryPath));
}

export function resolvePluginEntryPath(record: ScopedInstalledPluginRecord, options: PluginPathOptions): string {
  const basePath = path.isAbsolute(record.path)
    ? record.path
    : path.join(getPluginRoot(record.scope, options), record.path);
  return path.resolve(basePath, record.entry);
}

async function importPluginModule(entryPath: string): Promise<MastraCodePlugin> {
  if (path.extname(entryPath) !== '.ts') {
    throw new Error(
      `Unsupported plugin entry extension "${path.extname(entryPath)}". V1 plugins must use .ts entries.`,
    );
  }

  const url = pathToFileURL(entryPath);
  url.searchParams.set('mtime', String(Math.trunc(fs.statSync(entryPath).mtimeMs)));
  const mod = (await import(url.href)) as { default?: unknown; plugin?: unknown };
  return validatePluginExport(mod.default ?? mod.plugin);
}

function validatePluginExport(value: unknown): MastraCodePlugin {
  if (!value || typeof value !== 'object') {
    throw new Error('Plugin module must export a plugin object as default or named "plugin" export');
  }

  const plugin = value as MastraCodePlugin;
  if (typeof plugin.id !== 'string' || plugin.id.trim().length === 0) {
    throw new Error('Plugin id must be a non-empty string');
  }

  if (plugin.tools !== undefined && typeof plugin.tools !== 'object' && typeof plugin.tools !== 'function') {
    throw new Error('Plugin tools must be an object or function');
  }

  return plugin;
}

async function resolvePluginTools(
  plugin: MastraCodePlugin,
  context: MastraCodePluginContext,
): Promise<MastraCodePluginTools> {
  if (!plugin.tools) return {};
  const tools = typeof plugin.tools === 'function' ? await plugin.tools(context) : plugin.tools;
  if (!tools || typeof tools !== 'object' || Array.isArray(tools)) {
    throw new Error('Plugin tools function must return an object');
  }
  return tools;
}

export function collectActivePluginTools(plugins: LoadedPlugin[]): MastraCodePluginTools {
  const tools: MastraCodePluginTools = {};
  for (const plugin of plugins) {
    if (plugin.status !== 'active') continue;
    for (const [name, tool] of Object.entries(plugin.tools)) {
      if (!(name in tools)) {
        tools[name] = tool;
      }
    }
  }
  return tools;
}

function markToolConflicts(plugins: LoadedPlugin[]): LoadedPlugin[] {
  const seen = new Map<string, string>();
  return plugins.map(plugin => {
    if (plugin.status !== 'active') return plugin;
    const conflicts = plugin.toolNames.filter(toolName => seen.has(toolName));
    for (const toolName of plugin.toolNames) {
      if (!seen.has(toolName)) seen.set(toolName, plugin.id);
    }
    return conflicts.length > 0 ? { ...plugin, status: 'conflicted', conflicts } : plugin;
  });
}
