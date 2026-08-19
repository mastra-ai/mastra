import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { execa } from 'execa';

import type { PluginInstallExecutionOptions } from '../dependencies.js';
import { getPluginScopePaths } from '../paths.js';
import type { PluginPathOptions } from '../paths.js';
import type { PiPackageResolution, PluginScope } from '../types.js';
import { inspectPiPackageManifest } from './package-manifest.js';

export interface ResolvePiPackageOptions extends PluginPathOptions, PluginInstallExecutionOptions {
  npmCliPath?: string;
  gitCliPath?: string;
  tarCliPath?: string;
}

export interface PreparedPiPackage {
  specifier: string;
  scope: PluginScope;
  resolution: PiPackageResolution;
}

interface NpmMetadata {
  name: string;
  version: string;
  integrity: string;
}

const NON_INTERACTIVE_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0', npm_config_ignore_scripts: 'true' };

export async function resolvePiPackageSource(
  specifier: string,
  scope: PluginScope,
  options: ResolvePiPackageOptions,
): Promise<PreparedPiPackage> {
  const trimmed = specifier.trim();
  if (!trimmed) throw new Error('Pi Package source cannot be empty');
  if (trimmed.startsWith('npm:')) return resolveNpmPackage(trimmed, scope, options);
  if (isGitSpecifier(trimmed)) return resolveGitPackage(trimmed, scope, options);
  return resolveLocalPackage(trimmed, scope, options);
}

