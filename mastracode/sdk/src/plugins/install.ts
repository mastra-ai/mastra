import fs from 'node:fs';
import path from 'node:path';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import type { PluginInstallExecutionOptions } from './dependencies.js';
import { loadPluginFromEntry } from './loader.js';
import { getPluginRoot, getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import { detectEntry, parseGithubUrl, prepareGithubPluginSource, prepareLocalPluginSource } from './source.js';
export { detectEntry, NON_INTERACTIVE_GIT_ENV } from './source.js';
import type { InstalledPluginRecord, PluginScope } from './types.js';

export type InstallPluginOptions = PluginPathOptions &
  PluginInstallExecutionOptions & {
    entry?: string;
    ref?: string;
    githubCliPath?: string;
  };

export type DiscoveredLocalPlugin = {
  name: string;
  path: string;
  entry: string;
};

export async function installLocalPlugin(
  localPath: string,
  scope: PluginScope,
  options: InstallPluginOptions,
): Promise<string> {
  const prepared = await prepareLocalPluginSource(localPath, { ...options, cwd: options.projectRoot });
  const sourcePath = prepared.pluginRoot;
  const entry = prepared.entry;
  const plugin = await loadPluginFromEntry(path.join(sourcePath, entry));
  const registryPath = getPluginScopePaths(scope, options).registryPath;
  const registry = removePluginRecord(loadPluginRegistry(registryPath), plugin.id);
  const record: InstalledPluginRecord = {
    enabled: true,
    source: 'local',
    specifier: localPath,
    path: sourcePath,
    entry,
    ...(plugin.version ? { version: plugin.version } : {}),
  };

  savePluginRegistry(registryPath, setPluginRecord(registry, plugin.id, record));
  return plugin.id;
}

export async function installGithubPlugin(
  url: string,
  scope: PluginScope,
  options: InstallPluginOptions,
): Promise<string> {
  const parsed = parseGithubUrl(url);
  const paths = getPluginScopePaths(scope, options);
  const checkoutDir = path.join(paths.sourcesPath, 'github', `${parsed.owner}-${parsed.repo}`);
  const prepared = await prepareGithubPluginSource(url, { ...options, checkoutDir });
  const ref = prepared.ref;
  const entry = prepared.entry;
  const plugin = await loadPluginFromEntry(path.join(checkoutDir, entry));
  const registry = removePluginRecord(loadPluginRegistry(paths.registryPath), plugin.id);
  const relativePath = path.relative(getPluginRoot(scope, options), checkoutDir);
  const record: InstalledPluginRecord = {
    enabled: true,
    source: 'github',
    specifier: url,
    path: relativePath,
    entry,
    ...(ref ? { ref } : {}),
    ...(plugin.version ? { version: plugin.version } : {}),
  };

  savePluginRegistry(paths.registryPath, setPluginRecord(registry, plugin.id, record));
  return plugin.id;
}

export function discoverLocalPlugins(searchRoot: string, options: PluginPathOptions): DiscoveredLocalPlugin[] {
  const root = path.resolve(options.projectRoot, searchRoot);
  const localSourcesRoot = path.join(root, options.configDir ?? DEFAULT_CONFIG_DIR, 'plugins', 'sources', 'local');
  const scanRoot = isLocalSourcesDir(root) ? root : localSourcesRoot;

  const seen = new Set<string>();
  return discoverPluginDirs(scanRoot)
    .filter(candidate => {
      if (seen.has(candidate.path)) return false;
      seen.add(candidate.path);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isLocalSourcesDir(dir: string): boolean {
  const normalized = dir.split(path.sep).join('/');
  return normalized.endsWith('/plugins/sources/local');
}

function discoverPluginDirs(root: string): DiscoveredLocalPlugin[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const pluginDir = path.join(root, entry.name);
      const detectedEntry = tryDetectEntry(pluginDir);
      return detectedEntry ? [{ name: entry.name, path: pluginDir, entry: detectedEntry }] : [];
    });
}

function tryDetectEntry(pluginDir: string): string | undefined {
  try {
    return detectEntry(pluginDir);
  } catch {
    return undefined;
  }
}
