import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

/**
 * Exact versions of the feature packages this SDK build was made with, injected by tsdown's `define`
 * (see `tsdown.config.ts`). Undefined when running from source.
 */
declare const __MASTRACODE_FEATURE_PINS__: Record<string, string> | undefined;

/** Optional features whose packages are installed the first time they are used, not with mastracode. */
export type FeatureId = 'embeddings';

export interface FeatureDefinition {
  id: FeatureId;
  /** What the user loses without it, phrased for "Installing <label>…". */
  label: string;
  /** npm packages the feature needs. Their exact versions come from `getFeaturePins()`. */
  packages: string[];
  /** Rough installed size, shown before a download starts. */
  approxSizeMb: number;
}

export const FEATURES: Record<FeatureId, FeatureDefinition> = {
  embeddings: {
    id: 'embeddings',
    label: 'local embeddings for memory recall',
    packages: ['@mastra/fastembed'],
    approxSizeMb: 325,
  },
};

export function isFeatureId(value: string): value is FeatureId {
  return Object.hasOwn(FEATURES, value);
}

const requireFromSdk = createRequire(import.meta.url);

function readPackageVersion(packageName: string): string | undefined {
  try {
    const manifest = JSON.parse(readFileSync(requireFromSdk.resolve(`${packageName}/package.json`), 'utf8')) as {
      version?: string;
    };
    return manifest.version;
  } catch {
    return undefined;
  }
}

/**
 * The exact version to install for each feature package: the one this SDK was built and tested with.
 * From source there is no build-time pin, so it falls back to the workspace copy's version.
 */
export function getFeaturePins(): Record<string, string> {
  if (typeof __MASTRACODE_FEATURE_PINS__ !== 'undefined') return __MASTRACODE_FEATURE_PINS__;
  const pins: Record<string, string> = {};
  for (const feature of Object.values(FEATURES)) {
    for (const packageName of feature.packages) {
      const version = readPackageVersion(packageName);
      if (version) pins[packageName] = version;
    }
  }
  return pins;
}

/** `{ package: exactVersion }` for one feature, or an error naming the package that has no pin. */
export function getFeaturePackages(id: FeatureId): Record<string, string> {
  const pins = getFeaturePins();
  const packages: Record<string, string> = {};
  for (const packageName of FEATURES[id].packages) {
    const version = pins[packageName];
    if (!version) throw new Error(`No pinned version for ${packageName}; this build of Mastra Code cannot install it.`);
    packages[packageName] = version;
  }
  return packages;
}

/** Installed features are kept per SDK version, because the pins belong to the SDK build. */
export function getSdkVersion(): string {
  const version = readPackageVersion('@mastra/code-sdk');
  if (!version) throw new Error('Could not read the @mastra/code-sdk version');
  return version;
}