async function resolveNpmPackage(
  specifier: string,
  scope: PluginScope,
  options: ResolvePiPackageOptions,
): Promise<PreparedPiPackage> {
  const requested = specifier.slice('npm:'.length);
  const requestedIdentity = parseExactNpmSpecifier(requested);
  const npm = options.npmCliPath ?? 'npm';
  const metadataResult = await runCommand(
    npm,
    ['view', requested, 'name', 'version', 'dist.integrity', '--json'],
    { env: NON_INTERACTIVE_ENV },
    options,
  );
  const metadata = parseNpmMetadata(metadataResult.stdout);
  if (metadata.name !== requestedIdentity.name || metadata.version !== requestedIdentity.version) {
    throw new Error(
      `npm package identity mismatch: requested ${requested}, received ${metadata.name}@${metadata.version}`,
    );
  }
  const exactSpecifier = `${metadata.name}@${metadata.version}`;
  const stagingDir = createStagingDir(scope, options);
  try {
    const packResult = await runCommand(
      npm,
      ['pack', exactSpecifier, '--ignore-scripts', '--json', '--pack-destination', stagingDir],
      { env: NON_INTERACTIVE_ENV },
      options,
    );
    const archivePath = resolvePackedArchive(stagingDir, packResult.stdout);
    assertArchiveIntegrity(archivePath, metadata.integrity);
    await assertSafeTarArchive(archivePath, options.tarCliPath ?? 'tar', options);

    const extractedRoot = path.join(stagingDir, 'package');
    fs.mkdirSync(extractedRoot, { recursive: true });
    await runCommand(
      options.tarCliPath ?? 'tar',
      ['-xzf', archivePath, '--strip-components=1', '-C', extractedRoot],
      {},
      options,
    );
    assertNoPackageSymlinks(extractedRoot);
    const manifest = inspectPiPackageManifest(extractedRoot);
    if (manifest.name !== metadata.name || manifest.version !== metadata.version) {
      throw new Error(
        `Resolved npm package identity mismatch: expected ${exactSpecifier}, received ${manifest.name}@${manifest.version ?? 'unknown'}`,
      );
    }

    const finalRoot = getImmutablePackageRoot(
      scope,
      'npm',
      metadata.name,
      `${metadata.version}-${shortIdentity(metadata.integrity)}`,
      options,
    );
    promotePackage(extractedRoot, finalRoot);
    return {
      specifier,
      scope,
      resolution: {
        sourceType: 'npm',
        resolvedSpecifier: `npm:${exactSpecifier}`,
        sourceRoot: finalRoot,
        packageRoot: finalRoot,
        integrity: metadata.integrity,
        contentIntegrity: hashPackageDirectory(finalRoot),
        version: metadata.version,
      },
    };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

async function resolveGitPackage(
  specifier: string,
  scope: PluginScope,
  options: ResolvePiPackageOptions,
): Promise<PreparedPiPackage> {
  const { url, ref } = parseGitSpecifier(specifier);
  const git = options.gitCliPath ?? 'git';
  const stagingDir = createStagingDir(scope, options);
  const checkoutRoot = path.join(stagingDir, 'checkout');
  try {
    await runCommand(git, ['clone', '--no-checkout', url, checkoutRoot], { env: NON_INTERACTIVE_ENV }, options);
    const revision = ref ?? 'HEAD';
    const commitResult = await runCommand(
      git,
      ['-C', checkoutRoot, 'rev-parse', '--verify', `${revision}^{commit}`],
      { env: NON_INTERACTIVE_ENV },
      options,
    );
    const commit = commitResult.stdout.trim();
    if (!/^[a-f0-9]{40,64}$/i.test(commit)) throw new Error(`Git source did not resolve to a commit: ${revision}`);
    await runCommand(git, ['-C', checkoutRoot, 'checkout', '--detach', commit], { env: NON_INTERACTIVE_ENV }, options);
    assertNoPackageSymlinks(checkoutRoot);
    inspectPiPackageManifest(checkoutRoot);
    fs.rmSync(path.join(checkoutRoot, '.git'), { recursive: true, force: true });
    const integrity = hashPackageDirectory(checkoutRoot);
    const finalRoot = getImmutablePackageRoot(scope, 'git', sourceDisplayName(url), commit, options);
    promotePackage(checkoutRoot, finalRoot);
    return {
      specifier,
      scope,
      resolution: {
        sourceType: 'git',
        resolvedSpecifier: `git:${url}@${commit}`,
        sourceRoot: finalRoot,
        packageRoot: finalRoot,
        integrity,
        contentIntegrity: integrity,
        commit,
      },
    };
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
}

function resolveLocalPackage(
  specifier: string,
  scope: PluginScope,
  options: ResolvePiPackageOptions,
): PreparedPiPackage {
  const sourceRoot = fs.realpathSync(path.resolve(options.projectRoot, specifier));
  if (scope === 'project') {
    const projectRoot = fs.realpathSync(options.projectRoot);
    assertContained(sourceRoot, projectRoot, 'Project Pi Package sources must be inside the project directory');
  }
  if (!fs.statSync(sourceRoot).isDirectory())
    throw new Error(`Local Pi Package source is not a directory: ${specifier}`);
  assertNoPackageSymlinks(sourceRoot);
  inspectPiPackageManifest(sourceRoot);
  const integrity = hashPackageDirectory(sourceRoot);
  const finalRoot = getImmutablePackageRoot(
    scope,
    'local',
    path.basename(sourceRoot),
    shortIdentity(integrity),
    options,
  );
  const stagingDir = createStagingDir(scope, options);
  const stagedRoot = path.join(stagingDir, 'package');
  try {
    copyPackageDirectory(sourceRoot, stagedRoot);
    assertNoPackageSymlinks(stagedRoot);
    if (hashPackageDirectory(stagedRoot) !== integrity) {
      throw new Error('Local Pi Package changed while it was being copied');
    }
    promotePackage(stagedRoot, finalRoot);
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }
  return {
    specifier,
    scope,
    resolution: {
      sourceType: 'local',
      resolvedSpecifier: `local:${sourceRoot}#${integrity}`,
      sourceRoot: finalRoot,
      packageRoot: finalRoot,
      integrity,
      contentIntegrity: integrity,
    },
  };
}

function parseExactNpmSpecifier(value: string): { name: string; version: string } {
  const separator = value.lastIndexOf('@');
  const name = separator > 0 ? value.slice(0, separator) : '';
  const version = separator > 0 ? value.slice(separator + 1) : '';
  if (!name || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('npm Pi Package sources must use an exact name@version specifier');
  }
  return { name, version };
}

function parseNpmMetadata(stdout: string): NpmMetadata {
  const parsed = JSON.parse(stdout) as unknown;
  if (!isRecord(parsed)) throw new Error('npm returned invalid package metadata');
  const integrity = parsed['dist.integrity'];
  if (
    typeof parsed.name !== 'string' ||
    !parsed.name ||
    typeof parsed.version !== 'string' ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(parsed.version) ||
    typeof integrity !== 'string' ||
    !integrity.startsWith('sha512-')
  ) {
    throw new Error('npm package metadata must include an exact version and sha512 integrity');
  }
  return { name: parsed.name, version: parsed.version, integrity };
}

function resolvePackedArchive(stagingDir: string, stdout: string): string {
  const parsed = JSON.parse(stdout) as unknown;
  const filename = Array.isArray(parsed) && isRecord(parsed[0]) ? parsed[0].filename : undefined;
  if (typeof filename !== 'string' || !filename) throw new Error('npm pack did not return an archive filename');
  const archivePath = path.resolve(stagingDir, filename);
  assertContained(archivePath, stagingDir, 'npm pack archive escaped the staging directory');
  if (!fs.existsSync(archivePath) || !fs.statSync(archivePath).isFile()) {
    throw new Error(`npm pack archive does not exist: ${archivePath}`);
  }
  return archivePath;
}

function assertArchiveIntegrity(archivePath: string, expectedIntegrity: string): void {
  const actual = `sha512-${createHash('sha512').update(fs.readFileSync(archivePath)).digest('base64')}`;
  if (actual !== expectedIntegrity)
    throw new Error(`npm package integrity mismatch: expected ${expectedIntegrity}, received ${actual}`);
}

async function assertSafeTarArchive(archivePath: string, tar: string, options: ResolvePiPackageOptions): Promise<void> {
  const listing = await runCommand(tar, ['-tzf', archivePath], {}, options);
  const entries = listing.stdout.split('\n').filter(Boolean);
  if (entries.length === 0) throw new Error('npm package archive is empty');
  for (const entry of entries) {
    const normalized = path.posix.normalize(entry);
    if (
      path.posix.isAbsolute(entry) ||
      normalized === '..' ||
      normalized.startsWith('../') ||
      !normalized.startsWith('package/')
    ) {
      throw new Error(`npm package archive contains an unsafe path: ${entry}`);
    }
  }
  const verboseListing = await runCommand(tar, ['-tvzf', archivePath], {}, options);
  if (verboseListing.stdout.split('\n').some(line => line.startsWith('l') || line.startsWith('h'))) {
    throw new Error('npm package archive cannot contain symbolic or hard links');
  }
}

function parseGitSpecifier(specifier: string): { url: string; ref?: string } {
  if (specifier.startsWith('github:')) {
    const value = specifier.slice('github:'.length);
    const refIndex = value.lastIndexOf('@');
    const repository = refIndex > value.lastIndexOf('/') ? value.slice(0, refIndex) : value;
    const ref = refIndex > value.lastIndexOf('/') ? value.slice(refIndex + 1) : undefined;
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || (ref !== undefined && !ref)) {
      throw new Error(`Invalid GitHub Pi Package source: ${specifier}`);
    }
    return { url: `https://github.com/${repository.replace(/\.git$/, '')}.git`, ...(ref ? { ref } : {}) };
  }

  let value = specifier.startsWith('git:') ? specifier.slice('git:'.length) : specifier;
  const refIndex = value.lastIndexOf('@');
  const pathBoundary = Math.max(value.lastIndexOf('/'), value.startsWith('git@') ? value.indexOf(':') : -1);
  let ref: string | undefined;
  if (refIndex > pathBoundary) {
    ref = value.slice(refIndex + 1);
    value = value.slice(0, refIndex);
  }
  if (!value || /[\r\n\0]/.test(value) || (ref !== undefined && (!ref || /[\r\n\0]/.test(ref)))) {
    throw new Error(`Invalid git Pi Package source: ${specifier}`);
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) throw new Error('Git Pi Package URLs cannot contain embedded credentials');
  }
  return { url: value, ...(ref ? { ref } : {}) };
}

function isGitSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith('git:') ||
    specifier.startsWith('github:') ||
    specifier.startsWith('https://') ||
    specifier.startsWith('http://') ||
    specifier.startsWith('ssh://') ||
    specifier.startsWith('git://')
  );
}

