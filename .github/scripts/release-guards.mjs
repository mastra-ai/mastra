#!/usr/bin/env node

// Guards for npm-publish.yml: alphas and stables only come from the open
// release branch, and stable is the tested alpha plus one version commit.
//
// Usage:
//   node release-guards.mjs branch --ref <branch> [--remote origin]
//     The ref is `release/*` and the only `release/*` branch on the remote.
//   node release-guards.mjs checks --sha <sha>
//     Every commit status and check run on <sha> succeeded, ignoring runs of
//     npm-publish.yml itself (this job, earlier publish attempts).
//   node release-guards.mjs alpha --sha <sha> [--registry <url>]
//     Finds the alpha commit stable builds on: <sha> while it still holds
//     .changeset/pre.json, otherwise its parent (a rerun after the stable
//     version commit was pushed; that commit must only touch version files).
//     The alpha commit only changes version files over its parent, every
//     non-private package version at it is on npm, and a prerelease run of
//     npm-publish.yml succeeded for it — so a cherry-pick with no changeset,
//     which leaves the versions alone, is refused even if a prerelease run
//     (which published nothing) succeeded on it.
//     Writes alpha_sha and versioned (whether <sha> is already the stable
//     version commit) to $GITHUB_OUTPUT.
//   node release-guards.mjs stable-head --sha <sha> --ref <branch> [--remote origin]
//     The commit a stable run builds on: <sha> while it is still the branch
//     head, or the head when it sits directly on <sha> (the version commit an
//     earlier attempt of a re-run pushed). Refuses when the branch moved any
//     other way. Writes sha to $GITHUB_OUTPUT.
//   node release-guards.mjs diff --base <sha>
//     The working tree and commits since <sha> only touch package.json,
//     CHANGELOG.md and .changeset/.
//   node release-guards.mjs published [--registry <url>]
//     Every non-private workspace package version is on npm.
//   node release-guards.mjs move-latest [--versions <name@version,...>] [--registry <url>] [--dry-run]
//     Points `latest` at every non-private workspace package version (or at the
//     given versions, for a rollback) with `npm dist-tag add`, one package at a
//     time, skipping packages already there. A rerun finishes a partial move.
//
// GitHub API calls use GITHUB_API_URL, GITHUB_REPOSITORY and GITHUB_TOKEN.
// Exit codes: 0 = allowed, 1 = refused, 2 = usage or unexpected error.

