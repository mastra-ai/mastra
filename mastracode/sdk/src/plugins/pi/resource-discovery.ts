import fs from 'node:fs';
import path from 'node:path';

import type { PiPackageResourceManifest } from '../types.js';
import type { PiPackageManifest, PiPackageResourceType } from './package-manifest.js';

const EXTENSION_PATTERN = /\.(?:[cm]?[jt]s)$/;

export function discoverPiPackageResources(manifest: PiPackageManifest): PiPackageResourceManifest {
  const resources: PiPackageResourceManifest = { extensions: [], skills: [], prompts: [], themes: [] };
  if (manifest.resourcePatterns) {
    for (const resourceType of Object.keys(resources) as PiPackageResourceType[]) {
      resources[resourceType] = discoverExplicitResources(
        manifest.packageRoot,
        resourceType,
        manifest.resourcePatterns[resourceType] ?? [],
      );
    }
  } else {
    resources.extensions = discoverConventionalResources(manifest.packageRoot, 'extensions');
    resources.skills = discoverConventionalResources(manifest.packageRoot, 'skills');
    resources.prompts = discoverConventionalResources(manifest.packageRoot, 'prompts');
    resources.themes = discoverConventionalResources(manifest.packageRoot, 'themes');
  }
  return resources;
}

function discoverExplicitResources(
  packageRoot: string,
  resourceType: PiPackageResourceType,
  patterns: string[],
): string[] {
  const includePatterns = patterns.filter(pattern => !pattern.startsWith('!'));
  const excludePatterns = patterns.filter(pattern => pattern.startsWith('!')).map(pattern => pattern.slice(1));
  for (const pattern of [...includePatterns, ...excludePatterns]) assertContainedPattern(pattern, resourceType);
  const candidates = new Set<string>();

  for (const pattern of includePatterns) {
    assertContainedPattern(pattern, resourceType);
    if (hasGlobMagic(pattern)) {
      for (const match of fs.globSync(normalizePattern(pattern), {
        cwd: packageRoot,
        exclude: ['node_modules/**', '.git/**'],
      })) {
        collectResourcePath(packageRoot, path.join(packageRoot, match), resourceType, candidates);
      }
      continue;
    }
    const candidate = path.resolve(packageRoot, normalizePattern(pattern));
    if (!fs.existsSync(candidate)) throw new Error(`Pi Package ${resourceType} path does not exist: ${pattern}`);
    collectResourcePath(packageRoot, candidate, resourceType, candidates);
  }

  return [...candidates]
    .filter(candidate => !excludePatterns.some(pattern => matchesResourcePattern(candidate, packageRoot, pattern)))
    .map(candidate => path.relative(packageRoot, candidate))
    .sort();
}

function discoverConventionalResources(packageRoot: string, resourceType: PiPackageResourceType): string[] {
  const root = path.join(packageRoot, resourceType);
  if (!fs.existsSync(root)) return [];
  const candidates = new Set<string>();
  collectResourcePath(packageRoot, root, resourceType, candidates, true);
  return [...candidates].map(candidate => path.relative(packageRoot, candidate)).sort();
}

function collectResourcePath(
  packageRoot: string,
  candidate: string,
  resourceType: PiPackageResourceType,
  output: Set<string>,
  conventional = false,
): void {
  const realRoot = fs.realpathSync(packageRoot);
  const realCandidate = fs.realpathSync(candidate);
  assertContained(realCandidate, realRoot, `Pi Package ${resourceType} resource escapes package root`);
  const stat = fs.lstatSync(candidate);
  if (stat.isSymbolicLink()) throw new Error(`Pi Package ${resourceType} resource cannot be a symlink: ${candidate}`);

  if (stat.isFile()) {
    if (isResourceFile(realCandidate, resourceType, packageRoot, conventional)) output.add(realCandidate);
    return;
  }
  if (!stat.isDirectory()) return;

  for (const entry of fs
    .readdirSync(realCandidate, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
    const entryPath = path.join(realCandidate, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Pi Package ${resourceType} resource cannot be a symlink: ${entryPath}`);
    if (entry.isDirectory()) {
      collectResourcePath(packageRoot, entryPath, resourceType, output, conventional);
    } else if (entry.isFile() && isResourceFile(entryPath, resourceType, packageRoot, conventional)) {
      output.add(entryPath);
    }
  }
}

function isResourceFile(
  filePath: string,
  resourceType: PiPackageResourceType,
  packageRoot: string,
  conventional: boolean,
): boolean {
  const name = path.basename(filePath);
  if (resourceType === 'extensions') return EXTENSION_PATTERN.test(name);
  if (resourceType === 'prompts') return name.endsWith('.md');
  if (resourceType === 'themes') return name.endsWith('.json');
  if (name === 'SKILL.md') return true;
  return conventional && name.endsWith('.md') && path.dirname(filePath) === path.join(packageRoot, 'skills');
}

function matchesResourcePattern(candidate: string, packageRoot: string, pattern: string): boolean {
  assertContainedPattern(pattern, 'resource exclusion');
  const normalized = normalizePattern(pattern);
  const relative = toPosixPath(path.relative(packageRoot, candidate));
  if (hasGlobMagic(normalized)) return path.matchesGlob(relative, normalized);
  return relative === normalized || relative.startsWith(`${normalized}/`);
}

function assertContainedPattern(pattern: string, label: string): void {
  const normalized = normalizePattern(pattern);
  if (path.isAbsolute(normalized) || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`Pi Package ${label} pattern must stay inside the package root: ${pattern}`);
  }
}

function assertContained(candidate: string, root: string, message: string): void {
  if (candidate !== root && !candidate.startsWith(root + path.sep)) throw new Error(message);
}

function normalizePattern(pattern: string): string {
  const withoutDot = pattern.startsWith('./') ? pattern.slice(2) : pattern;
  return toPosixPath(path.normalize(withoutDot));
}

function hasGlobMagic(pattern: string): boolean {
  return /[*?{}[\]]/.test(pattern);
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}
