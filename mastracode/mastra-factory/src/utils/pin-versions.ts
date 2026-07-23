import fs from 'node:fs';
import path from 'node:path';

/**
 * Pin the template's Mastra dist-tag deps (`"latest"`) to exact versions at
 * scaffold time.
 *
 * Why: the Mastra packages ship as a coordinated set where published packages
 * pin exact internal versions (`@mastra/factory` -> `@mastra/code-sdk` ->
 * `@mastra/libsql`/`@mastra/core`/...). If the project's own deps stay as
 * floating `"latest"` specs, each one is resolved independently by the package
 * manager — and `--prefer-offline` installs resolve tags from *cached*
 * packument metadata. Around a release that yields a mixed graph: the root
 * gets yesterday's `latest` while `@mastra/factory` pulls today's exact pins,
 * duplicating the entire Mastra stack (two `@mastra/core` copies break
 * `instanceof` checks across packages).
 *
 * Fix: resolve every dist-tag fresh from the registry at one moment, then run
 * a consistency pass — anchor packages' exact pins win over tag resolution
 * (`@mastra/factory` decides `@mastra/code-sdk`; that `@mastra/code-sdk`
 * decides `@mastra/libsql`, `@mastra/pg`, `@mastra/core`, `@mastra/memory`,
 * ...). The generated project then installs one consistent, deduped set and
 * stays reproducible on later installs.
 */

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';

/**
 * Aggregator packages whose exact internal pins define the coordinated
 * version set. Order matters: `@mastra/factory` pins `@mastra/code-sdk`, so
 * it must be applied first for the code-sdk anchor to be read at the right
 * version.
 */
const ANCHOR_PACKAGES = ['@mastra/factory', '@mastra/code-sdk'];

const FETCH_TIMEOUT_MS = 30_000;

interface Packument {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, { dependencies?: Record<string, string> }>;
}

function isMastraPackage(name: string): boolean {
  return name === 'mastra' || name.startsWith('@mastra/');
}

/** A bare dist-tag like `latest` or `alpha` (not a semver range or protocol spec). */
function isDistTagSpec(spec: string): boolean {
  return /^[a-z][\w.-]*$/i.test(spec) && !/^v?\d/.test(spec);
}

function registryUrl(): string {
  const configured = process.env.npm_config_registry?.trim();
  return (configured || DEFAULT_REGISTRY).replace(/\/+$/, '');
}

async function fetchPackument(name: string): Promise<Packument> {
  const res = await fetch(`${registryUrl()}/${name}`, {
    headers: {
      // Abbreviated packument: dist-tags + per-version dependencies, much
      // smaller than the full document.
      accept: 'application/vnd.npm.install-v1+json',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch registry metadata for ${name}: HTTP ${res.status}`);
  }
  return (await res.json()) as Packument;
}

export interface PinResult {
  /** Package name -> exact version written into package.json. */
  pins: Record<string, string>;
}

/**
 * Rewrite Mastra dist-tag deps in `<projectPath>/package.json` to exact,
 * mutually consistent versions. No-op when the manifest has no Mastra
 * dist-tag deps. Throws on registry errors — the caller decides whether to
 * fall back to installing with tags.
 */
export async function pinMastraDependencies(projectPath: string): Promise<PinResult> {
  const manifestPath = path.join(projectPath, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  // name -> dist-tag spec, gathered across both dep sections.
  const targets = new Map<string, string>();
  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const [name, spec] of Object.entries<string>(manifest[section] ?? {})) {
      if (isMastraPackage(name) && isDistTagSpec(spec)) targets.set(name, spec);
    }
  }
  if (targets.size === 0) return { pins: {} };

  const packuments = new Map<string, Packument>();
  await Promise.all(
    [...targets.keys()].map(async name => {
      packuments.set(name, await fetchPackument(name));
    }),
  );

  // First pass: resolve each dist-tag to a concrete version.
  const pins: Record<string, string> = {};
  for (const [name, tag] of targets) {
    const version = packuments.get(name)?.['dist-tags']?.[tag];
    if (!version) {
      throw new Error(`Registry has no "${tag}" dist-tag for ${name}`);
    }
    pins[name] = version;
  }

  // Second pass: anchors' exact pins override tag resolution so the set is
  // internally consistent even if dist-tags are mid-flip during a release.
  for (const anchor of ANCHOR_PACKAGES) {
    const anchorVersion = pins[anchor];
    if (!anchorVersion) continue;
    const anchorDeps = packuments.get(anchor)?.versions?.[anchorVersion]?.dependencies ?? {};
    for (const [dep, depSpec] of Object.entries(anchorDeps)) {
      if (!(dep in pins)) continue;
      // Only exact version pins participate (ranges already dedupe).
      if (!/^\d/.test(depSpec)) continue;
      pins[dep] = depSpec;
    }
  }

  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      if (pins[name]) manifest[section][name] = pins[name];
    }
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { pins };
}
