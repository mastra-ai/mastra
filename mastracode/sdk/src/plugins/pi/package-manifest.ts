import fs from 'node:fs';
import path from 'node:path';

export const PI_PACKAGE_LIFECYCLE_SCRIPT_NAMES = [
  'preinstall',
  'install',
  'postinstall',
  'prepare',
  'prepack',
  'postpack',
] as const;

export type PiPackageResourceType = 'extensions' | 'skills' | 'prompts' | 'themes';

export interface PiPackageManifest {
  name: string;
  version?: string;
  packageRoot: string;
  resourcePatterns?: Partial<Record<PiPackageResourceType, string[]>>;
  observedApiVersion?: string;
  lifecycleScripts: Partial<Record<(typeof PI_PACKAGE_LIFECYCLE_SCRIPT_NAMES)[number], string>>;
  hasDependencies: boolean;
}

export function inspectPiPackageManifest(packageRoot: string): PiPackageManifest {
  const resolvedRoot = fs.realpathSync(packageRoot);
  const manifestPath = path.join(resolvedRoot, 'package.json');
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    throw new Error(`Pi Package must contain package.json: ${resolvedRoot}`);
  }
  if (fs.statSync(manifestPath).size > 1024 * 1024) {
    throw new Error(`Pi Package manifest is too large: ${manifestPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
  if (!isRecord(raw)) throw new Error(`Pi Package manifest must be a JSON object: ${manifestPath}`);
  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    throw new Error(`Pi Package manifest must declare a non-empty name: ${manifestPath}`);
  }
  if (raw.version !== undefined && (typeof raw.version !== 'string' || raw.version.trim().length === 0)) {
    throw new Error(`Pi Package manifest version must be a non-empty string: ${manifestPath}`);
  }

  return {
    name: raw.name,
    ...(typeof raw.version === 'string' ? { version: raw.version } : {}),
    packageRoot: resolvedRoot,
    ...(raw.pi === undefined ? {} : { resourcePatterns: parseResourcePatterns(raw.pi, manifestPath) }),
    ...getObservedApiVersion(raw),
    lifecycleScripts: getLifecycleScripts(raw.scripts, manifestPath),
    hasDependencies: hasEntries(raw.dependencies) || hasEntries(raw.optionalDependencies),
  };
}

function parseResourcePatterns(value: unknown, manifestPath: string): Partial<Record<PiPackageResourceType, string[]>> {
  if (!isRecord(value)) throw new Error(`Pi Package "pi" manifest must be an object: ${manifestPath}`);
  const result: Partial<Record<PiPackageResourceType, string[]>> = {};
  for (const resourceType of ['extensions', 'skills', 'prompts', 'themes'] as const) {
    const entries = value[resourceType];
    if (entries === undefined) continue;
    if (!Array.isArray(entries) || entries.some(entry => typeof entry !== 'string' || entry.trim().length === 0)) {
      throw new Error(`Pi Package pi.${resourceType} must be an array of non-empty strings: ${manifestPath}`);
    }
    result[resourceType] = entries as string[];
  }
  return result;
}

function getObservedApiVersion(manifest: Record<string, unknown>): { observedApiVersion?: string } {
  const peerDependencies = isRecord(manifest.peerDependencies) ? manifest.peerDependencies : {};
  for (const packageName of [
    '@earendil-works/pi-coding-agent',
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-ai',
    '@mariozechner/pi-coding-agent',
    '@mariozechner/pi-agent-core',
    '@mariozechner/pi-ai',
  ]) {
    const version = peerDependencies[packageName];
    if (typeof version === 'string' && version.trim().length > 0) return { observedApiVersion: version };
  }
  return {};
}

function getLifecycleScripts(scripts: unknown, manifestPath: string): PiPackageManifest['lifecycleScripts'] {
  if (scripts === undefined) return {};
  if (!isRecord(scripts)) throw new Error(`Pi Package scripts must be an object: ${manifestPath}`);
  const result: PiPackageManifest['lifecycleScripts'] = {};
  for (const name of PI_PACKAGE_LIFECYCLE_SCRIPT_NAMES) {
    const command = scripts[name];
    if (command === undefined) continue;
    if (typeof command !== 'string') throw new Error(`Pi Package script "${name}" must be a string: ${manifestPath}`);
    result[name] = command;
  }
  return result;
}

function hasEntries(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