import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org';
const PUBLISH_WORKFLOW = 'npm-publish.yml';
const RELEASE_PREFIX = 'release/';
const VERSION_FILES = [/(^|\/)package\.json$/, /(^|\/)CHANGELOG\.md$/, /^\.changeset\//];

class Refusal extends Error {}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = { command, remote: 'origin', registry: DEFAULT_REGISTRY, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (['--ref', '--remote', '--sha', '--base', '--registry', '--versions'].includes(arg) && rest[i + 1]) {
      options[arg.slice(2)] = rest[++i];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

function setOutput(values) {
  for (const [key, value] of Object.entries(values)) {
    console.log(`${key}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

async function github(pathname) {
  const api = process.env.GITHUB_API_URL ?? 'https://api.github.com';
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) throw new Error('GITHUB_REPOSITORY is not set');
  const response = await fetch(`${api}/repos/${repo}${pathname}`, {
    headers: {
      accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub ${pathname}: ${response.status} ${await response.text()}`);
  return response.json();
}

// Follows `page` until a page comes back short; GitHub caps per_page at 100.
async function githubAll(pathname, key) {
  const items = [];
  for (let page = 1; ; page++) {
    const separator = pathname.includes('?') ? '&' : '?';
    const data = await github(`${pathname}${separator}per_page=100&page=${page}`);
    items.push(...data[key]);
    if (data[key].length < 100) return items;
  }
}

function checkBranch({ ref, remote }) {
  if (!ref?.startsWith(RELEASE_PREFIX)) {
    throw new Refusal(`${ref} is not a release branch; alphas and stables only publish from release/*.`);
  }
  const heads = git('ls-remote', '--heads', remote, `${RELEASE_PREFIX}*`)
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('\t')[1].replace('refs/heads/', ''));
  if (!heads.includes(ref)) throw new Refusal(`${ref} does not exist on ${remote}.`);
  if (heads.length > 1) {
    throw new Refusal(`More than one release branch is open (${heads.join(', ')}); only one may publish.`);
  }
  console.log(`${ref} is the only open release branch.`);
}

function stableHead({ sha, ref, remote }) {
  if (!sha || !ref) throw new Error('--sha and --ref are required');
  git('fetch', '--quiet', remote, `refs/heads/${ref}`);
  const head = git('rev-parse', 'FETCH_HEAD');
  const dispatched = git('rev-parse', sha);
  if (head !== dispatched && git('rev-parse', `${head}^`) !== dispatched) {
    throw new Refusal(
      `${ref} moved since ${dispatched} was dispatched (head ${head}); stable only ships the approved commit.`,
    );
  }
  if (head !== dispatched) console.log(`Re-run: building on the version commit ${head} an earlier attempt pushed.`);
  setOutput({ sha: head });
}

const publishRuns = sha => githubAll(`/actions/workflows/${PUBLISH_WORKFLOW}/runs?head_sha=${sha}`, 'workflow_runs');

async function checkChecks({ sha }) {
  if (!sha) throw new Error('--sha is required');
  const failures = [];
  const { statuses = [] } = await github(`/commits/${sha}/status`);
  for (const s of statuses) if (s.state !== 'success') failures.push(`status ${s.context}: ${s.state}`);

  // This job is itself a check run on <sha>, as is any earlier publish attempt.
  const ownSuites = new Set((await publishRuns(sha)).map(run => run.check_suite_id));
  const runs = (await githubAll(`/commits/${sha}/check-runs?filter=latest`, 'check_runs')).filter(
    run => !ownSuites.has(run.check_suite?.id),
  );
  if (runs.length === 0 && statuses.length === 0) failures.push('no checks have run on this commit');
  for (const run of runs) {
    if (run.status !== 'completed') failures.push(`check ${run.name}: ${run.status}`);
    else if (!['success', 'neutral', 'skipped'].includes(run.conclusion)) {
      failures.push(`check ${run.name}: ${run.conclusion}`);
    }
  }
  if (failures.length > 0) {
    throw new Refusal(`Checks on ${sha} are not green, so no alpha is published:\n  ${failures.join('\n  ')}`);
  }
  console.log(`All ${runs.length} check run(s) and ${statuses.length} status(es) on ${sha} passed.`);
}

// Non-private workspace packages, as { name, version }, read at `sha` (or the
// working tree). Version commits never move packages, so paths come from pnpm.
function workspacePackages(sha) {
  const root = git('rev-parse', '--show-toplevel');
  const listed = JSON.parse(
    execFileSync('pnpm', ['m', 'ls', '--depth', '-1', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }),
  );
  const packages = [];
  for (const { path: dir } of listed) {
    const file = path.relative(root, path.join(dir, 'package.json')).split(path.sep).join('/');
    let manifest;
    if (sha) {
      try {
        manifest = JSON.parse(git('show', `${sha}:${file}`));
      } catch {
        continue; // Added after the alpha commit, so not part of it.
      }
    } else manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
    if (!manifest.private && manifest.name) packages.push({ name: manifest.name, version: manifest.version });
  }
  return packages;
}

const encode = name => name.replaceAll('/', '%2f');

async function registryJson(url) {
  for (let attempt = 1; ; attempt++) {
    let failure;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (response.status === 404) {
        await response.body?.cancel();
        return undefined;
      }
      if (response.ok) return response.json();
      await response.body?.cancel();
      failure = `${url}: ${response.status}`;
      if (response.status < 500 && response.status !== 429) throw new Error(failure);
    } catch (error) {
      if (error.message === failure) throw error;
      failure = `${url}: ${error.message}`;
    }
    if (attempt === 3) throw new Error(failure);
    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
  }
}

async function unpublished(registry, packages) {
  const missing = [];
  for (const pkg of packages) {
    const found = await registryJson(`${registry}/${encode(pkg.name)}/${encodeURIComponent(pkg.version)}`);
    if (!found) missing.push(`${pkg.name}@${pkg.version}`);
  }
  return missing;
}

function changedFiles(base, head) {
  const committed = git('diff', '--name-only', base, ...(head ? [head] : []));
  const untracked = head ? '' : git('ls-files', '--others', '--exclude-standard');
  return [...new Set([...committed.split('\n'), ...untracked.split('\n')].filter(Boolean))];
}

function assertVersionOnly(base, head) {
  const outside = changedFiles(base, head).filter(file => !VERSION_FILES.some(pattern => pattern.test(file)));
  if (outside.length > 0) {
    throw new Refusal(
      `Stable may only differ from the alpha commit ${base} in package.json, CHANGELOG.md and .changeset/; it also changes:\n  ${outside.join('\n  ')}`,
    );
  }
}

function holdsPreJson(sha) {
  try {
    git('cat-file', '-e', `${sha}:.changeset/pre.json`);
    return true;
  } catch {
    return false;
  }
}

async function checkAlpha({ sha, registry }) {
  if (!sha) throw new Error('--sha is required');
  const versioned = !holdsPreJson(sha);
  const alpha = git('rev-parse', versioned ? `${sha}^` : sha);
  if (versioned) {
    if (!holdsPreJson(alpha)) {
      throw new Refusal(`Neither ${sha} nor its parent is in prerelease mode; there is no alpha to promote.`);
    }
    assertVersionOnly(alpha, sha);
  }

  // An alpha is a version commit on top of the code it publishes. A prerelease run on a code-only
  // commit (a cherry-pick without a changeset) succeeds while publishing nothing new.
  const code = changedFiles(`${alpha}^`, alpha).filter(file => !VERSION_FILES.some(pattern => pattern.test(file)));
  if (code.length > 0) {
    throw new Refusal(
      `${alpha} is not a version commit (it changes ${code.join(', ')}), so no alpha published its code. Add a changeset so the branch is re-versioned, and publish that alpha.`,
    );
  }

  const missing = await unpublished(registry, workspacePackages(alpha));
  if (missing.length > 0) {
    throw new Refusal(
      `Stable only promotes a published alpha, and ${alpha} has versions that are not on npm:\n  ${missing.join('\n  ')}`,
    );
  }
  const runs = await publishRuns(alpha);
  const alphaPublished = runs.some(
    run =>
      run.event === 'workflow_dispatch' &&
      run.conclusion === 'success' &&
      // The exact run-name of a prerelease publish; `enter-prerelease` runs publish nothing.
      /^npm publish prerelease on release\//.test(run.display_title ?? ''),
  );
  if (!alphaPublished) {
    throw new Refusal(
      `No successful prerelease publish ran on ${alpha}. The branch moved after the last alpha (a commit without a changeset changes code but no version); publish an alpha of this commit first.`,
    );
  }
  setOutput({ alpha_sha: alpha, versioned });
}

async function checkPublished({ registry }) {
  const packages = workspacePackages();
  const missing = await unpublished(registry, packages);
  if (missing.length > 0) throw new Refusal(`Not on npm yet:\n  ${missing.join('\n  ')}`);
  console.log(`All ${packages.length} package version(s) are on npm.`);
}

function parseVersions(list) {
  return list
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(spec => {
      const at = spec.lastIndexOf('@');
      if (at <= 0) throw new Error(`Expected <name>@<version>, got ${spec}`);
      return { name: spec.slice(0, at), version: spec.slice(at + 1) };
    });
}

async function moveLatest({ versions, registry, dryRun }) {
  const packages = versions ? parseVersions(versions) : workspacePackages();
  if (versions) {
    const missing = await unpublished(registry, packages);
    if (missing.length > 0) {
      throw new Refusal(`Cannot point latest at versions npm does not have:\n  ${missing.join('\n  ')}`);
    }
  }
  let moved = 0;
  const failed = [];
  for (const pkg of packages) {
    const tags = await registryJson(`${registry}/-/package/${encode(pkg.name)}/dist-tags`);
    if (tags?.latest === pkg.version) continue;
    const id = `${pkg.name}@${pkg.version}`;
    const change = `${pkg.name} ${tags?.latest ?? '(none)'} -> ${pkg.version}`;
    if (dryRun) {
      console.log(`Would move latest: ${change}`);
      moved++;
      continue;
    }
    try {
      execFileSync('npm', ['dist-tag', 'add', id, 'latest', '--registry', registry], { stdio: 'pipe' });
      console.log(`latest: ${change}`);
      moved++;
    } catch (error) {
      failed.push(id);
      console.log(`::error::npm dist-tag add ${id} latest failed\n${error.stderr?.toString() ?? error.message}`);
    }
  }
  console.log(`Moved latest for ${moved} package(s); ${packages.length - moved - failed.length} were already there.`);
  if (failed.length > 0) throw new Refusal(`latest did not move for: ${failed.join(', ')}. Rerun to finish the move.`);
}

const commands = {
  branch: checkBranch,
  checks: checkChecks,
  alpha: checkAlpha,
  'stable-head': stableHead,
  diff: ({ base }) => {
    if (!base) throw new Error('--base is required');
    assertVersionOnly(base);
    console.log(`Only version files changed since ${base}.`);
  },
  published: checkPublished,
  'move-latest': moveLatest,
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const command = commands[options.command];
  if (!command) throw new Error(`Unknown command: ${options.command ?? '(none)'}`);
  await command(options);
}

main().catch(error => {
  if (error instanceof Refusal) {
    console.log(`::error::${error.message.split('\n')[0]}`);
    console.log(error.message);
    process.exit(1);
  }
  console.error(error.message);
  process.exit(2);
});