function getImmutablePackageRoot(
  scope: PluginScope,
  sourceType: PiPackageResolution['sourceType'],
  identity: string,
  version: string,
  options: PluginPathOptions,
): string {
  const paths = getPluginScopePaths(scope, options);
  return path.join(paths.sourcesPath, 'pi-packages', sourceType, safePathSegment(identity), safePathSegment(version));
}

function createStagingDir(scope: PluginScope, options: PluginPathOptions): string {
  const paths = getPluginScopePaths(scope, options);
  const stagingRoot = path.join(paths.sourcesPath, 'pi-packages', '.staging');
  fs.mkdirSync(stagingRoot, { recursive: true, mode: 0o700 });
  return fs.mkdtempSync(path.join(stagingRoot, 'resolve-'));
}

function promotePackage(stagedRoot: string, finalRoot: string): void {
  const stagedIntegrity = hashPackageDirectory(stagedRoot);
  if (fs.existsSync(finalRoot)) {
    if (hashPackageDirectory(finalRoot) === stagedIntegrity) return;
    throw new Error(`Cached Pi Package integrity mismatch: ${finalRoot}`);
  }
  fs.mkdirSync(path.dirname(finalRoot), { recursive: true });
  try {
    fs.renameSync(stagedRoot, finalRoot);
  } catch (error) {
    if (fs.existsSync(finalRoot) && hashPackageDirectory(finalRoot) === stagedIntegrity) return;
    throw error;
  }
}

