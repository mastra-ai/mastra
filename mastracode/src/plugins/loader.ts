import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  MastraCodePlugin,
  MastraCodePluginConfigSchema,
  MastraCodePluginConfigValues,
  MastraCodePluginContext,
  MastraCodePluginTool,
  MastraCodePluginToolEntries,
  MastraCodePluginTools,
  MastraCodeToolRenderConfig,
} from '../plugin.js';
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
    if (record.blocked) {
      loaded.push({ ...record, status: 'blocked', tools: {}, toolNames: [] });
      continue;
    }
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

    const configSchema = validatePluginConfigSchema(plugin.config);
    const configValues = resolvePluginConfigValues(configSchema, record.config);
    const pluginDir = path.dirname(entryPath);
    const pluginRoot = resolvePluginRoot(record, options);
    const context: MastraCodePluginContext = {
      cwd: options.projectRoot,
      scope: record.scope,
      pluginDir,
      config: configValues,
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
      skillPaths: resolveExistingAssetDirs(pluginRoot, 'skills'),
      commandPaths: resolveExistingAssetDirs(pluginRoot, 'commands'),
      configSchema,
      configValues,
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

export function resolvePluginRoot(record: ScopedInstalledPluginRecord, options: PluginPathOptions): string {
  return path.isAbsolute(record.path) ? record.path : path.join(getPluginRoot(record.scope, options), record.path);
}

export function resolvePluginEntryPath(record: ScopedInstalledPluginRecord, options: PluginPathOptions): string {
  return path.resolve(resolvePluginRoot(record, options), record.entry);
}

function resolveExistingAssetDirs(pluginRoot: string, dirname: 'skills' | 'commands'): string[] {
  const dir = path.join(pluginRoot, dirname);
  try {
    return fs.statSync(dir).isDirectory() ? [dir] : [];
  } catch {
    return [];
  }
}

async function importPluginModule(entryPath: string): Promise<MastraCodePlugin> {
  if (path.extname(entryPath) !== '.ts') {
    throw new Error(
      `Unsupported plugin entry extension "${path.extname(entryPath)}". V1 plugins must use .ts entries.`,
    );
  }

  const url = pathToFileURL(entryPath);
  const stat = fs.statSync(entryPath, { bigint: true });
  url.searchParams.set('mtimeNs', stat.mtimeNs.toString());
  url.searchParams.set('size', stat.size.toString());
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
  const entries = typeof plugin.tools === 'function' ? await plugin.tools(context) : plugin.tools;
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('Plugin tools function must return an object');
  }
  return normalizePluginToolEntries(entries);
}

function normalizePluginToolEntries(entries: MastraCodePluginToolEntries): MastraCodePluginTools {
  const tools: MastraCodePluginTools = {};
  for (const [name, entry] of Object.entries(entries)) {
    if (!isToolEntryObject(entry)) {
      throw new Error(`Plugin tool "${name}" must be an object with a tool property`);
    }
    tools[name] = withRenderConfig(entry.tool, entry.render);
  }
  return tools;
}

function isToolEntryObject(
  entry: MastraCodePluginToolEntries[string],
): entry is { tool: MastraCodePluginTool; render?: MastraCodeToolRenderConfig } {
  return (
    !!entry && typeof entry === 'object' && 'tool' in entry && typeof (entry as { tool?: unknown }).tool === 'object'
  );
}

function withRenderConfig(
  tool: MastraCodePluginTool,
  render: MastraCodeToolRenderConfig | undefined,
): MastraCodePluginTools[string] {
  return Object.assign(tool, {
    mastracode: {
      render,
    },
  });
}

function validatePluginConfigSchema(schema: unknown): MastraCodePluginConfigSchema | undefined {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return undefined;
  const validated: MastraCodePluginConfigSchema = {};
  for (const [key, option] of Object.entries(schema)) {
    if (!option || typeof option !== 'object' || Array.isArray(option)) continue;
    const record = option as Record<string, unknown>;
    if (record.type !== 'model' && record.type !== 'boolean' && record.type !== 'string') continue;
    validated[key] = {
      type: record.type,
      ...(typeof record.label === 'string' ? { label: record.label } : {}),
      ...(typeof record.description === 'string' ? { description: record.description } : {}),
      ...(typeof record.default === 'string' || typeof record.default === 'boolean' ? { default: record.default } : {}),
    };
  }
  return Object.keys(validated).length > 0 ? validated : undefined;
}

function resolvePluginConfigValues(
  schema: MastraCodePluginConfigSchema | undefined,
  recordValues: Record<string, unknown> | undefined,
): MastraCodePluginConfigValues {
  const values: MastraCodePluginConfigValues = {};
  if (!schema) return values;
  for (const [key, option] of Object.entries(schema)) {
    const value = recordValues?.[key];
    if (option.type === 'boolean') {
      values[key] = typeof value === 'boolean' ? value : typeof option.default === 'boolean' ? option.default : false;
      continue;
    }
    values[key] = typeof value === 'string' ? value : typeof option.default === 'string' ? option.default : undefined;
  }
  return values;
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
