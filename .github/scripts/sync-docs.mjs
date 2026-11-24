#!/usr/bin/env node

// Mirrors docs directories of this monorepo into external docs repos, as listed
// in .github/docs-sync.json. Each target's `dest` directory is fully owned by
// the sync: files missing from `source` are deleted there. With `--target all`
// (what the workflow runs on push), targets that share a repo (one site with
// several docs sections) are synced in a single commit, so cross-section links
// never deploy half-updated. A named `--target` syncs only that section and
// leaves its siblings as they are.
//
// Usage:
//   node sync-docs.mjs --target <name|all> --into <dir>   mirror into a local checkout, no git
//   node sync-docs.mjs --target <name|all> --push         clone the target repo, commit, push
//
// --push relies on ambient git credentials (in CI: ./.github/actions/app-auth,
// which writes the app token to ~/.netrc). Remote URLs never contain a token.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MANIFEST_PATH = path.join(ROOT_DIR, '.github', 'docs-sync.json');
const MAX_PUSH_ATTEMPTS = 3;

const NAME_RE = /^[a-z0-9-]+$/;
const REPO_RE = /^mastra-ai\/[\w.-]+$/;
const BRANCH_RE = /^[\w./-]+$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const ROUTE_BASE_RE = /^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/;

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value === '' || value.includes('\\') || path.posix.isAbsolute(value)) return false;
  const segments = value.split('/');
  return segments.every(segment => segment !== '' && segment !== '.' && segment !== '..');
}

function containsMdx(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).some(entry => {
    if (entry.isDirectory()) return containsMdx(path.join(dir, entry.name));
    return entry.isFile() && entry.name.endsWith('.mdx');
  });
}

/**
 * Validates the manifest and returns its targets. Throws one error listing every problem.
 */