function copyPackageDirectory(sourceRoot: string, destinationRoot: string): void {
  fs.cpSync(sourceRoot, destinationRoot, {
    recursive: true,
    filter: source => {
      const relative = path.relative(sourceRoot, source);
      return (
        relative !== '.git' &&
        !relative.startsWith(`.git${path.sep}`) &&
        relative !== 'node_modules' &&
        !relative.startsWith(`node_modules${path.sep}`)
      );
    },
  });
}

export function hashPackageDirectory(packageRoot: string): string {
  const hash = createHash('sha512');
  for (const filePath of listPackageFiles(packageRoot)) {
    const relative = path.relative(packageRoot, filePath).split(path.sep).join('/');
    hash.update(relative).update('\0').update(fs.readFileSync(filePath)).update('\0');
  }
  return `sha512-${hash.digest('base64')}`;
}

export function hashMaterializedPackageDirectory(packageRoot: string): string {
  const hash = createHash('sha512');
  const visitedDirectories = new Set<string>();
  hashMaterializedEntry(packageRoot, '', hash, visitedDirectories);
  return `sha512-${hash.digest('base64')}`;
}

function hashMaterializedEntry(
  physicalPath: string,
  logicalPath: string,
  hash: ReturnType<typeof createHash>,
  visitedDirectories: Set<string>,
): void {
  const stats = fs.lstatSync(physicalPath);
  if (stats.isSymbolicLink()) {
    const linkTarget = fs.readlinkSync(physicalPath);
    hash.update(logicalPath).update('\0symlink\0').update(linkTarget).update('\0');
    const target = fs.realpathSync(physicalPath);
    hashMaterializedEntry(target, logicalPath, hash, visitedDirectories);
    return;
  }
  if (stats.isDirectory()) {
    const realDirectory = fs.realpathSync(physicalPath);
    if (visitedDirectories.has(realDirectory)) return;
    visitedDirectories.add(realDirectory);
    for (const entry of fs.readdirSync(physicalPath).sort()) {
      if (entry === '.git') continue;
      hashMaterializedEntry(
        path.join(physicalPath, entry),
        logicalPath ? `${logicalPath}/${entry}` : entry,
        hash,
        visitedDirectories,
      );
    }
    return;
  }
  if (stats.isFile()) {
    hash.update(logicalPath).update('\0').update(fs.readFileSync(physicalPath)).update('\0');
  }
}

function listPackageFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const entryPath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Pi Package source cannot contain symlinks: ${entryPath}`);
    if (entry.isDirectory()) files.push(...listPackageFiles(entryPath));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files.sort();
}

function assertNoPackageSymlinks(root: string): void {
  listPackageFiles(root);
}

function assertContained(candidate: string, root: string, message: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate !== resolvedRoot && !resolvedCandidate.startsWith(resolvedRoot + path.sep))
    throw new Error(message);
}

function safePathSegment(value: string): string {
  const normalized = value
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || shortIdentity(value);
}

function shortIdentity(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function sourceDisplayName(url: string): string {
  return `${url
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .filter(Boolean)
    .slice(-2)
    .join('-')}-${shortIdentity(url)}`;
}

async function runCommand(
  command: string,
  args: string[],
  executionOptions: { cwd?: string; env?: NodeJS.ProcessEnv },
  options: PluginInstallExecutionOptions,
): Promise<{ stdout: string }> {
  const child = execa(command, args, {
    ...executionOptions,
    cancelSignal: options.signal,
    stdout: 'pipe',
    stderr: options.onOutput ? 'pipe' : 'ignore',
  });
  if (options.onOutput) {
    child.stdout?.on('data', options.onOutput);
    child.stderr?.on('data', options.onOutput);
  }
  return child;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
