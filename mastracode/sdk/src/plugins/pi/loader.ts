import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createJiti } from 'jiti';

import { isInsideDirectory } from '../loader.js';
import { PI_COMPATIBILITY_TARGET_VERSION } from './compatibility.js';
import { formatPiExtensionError } from './diagnostics.js';
import { MastraPiExtensionGeneration } from './runtime.js';
import type { PiExtensionFactory, PiExtensionGeneration } from './types.js';

export interface LoadPiExtensionOptions {
  pluginId: string;
  extensionId?: string;
  entryPath: string;
  pluginRoot: string;
  config?: Readonly<Record<string, string | boolean>>;
}

export interface LoadPiExtensionsOptions extends Omit<LoadPiExtensionOptions, 'entryPath' | 'extensionId'> {
  entryPaths: string[];
}

function resolveImport(specifier: string): string {
  return fileURLToPath(import.meta.resolve(specifier));
}

function assertPackageVersion(entryPath: string, packageName: string, expectedVersion: string): void {
  let current = path.dirname(entryPath);
  while (true) {
    const manifestPath = path.join(current, 'package.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: unknown; version?: unknown };
      if (manifest.name === packageName) {
        if (manifest.version !== expectedVersion) {
          throw new Error(
            `Pi compatibility requires ${packageName}@${expectedVersion}, but resolved ${String(manifest.version)}`,
          );
        }
        return;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) throw new Error(`Could not verify resolved package ${packageName}@${expectedVersion}`);
    current = parent;
  }
}

function resolvePinnedImport(specifier: string, packageName: string, expectedVersion: string): string {
  const entryPath = resolveImport(specifier);
  assertPackageVersion(entryPath, packageName, expectedVersion);
  return entryPath;
}

function resolveCompatibilityShim(): string {
  const extension = path.extname(fileURLToPath(import.meta.url));
  const preferred = fileURLToPath(new URL(`./shim${extension}`, import.meta.url));
  if (fs.existsSync(preferred)) return preferred;
  const sourcePath = fileURLToPath(new URL('./shim.ts', import.meta.url));
  if (fs.existsSync(sourcePath)) return sourcePath;
  return fileURLToPath(new URL('./shim.js', import.meta.url));
}

export function getPiExtensionAliases(): Record<string, string> {
  const typebox = resolvePinnedImport('typebox', 'typebox', '1.3.7');
  const typeboxCompile = resolveImport('typebox/compile');
  const typeboxValue = resolveImport('typebox/value');
  const agentCore = resolvePinnedImport(
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-agent-core',
    PI_COMPATIBILITY_TARGET_VERSION,
  );
  const piTui = resolvePinnedImport(
    '@earendil-works/pi-tui',
    '@earendil-works/pi-tui',
    PI_COMPATIBILITY_TARGET_VERSION,
  );
  const piAiCompat = resolvePinnedImport(
    '@earendil-works/pi-ai/compat',
    '@earendil-works/pi-ai',
    PI_COMPATIBILITY_TARGET_VERSION,
  );
  const piAiOauth = resolveImport('@earendil-works/pi-ai/oauth');
  const piAiProviders = resolveImport('@earendil-works/pi-ai/providers/all');
  const codingAgentShim = resolveCompatibilityShim();

  return {
    typebox,
    'typebox/compile': typeboxCompile,
    'typebox/value': typeboxValue,
    '@sinclair/typebox': typebox,
    '@sinclair/typebox/compile': typeboxCompile,
    '@sinclair/typebox/value': typeboxValue,
    '@earendil-works/pi-agent-core': agentCore,
    '@earendil-works/pi-tui': piTui,
    '@earendil-works/pi-ai': piAiCompat,
    '@earendil-works/pi-ai/compat': piAiCompat,
    '@earendil-works/pi-ai/oauth': piAiOauth,
    '@earendil-works/pi-ai/providers/all': piAiProviders,
    '@earendil-works/pi-coding-agent': codingAgentShim,
    '@mariozechner/pi-agent-core': agentCore,
    '@mariozechner/pi-tui': piTui,
    '@mariozechner/pi-ai': piAiCompat,
    '@mariozechner/pi-ai/compat': piAiCompat,
    '@mariozechner/pi-ai/oauth': piAiOauth,
    '@mariozechner/pi-ai/providers/all': piAiProviders,
    '@mariozechner/pi-coding-agent': codingAgentShim,
  };
}

export function resolvePiExtensionEntry(entryPath: string, pluginRoot: string): string {
  const resolvedRoot = fs.realpathSync(pluginRoot);
  const candidate = path.isAbsolute(entryPath) ? entryPath : path.join(resolvedRoot, entryPath);
  const stat = fs.statSync(candidate);
  if (stat.isDirectory()) {
    for (const indexName of ['index.ts', 'index.js', 'index.mts', 'index.mjs', 'index.cts', 'index.cjs']) {
      const indexPath = path.join(candidate, indexName);
      if (fs.existsSync(indexPath)) return fs.realpathSync(indexPath);
    }
    throw new Error(`Pi extension directory has no supported index entry: ${candidate}`);
  }
  return fs.realpathSync(candidate);
}

export async function loadPiExtensionGenerations(options: LoadPiExtensionsOptions): Promise<PiExtensionGeneration[]> {
  const generations: PiExtensionGeneration[] = [];
  try {
    for (const entryPath of options.entryPaths) {
      generations.push(
        await loadPiExtensionGeneration({
          ...options,
          entryPath,
          extensionId: `${options.pluginId}:${entryPath}`,
        }),
      );
    }
    return generations;
  } catch (error) {
    await Promise.all(generations.map(generation => generation.invalidate()));
    throw error;
  }
}

export async function loadPiExtensionGeneration(options: LoadPiExtensionOptions): Promise<PiExtensionGeneration> {
  const pluginRoot = fs.realpathSync(options.pluginRoot);
  const entryPath = resolvePiExtensionEntry(options.entryPath, pluginRoot);
  if (!isInsideDirectory(entryPath, pluginRoot)) {
    throw new Error(`Pi extension entry for "${options.pluginId}" must be inside the plugin directory`);
  }
  if (!['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'].includes(path.extname(entryPath))) {
    throw new Error(`Unsupported Pi extension entry extension "${path.extname(entryPath)}"`);
  }

  const generation = new MastraPiExtensionGeneration(
    options.pluginId,
    options.extensionId ?? `${options.pluginId}:${path.basename(entryPath)}`,
    entryPath,
  );

  try {
    const jiti = createJiti(import.meta.url, {
      alias: getPiExtensionAliases(),
      moduleCache: false,
      fsCache: false,
      interopDefault: true,
    });
    const factory = await jiti.import<PiExtensionFactory | undefined>(entryPath, { default: true });
    if (typeof factory !== 'function') {
      throw new Error(`Pi extension must default export a factory function: ${entryPath}`);
    }
    await factory(generation.createApi(options.config));
    return generation;
  } catch (error) {
    await generation.invalidate(`Pi extension "${generation.extensionId}" failed during candidate load.`);
    throw new Error(formatPiExtensionError(generation.extensionId, error), { cause: error });
  }
}
