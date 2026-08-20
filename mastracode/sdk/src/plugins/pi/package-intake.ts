import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import { getPluginRoot } from '../paths.js';
import type {
  InstalledPluginRecord,
  PiPackageInstallScriptsPolicy,
  PiPackageResourceManifest,
  PiPackageTrustDecision,
  PluginScope,
} from '../types.js';
import {
  createPiPackageCompatibility,
  PI_COMPATIBILITY_TARGET_VERSION,
  type PiCapabilityCompatibility,
  type PiCompatibilityDiagnostic,
  type PiPackageCompatibility,
} from './compatibility.js';
import { loadPiExtensionGenerations } from './loader.js';
import { inspectPiPackageManifest, type PiPackageManifest } from './package-manifest.js';
import {
  hashMaterializedPackageDirectory,
  hashPackageDirectory,
  resolvePiPackageSource,
  type PreparedPiPackage,
  type ResolvePiPackageOptions,
} from './package-resolver.js';
import { discoverPiPackageResources } from './resource-discovery.js';

export interface PreparedPiPackageInspection extends PreparedPiPackage {
  manifest: PiPackageManifest;
  resources: PiPackageResourceManifest;
}

export interface PiPackageCharacterizationOptions {
  trustCodeExecution: true;
  installScripts: PiPackageInstallScriptsPolicy;
  projectTrust?: true;
  corepackCliPath?: string;
  signal?: AbortSignal;
  onOutput?: (chunk: Buffer | string) => void;
}

export interface PiPackageExtensionCompatibility {
  entry: string;
  compatibility: PiPackageCompatibility;
}

export interface CharacterizedPiPackage extends PreparedPiPackageInspection {
  compatibility: PiPackageCompatibility;
  extensions: PiPackageExtensionCompatibility[];
  trust: PiPackageTrustDecision;
}

export async function preparePiPackage(
  specifier: string,
  scope: PluginScope,
  options: ResolvePiPackageOptions,
): Promise<PreparedPiPackageInspection> {
  const prepared = await resolvePiPackageSource(specifier, scope, options);
  try {
    const manifest = inspectPiPackageManifest(prepared.resolution.packageRoot);
    const resources = discoverPiPackageResources(manifest);
    return { ...prepared, manifest, resources };
  } catch (error) {
    for (const root of new Set([prepared.resolution.packageRoot, prepared.resolution.sourceRoot])) {
      fs.rmSync(root, { recursive: true, force: true });
    }
    throw error;
  }
}

export async function characterizePiPackage(
  prepared: PreparedPiPackageInspection,
  options: PiPackageCharacterizationOptions,
): Promise<CharacterizedPiPackage> {
  assertCharacterizationTrust(prepared.scope, options);
  const materialized = createMaterializedPackage(prepared);
  let retainMaterializedPackage = false;
  try {
    await installPiPackageDependencies(materialized, options);
    const generations = await loadPiExtensionGenerations({
      pluginId: materialized.manifest.name,
      entryPaths: materialized.resources.extensions,
      pluginRoot: materialized.resolution.packageRoot,
    });
    let result: CharacterizedPiPackage | undefined;
    try {
      const extensions = generations.map(generation => ({
        entry: path.relative(materialized.resolution.packageRoot, generation.entryPath),
        compatibility: structuredClone(generation.compatibility),
      }));
      let compatibility = aggregateCompatibility(extensions.map(extension => extension.compatibility));
      if (materialized.manifest.observedApiVersion && !isTargetApiRange(materialized.manifest.observedApiVersion)) {
        const diagnostic: PiCompatibilityDiagnostic = {
          severity: 'warning',
          capability: 'pi-api-version',
          message: `Package declares Pi API range "${materialized.manifest.observedApiVersion}"; Mastra Code characterizes against ${PI_COMPATIBILITY_TARGET_VERSION}.`,
        };
        compatibility = createPiPackageCompatibility(
          [
            ...compatibility.capabilities,
            {
              name: 'pi-api-version',
              support: 'version-gated',
              evidence: [{ source: 'package.json#peerDependencies', detail: materialized.manifest.observedApiVersion }],
              diagnostics: [diagnostic],
            },
          ],
          [...compatibility.diagnostics, diagnostic],
        );
      }
      result = {
        ...materialized,
        resolution: {
          ...materialized.resolution,
          materializedIntegrity: hashMaterializedPackageDirectory(materialized.resolution.packageRoot),
        },
        extensions,
        compatibility,
        trust: {
          codeExecution: 'trusted',
          project: materialized.scope === 'project' ? 'trusted' : 'not-required',
          installScripts: options.installScripts,
        },
      };
    } finally {
      await Promise.all(
        generations.map(async generation => {
          try {
            if (generation.hasHandlers('session_shutdown')) {
              await generation.emit('session_shutdown', { type: 'session_shutdown' });
            }
          } finally {
            await generation.invalidate('Pi Package characterization completed.');
          }
        }),
      );
    }
    if (!result) throw new Error('Pi Package characterization did not produce a result');
    retainMaterializedPackage = true;
    return result;
  } finally {
    if (!retainMaterializedPackage) {
      fs.rmSync(path.dirname(materialized.resolution.packageRoot), { recursive: true, force: true });
    }
  }
}