export function validateManifest(manifest, { rootDir = ROOT_DIR } = {}) {
  const errors = [];
  const targets = manifest?.targets;
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new Error('Invalid docs sync manifest: "targets" must be a non-empty array');
  }

  const names = new Set();
  targets.forEach((target, index) => {
    const label = `targets[${index}]${typeof target?.name === 'string' ? ` (${target.name})` : ''}`;
    if (!target || typeof target !== 'object') {
      errors.push(`${label}: must be an object`);
      return;
    }
    const { name, source, repo, branch, dest, routeBasePath } = target;

    if (typeof name !== 'string' || !NAME_RE.test(name)) errors.push(`${label}: "name" must match ${NAME_RE}`);
    else if (names.has(name)) errors.push(`${label}: duplicate name "${name}"`);
    else names.add(name);

    if (typeof repo !== 'string' || !REPO_RE.test(repo) || /\/\.\.?$/.test(repo)) {
      errors.push(`${label}: "repo" must match ${REPO_RE}`);
    }

    if (
      typeof branch !== 'string' ||
      !BRANCH_RE.test(branch) ||
      branch.startsWith('-') ||
      branch.includes('..') ||
      branch.endsWith('/')
    ) {
      errors.push(`${label}: "branch" must be a plain branch name`);
    }

    if (routeBasePath !== undefined && (typeof routeBasePath !== 'string' || !ROUTE_BASE_RE.test(routeBasePath))) {
      errors.push(`${label}: "routeBasePath" must be "/" or a path like "/reference"`);
    }

    if (!isSafeRelativePath(dest) || dest.split('/')[0] === '.git') {
      errors.push(`${label}: "dest" must be a non-empty relative path without "." or ".." segments, outside .git`);
    }

    if (!isSafeRelativePath(source) || !source.startsWith('docs/src/')) {
      errors.push(`${label}: "source" must be a relative path under docs/src/ without "." or ".." segments`);
    } else {
      const sourceDir = path.join(rootDir, source);
      if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
        errors.push(`${label}: "source" directory ${source} does not exist`);
      } else if (!containsMdx(sourceDir)) {
        errors.push(`${label}: "source" directory ${source} contains no .mdx files`);
      }
    }
  });

  const overlaps = (a, b) =>
    typeof a === 'string' && typeof b === 'string' && (a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`));
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const a = targets[i];
      const b = targets[j];
      const pair = `targets[${i}] and targets[${j}]`;
      if (a?.repo !== b?.repo) continue;
      // Within one site, a page must belong to exactly one section.
      if (overlaps(a?.source, b?.source)) errors.push(`${pair}: overlapping "source" in ${a.repo}`);
      // Overlapping dirs in one repo would delete each other's files.
      if (overlaps(a?.dest, b?.dest)) errors.push(`${pair}: overlapping "dest" in ${a.repo}`);
      if (a?.branch !== b?.branch) errors.push(`${pair}: same repo ${a.repo} needs the same "branch"`);
      const routeA = a?.routeBasePath ?? '/';
      const routeB = b?.routeBasePath ?? '/';
      if (routeA === routeB) {
        errors.push(`${pair}: same "routeBasePath" in ${a.repo}`);
      } else if (routeA !== '/' && routeB !== '/' && overlaps(routeA, routeB)) {
        // Nested section bases (e.g. /reference and /reference/api) can produce the same route from both sections.
        errors.push(`${pair}: nested "routeBasePath" ${routeA} and ${routeB} in ${a.repo}`);
      }
    }
  }

  if (errors.length > 0) throw new Error(`Invalid docs sync manifest:\n  ${errors.join('\n  ')}`);
  return targets;
}

// Directory entries are never followed through symlinks. With `allEntries`, symlinks and other non-directories are
// listed too, so mirroring removes them from dest instead of writing through them.
function listFiles(dir, { allEntries = false } = {}, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, { allEntries }, base);
    return entry.isFile() || allEntries ? [path.relative(base, full)] : [];
  });
}

function assertNoSymlinks(withinDir, destDir) {
  let current = withinDir;
  for (const segment of path.relative(withinDir, destDir).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (fs.lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink()) {
      throw new Error(`Refusing to sync through symlink ${current}`);
    }
  }
}

function removeEmptyDirs(dir, keepRoot = true) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name), false);
  }
  if (!keepRoot && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
}

/**
 * Makes `destDir` an exact copy of the regular files in `sourceDir`. With `withinDir` (the checkout `destDir` lives
 * in), refuses when a path segment between them is a symlink, so the target repo can't redirect writes elsewhere.
 */
export function mirror(sourceDir, destDir, { withinDir } = {}) {
  if (withinDir) assertNoSymlinks(withinDir, destDir);
  const sourceFiles = new Set(listFiles(sourceDir));
  const result = { added: 0, updated: 0, deleted: 0 };

  for (const file of listFiles(destDir, { allEntries: true })) {
    if (!sourceFiles.has(file)) {
      fs.rmSync(path.join(destDir, file));
      result.deleted++;
    }
  }
  removeEmptyDirs(destDir);

  for (const file of sourceFiles) {
    const from = path.join(sourceDir, file);
    const to = path.join(destDir, file);
    const content = fs.readFileSync(from);
    const existing = fs.lstatSync(to, { throwIfNoEntry: false });
    if (!existing) {
      result.added++;
    } else if (existing.isFile() && fs.readFileSync(to).equals(content)) {
      continue;
    } else {
      result.updated++;
      if (!existing.isFile()) fs.rmSync(to);
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, content);
  }
  return result;
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function formatResult(name, { added, updated, deleted }) {
  return `${name}: added ${added}, updated ${updated}, deleted ${deleted}`;
}

/**
 * Clones the repo shared by `targets`, mirrors each `source` into its `dest`, and pushes one commit if anything
 * changed. On a rejected push, resets to the remote branch and mirrors again (up to MAX_PUSH_ATTEMPTS).
 */
export async function syncRepo({ targets, remoteUrl, sha, beforePush, rootDir = ROOT_DIR, log = console.log }) {
  if (!SHA_RE.test(sha)) throw new Error(`Invalid source commit sha: ${sha}`);
  const { repo, branch } = targets[0];
  if (targets.some(target => target.repo !== repo || target.branch !== branch)) {
    throw new Error('syncRepo targets must share one repo and branch');
  }
  const dests = targets.map(target => target.dest);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-sync-'));

  try {
    git(workDir, 'clone', '--quiet', '--depth', '1', '--branch', branch, '--', remoteUrl, 'repo');
    const repoDir = path.join(workDir, 'repo');

    for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
      for (const target of targets) {
        const result = mirror(path.join(rootDir, target.source), path.join(repoDir, target.dest), {
          withinDir: repoDir,
        });
        log(formatResult(target.name, result));
      }
      if (git(repoDir, 'status', '--porcelain', '--', ...dests) === '') {
        log(`${repo}: no changes`);
        return { status: 'unchanged' };
      }

      git(repoDir, 'add', '--all', '--', ...dests);
      git(
        repoDir,
        'commit',
        '--quiet',
        '-m',
        `docs: sync from mastra-ai/mastra@${sha.slice(0, 7)}`,
        '-m',
        `Source: https://github.com/mastra-ai/mastra/commit/${sha}`,
      );

      if (attempt === 1 && beforePush) await beforePush();
      try {
        git(repoDir, 'push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`);
        log(`${repo}: pushed to ${branch}`);
        return { status: 'pushed', attempts: attempt };
      } catch (error) {
        if (attempt === MAX_PUSH_ATTEMPTS) throw error;
        log(`${repo}: push rejected (attempt ${attempt}), resetting to the remote branch and retrying`);
        git(repoDir, 'fetch', '--quiet', '--depth', '1', 'origin', branch);
        git(repoDir, 'reset', '--quiet', '--hard', 'FETCH_HEAD');
      }
    }
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

