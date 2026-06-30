import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { loadPluginFromEntry } from './loader.js';
import { getSingleManifestPlugin } from './manifest.js';
import { ensureMastraCodePackageLink } from './package-link.js';
import { getPluginRoot, getPluginScopePaths } from './paths.js';
import type { PluginPathOptions } from './paths.js';
import { loadPluginRegistry, removePluginRecord, savePluginRegistry, setPluginRecord } from './registry.js';
import type { InstalledPluginRecord, PluginScope } from './types.js';

export type InstallPluginOptions = PluginPathOptions & {
  entry?: string;
  ref?: string;
};

export type DiscoveredLocalPlugin = {
  name: string;
  path: string;
  entry: string;
};

const ENTRY_CANDIDATES = ['src/index.ts', 'index.ts'];

export async function installLocalPlugin(
  localPath: string,
  scope: PluginScope,
  options: InstallPluginOptions,
): Promise<string> {
  const sourcePath = path.resolve(options.projectRoot, localPath);
  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
    throw new Error(`Local plugin path does not exist or is not a directory: ${localPath}`);
  }

  const entry = detectEntry(sourcePath, options.entry);
  ensureMastraCodePackageLink(sourcePath);
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

  fs.rmSync(checkoutDir, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(checkoutDir), { recursive: true });
  await execa('git', ['clone', parsed.cloneUrl, checkoutDir]);
  const ref = options.ref ?? parsed.ref;
  if (ref) {
    await execa('git', ['checkout', ref], { cwd: checkoutDir });
  }

  const entry = detectEntry(checkoutDir, options.entry);
  ensureMastraCodePackageLink(checkoutDir);
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

export function detectEntry(pluginDir: string, explicitEntry?: string): string {
  const root = path.resolve(pluginDir);
  if (explicitEntry) {
    const entryPath = path.resolve(pluginDir, explicitEntry);
    if (!isInsideDirectory(entryPath, root)) {
      throw new Error('Plugin entry must be inside the plugin directory');
    }
    if (fs.existsSync(entryPath) && fs.statSync(entryPath).isDirectory()) {
      const nestedEntry = detectEntry(entryPath);
      return path.relative(root, path.join(entryPath, nestedEntry));
    }
    if (path.extname(entryPath) !== '.ts') {
      throw new Error('Plugin entry must be a .ts file');
    }
    if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) {
      throw new Error(`Plugin entry file does not exist: ${explicitEntry}`);
    }
    return path.relative(root, entryPath);
  }

  const manifestPlugin = getSingleManifestPlugin(pluginDir);
  if (manifestPlugin) {
    return detectEntry(pluginDir, manifestPlugin.entry);
  }

  for (const candidate of ENTRY_CANDIDATES) {
    const entryPath = path.join(pluginDir, candidate);
    if (fs.existsSync(entryPath) && fs.statSync(entryPath).isFile()) {
      return candidate;
    }
  }

  throw new Error(`Could not find a plugin entry file. Tried: ${ENTRY_CANDIDATES.join(', ')}`);
}

function isInsideDirectory(targetPath: string, root: string): boolean {
  return targetPath === root || targetPath.startsWith(root + path.sep);
}

function parseGithubUrl(specifier: string): { owner: string; repo: string; cloneUrl: string; ref?: string } {
  const [urlPart, ref] = specifier.split('#', 2);
  if (!urlPart) {
    throw new Error(`Invalid GitHub URL: ${specifier}`);
  }
  let url: URL;
  try {
    url = new URL(urlPart);
  } catch {
    throw new Error(`Invalid GitHub URL: ${specifier}`);
  }

  if (url.hostname !== 'github.com') {
    throw new Error('Only github.com plugin URLs are supported');
  }

  const [owner, rawRepo, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !rawRepo || rest.length > 0) {
    throw new Error('GitHub plugin URL must be in the form https://github.com/owner/repo');
  }

  const repo = rawRepo.replace(/\.git$/, '');
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    throw new Error('GitHub owner and repo may only contain letters, numbers, dots, underscores, and dashes');
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    ...(ref ? { ref } : {}),
  };
}
