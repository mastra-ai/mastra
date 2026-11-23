import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getAppDataDir } from '../utils/project.js';
import { FEATURES, getFeaturePackages, getSdkVersion } from './catalog.js';
import type { FeatureId } from './catalog.js';
import { emitFeatureInstall, FeatureNotInstalledError } from './events.js';
import { findInstalledFeature, getFeatureDir, installFeature, resolveFromFeatureDir } from './install.js';
import type { FeatureInstallOptions, FeatureInstallTarget } from './install.js';

/** `auto` installs a missing feature the first time it is used; `never` reports it as unavailable. */
export type FeatureInstallPolicy = 'auto' | 'never';

let configuredPolicy: FeatureInstallPolicy = 'auto';

/** Set by `createMastraCode({ featureInstall })`. `MASTRACODE_FEATURE_INSTALL` takes precedence. */
export function setFeatureInstallPolicy(policy: FeatureInstallPolicy): void {
  configuredPolicy = policy;
}

export function getFeatureInstallPolicy(): FeatureInstallPolicy {
  const fromEnv = process.env.MASTRACODE_FEATURE_INSTALL?.trim().toLowerCase();
  if (fromEnv === 'never' || fromEnv === 'auto') return fromEnv;
  return configuredPolicy;
}

/** `MASTRACODE_FEATURES_DIR`, else `<app data>/features`. */
export function getFeaturesRoot(): string {
  return process.env.MASTRACODE_FEATURES_DIR || path.join(getAppDataDir(), 'features');
}

function getTarget(id: FeatureId): FeatureInstallTarget {
  return { id, packages: getFeaturePackages(id), versionDir: path.join(getFeaturesRoot(), getSdkVersion()) };
}

export type FeatureLocation =
  /** Installed next to mastracode (for example `npm i -g mastracode @mastra/fastembed`). */
  | { source: 'host'; url: string }
  /** Installed on first use into the features directory. */
  | { source: 'features-dir'; url: string; dir: string };

function isModuleNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ERR_MODULE_NOT_FOUND';
}

/** Where `specifier` resolves from, without installing anything. Undefined when it is not installed. */
export async function locateFeatureModule(id: FeatureId, specifier: string): Promise<FeatureLocation | undefined> {
  try {
    return { source: 'host', url: import.meta.resolve(specifier) };
  } catch (error) {
    if (!isModuleNotFound(error)) throw error;
  }
  const dir = findInstalledFeature(getTarget(id));
  if (!dir) return undefined;
  return { source: 'features-dir', url: await resolveFromFeatureDir(dir, specifier), dir };
}

/**
 * Installs a feature now, whatever the policy, then removes feature directories of older SDK versions
 * (keeping the most recent one, so a downgrade does not download again).
 */
export async function installFeatureNow(id: FeatureId, options: FeatureInstallOptions = {}): Promise<string> {
  const target = getTarget(id);
  const dir = await installFeature(target, options);
  pruneFeatureVersions({ keepPrevious: 1 });
  return dir;
}

/** Removes feature directories of other SDK versions. Returns the removed paths. */
export function pruneFeatureVersions({ keepPrevious }: { keepPrevious: number }): string[] {
  const root = getFeaturesRoot();
  const current = getSdkVersion();
  if (!fs.existsSync(root)) return [];
  const others = fs
    .readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== current && !entry.name.startsWith('.'))
    .map(entry => ({ dir: path.join(root, entry.name), mtimeMs: fs.statSync(path.join(root, entry.name)).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  const removed = others.slice(keepPrevious).map(({ dir }) => dir);
  for (const dir of removed) fs.rmSync(dir, { recursive: true, force: true });
  return removed;
}

/** One install per feature per process, shared by every caller that needs it meanwhile. */
const inflight = new Map<FeatureId, Promise<void>>();
/** Features that could not be installed in this process. Not retried until the next process or an explicit install. */
const unavailable = new Map<FeatureId, FeatureNotInstalledError>();

/**
 * The URL to import `specifier` from, installing the feature first if needed and allowed.
 * Throws `FeatureNotInstalledError` when the feature is not installed and cannot be.
 */
export async function resolveFeatureModule(id: FeatureId, specifier: string): Promise<string> {
  const found = await locateFeatureModule(id, specifier);
  if (found) return found.url;

  const known = unavailable.get(id);
  if (known) throw known;

  const feature = FEATURES[id];
  if (getFeatureInstallPolicy() === 'never') {
    const error = new FeatureNotInstalledError(
      id,
      'disabled',
      'it is not installed, and installing features on first use is turned off.',
      { remedy: `Run "mastracode features install ${id}", or unset MASTRACODE_FEATURE_INSTALL.` },
    );
    unavailable.set(id, error);
    emitFeatureInstall({
      type: 'feature_install',
      status: 'disabled',
      feature: id,
      label: feature.label,
      reason: error.reason,
      message: error.message,
      remedy: error.remedy,
    });
    throw error;
  }

  let install = inflight.get(id);
  if (!install) {
    install = installWithEvents(id).finally(() => inflight.delete(id));
    inflight.set(id, install);
  }
  await install;

  const installed = await locateFeatureModule(id, specifier);
  if (!installed) throw new Error(`${specifier} is still not resolvable after installing ${id}`);
  return installed.url;
}

async function installWithEvents(id: FeatureId): Promise<void> {
  const feature = FEATURES[id];
  const startedAt = Date.now();
  emitFeatureInstall({
    type: 'feature_install',
    status: 'started',
    feature: id,
    label: feature.label,
    approxSizeMb: feature.approxSizeMb,
  });
  try {
    await installFeatureNow(id);
  } catch (error) {
    const failure =
      error instanceof FeatureNotInstalledError
        ? error
        : new FeatureNotInstalledError(id, 'failed', error instanceof Error ? error.message : String(error), {
            remedy: `Run "mastracode features install ${id}".`,
            cause: error,
          });
    unavailable.set(id, failure);
    emitFeatureInstall({
      type: 'feature_install',
      status: 'failed',
      feature: id,
      label: feature.label,
      reason: failure.reason,
      message: failure.message,
      remedy: failure.remedy,
    });
    throw failure;
  }
  emitFeatureInstall({
    type: 'feature_install',
    status: 'completed',
    feature: id,
    label: feature.label,
    durationMs: Date.now() - startedAt,
  });
}

export interface FeatureStatus {
  id: FeatureId;
  label: string;
  packages: Record<string, string>;
  state: 'host' | 'features-dir' | 'missing';
  path?: string;
  lastFailure?: { failedAt: string; reason: string; message: string; logPath?: string };
}

/** Whether each feature is installed, and where. Never installs. */
export async function listFeatures(): Promise<FeatureStatus[]> {
  const statuses: FeatureStatus[] = [];
  for (const feature of Object.values(FEATURES)) {
    const target = getTarget(feature.id);
    const location = await locateFeatureModule(feature.id, feature.packages[0]!);
    const failedPath = path.join(target.versionDir, `.failed-${feature.id}.json`);
    const lastFailure = location ? undefined : readFailure(failedPath);
    statuses.push({
      id: feature.id,
      label: feature.label,
      packages: target.packages,
      state: location?.source ?? 'missing',
      path: location?.source === 'host' ? fileURLToPath(location.url) : getFeatureDir(target),
      ...(lastFailure ? { lastFailure } : {}),
    });
  }
  return statuses;
}

function readFailure(file: string): FeatureStatus['lastFailure'] {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as FeatureStatus['lastFailure'];
  } catch {
    return undefined;
  }
}