function createMaterializedPackage(prepared: PreparedPiPackageInspection): PreparedPiPackageInspection {
  const materializedRoot = path.join(path.dirname(prepared.resolution.packageRoot), '.materialized');
  fs.mkdirSync(materializedRoot, { recursive: true, mode: 0o700 });
  const stagingRoot = fs.mkdtempSync(path.join(materializedRoot, 'package-'));
  const packageRoot = path.join(stagingRoot, 'package');
  try {
    fs.cpSync(prepared.resolution.packageRoot, packageRoot, {
      recursive: true,
      filter: source => {
        const relative = path.relative(prepared.resolution.packageRoot, source);
        return (
          relative !== '.git' &&
          !relative.startsWith(`.git${path.sep}`) &&
          relative !== 'node_modules' &&
          !relative.startsWith(`node_modules${path.sep}`)
        );
      },
    });
    if (hashPackageDirectory(packageRoot) !== prepared.resolution.contentIntegrity) {
      throw new Error('Resolved Pi Package content changed after static inspection');
    }
    return {
      ...prepared,
      resolution: { ...prepared.resolution, packageRoot },
      manifest: inspectPiPackageManifest(packageRoot),
    };
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
}

export function createPiPackageRecord(
  characterized: CharacterizedPiPackage,
  options: ResolvePiPackageOptions,
): InstalledPluginRecord {
  if (characterized.resources.extensions.length === 0) {
    throw new Error(`Pi Package "${characterized.manifest.name}" has no extension entry to enable`);
  }

  const scopeRoot = getPluginRoot(characterized.scope, options);
  const relativeRoot = toOwnedRelativePath(characterized.resolution.packageRoot, scopeRoot);
  const relativeSourceRoot = toOwnedRelativePath(characterized.resolution.sourceRoot, scopeRoot);
  const entries = characterized.resources.extensions;
  return {
    enabled: true,
    source: 'pi-package',
    compatibility: 'pi',
    specifier: characterized.specifier,
    path: relativeRoot,
    entry: entries[0]!,
    entries,
    ...(characterized.manifest.version ? { version: characterized.manifest.version } : {}),
    piPackage: {
      resolution: {
        ...characterized.resolution,
        sourceRoot: relativeSourceRoot,
        packageRoot: relativeRoot,
      },
      resources: characterized.resources,
      targetApiVersion: PI_COMPATIBILITY_TARGET_VERSION,
      ...(characterized.manifest.observedApiVersion
        ? { observedApiVersion: characterized.manifest.observedApiVersion }
        : {}),
      compatibilityReport: characterized.compatibility,
      trust: characterized.trust,
    },
  };
}

function toOwnedRelativePath(absolutePath: string, scopeRoot: string): string {
  const relativePath = path.relative(scopeRoot, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error('Resolved Pi Package must be inside the scope-owned plugin directory');
  }
  return relativePath;
}

function assertCharacterizationTrust(scope: PluginScope, options: PiPackageCharacterizationOptions): void {
  if (options.trustCodeExecution !== true) {
    throw new Error('Pi Package characterization executes arbitrary code and requires explicit code-execution trust');
  }
  if (scope === 'project' && options.projectTrust !== true) {
    throw new Error('Project Pi Package characterization requires explicit project trust');
  }
  if (options.installScripts !== 'allow' && options.installScripts !== 'deny') {
    throw new Error('Pi Package characterization requires an explicit install-script policy');
  }
}

async function installPiPackageDependencies(
  prepared: PreparedPiPackageInspection,
  options: PiPackageCharacterizationOptions,
): Promise<void> {
  if (!prepared.manifest.hasDependencies && Object.keys(prepared.manifest.lifecycleScripts).length === 0) return;
  const args = [
    prepared.manifest.packageManager ?? 'pnpm@10.24.0',
    'install',
    '--prod',
    '--ignore-workspace',
    fs.existsSync(path.join(prepared.resolution.packageRoot, 'pnpm-lock.yaml'))
      ? '--frozen-lockfile'
      : '--no-frozen-lockfile',
    ...(options.installScripts === 'deny' ? ['--ignore-scripts'] : []),
  ];
  const child = execa(options.corepackCliPath ?? 'corepack', args, {
    cwd: prepared.resolution.packageRoot,
    env: { ...process.env, CI: '1', GIT_TERMINAL_PROMPT: '0' },
    cancelSignal: options.signal,
    stdout: options.onOutput ? 'pipe' : 'ignore',
    stderr: options.onOutput ? 'pipe' : 'ignore',
  });
  if (options.onOutput) {
    child.stdout?.on('data', options.onOutput);
    child.stderr?.on('data', options.onOutput);
  }
  await child;
}

function aggregateCompatibility(reports: PiPackageCompatibility[]): PiPackageCompatibility {
  const capabilities = new Map<string, PiCapabilityCompatibility>();
  const diagnostics: PiCompatibilityDiagnostic[] = [];
  for (const report of reports) {
    diagnostics.push(...report.diagnostics);
    for (const capability of report.capabilities) {
      const existing = capabilities.get(capability.name);
      if (!existing) {
        capabilities.set(capability.name, structuredClone(capability));
      } else {
        existing.evidence.push(...structuredClone(capability.evidence));
        existing.diagnostics.push(...structuredClone(capability.diagnostics));
      }
    }
  }
  return createPiPackageCompatibility(
    [...capabilities.values()].sort((a, b) => a.name.localeCompare(b.name)),
    diagnostics,
  );
}

function isTargetApiRange(range: string): boolean {
  if (range.trim() === '*') return true;
  const [major, minor] = PI_COMPATIBILITY_TARGET_VERSION.split('.');
  return new RegExp(`(^|[^0-9])${major}\\.${minor}(?:\\.|[^0-9]|$)`).test(range);
}