// Always the checked-out commit, never GITHUB_SHA: a re-run of an old workflow run keeps its original GITHUB_SHA,
// while the workflow checks out the current main so it can't publish stale docs.
function sourceSha(rootDir) {
  return git(rootDir, 'rev-parse', 'HEAD');
}

/**
 * CLI entry point. Returns the process exit code.
 */
export async function main({
  argv = process.argv.slice(2),
  rootDir = ROOT_DIR,
  manifestPath = MANIFEST_PATH,
  remoteUrl = repo => `https://github.com/${repo}.git`,
  log = console.log,
  logError = console.error,
} = {}) {
  const { values } = parseArgs({
    args: argv,
    options: { target: { type: 'string' }, into: { type: 'string' }, push: { type: 'boolean' } },
  });
  if (!values.target || Boolean(values.into) === Boolean(values.push)) {
    logError('Usage: sync-docs.mjs --target <name|all> (--into <dir> | --push)');
    return 2;
  }

  const targets = validateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')), { rootDir });
  const selected = values.target === 'all' ? targets : targets.filter(target => target.name === values.target);
  if (selected.length === 0) {
    logError(`Unknown target "${values.target}". Known: ${targets.map(target => target.name).join(', ')}`);
    return 2;
  }

  if (values.into) {
    // A local dir is one checkout of one site; mirroring two sites into it would overwrite one with the other.
    const repos = new Set(selected.map(target => target.repo));
    if (repos.size > 1) {
      logError(`--into takes one site, but "${values.target}" spans ${[...repos].join(', ')}. Pass a target name.`);
      return 2;
    }
    for (const target of selected) {
      const into = path.resolve(values.into);
      const result = mirror(path.join(rootDir, target.source), path.join(into, target.dest), { withinDir: into });
      log(formatResult(target.name, result));
    }
    return 0;
  }

  const sha = sourceSha(rootDir);
  const byRepo = Map.groupBy(selected, target => target.repo);
  const failed = [];
  for (const [repo, targets] of byRepo) {
    try {
      await syncRepo({ targets, remoteUrl: remoteUrl(repo), sha, rootDir, log });
    } catch (error) {
      failed.push(repo);
      logError(`${repo}: sync failed: ${error.stderr?.toString().trim() || error.message}`);
    }
  }
  if (failed.length > 0) {
    logError(`Failed repos: ${failed.join(', ')}`);
    return 1;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
