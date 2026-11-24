// Regression check for the E2E MCP compatibility job on version-packages PRs (#29938, #27054).
//
// A version-packages PR bumps @mastra/core's workspace dependencies (e.g. @mastra/schema-compat)
// to versions that are only published after the PR merges. The old compat.sh packed core alone,
// so installing it asked npmjs for those versions and failed with ERR_PNPM_NO_MATCHING_VERSION.
//
// This puts the checkout in that state for real: it adds a patch changeset for each of core's
// workspace dependencies, runs the same `pnpm changeset-cli version` as the version-packages
// workflow (again while a bumped version is already on npmjs, as on a branch behind the latest
// release), then runs compat.sh.
//
// It rewrites package.json files, changelogs and .changeset/ in place, so it only runs in GitHub
// Actions or with --force in a disposable checkout (e.g. `git worktree add`).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const root = join(here, '../../..');

if (process.env.GITHUB_ACTIONS !== 'true' && !process.argv.includes('--force')) {
  console.error(
    'This versions every pending changeset in the checkout. Run it in GitHub Actions, or with --force in a disposable checkout.',
  );
  process.exit(2);
}

const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const packagePaths = new Map(
  JSON.parse(execFileSync('pnpm', ['ls', '-r', '--depth', '-1', '--json'], { cwd: root, encoding: 'utf8' })).map(
    pkg => [pkg.name, pkg.path],
  ),
);
const versionOf = name => readJson(join(packagePaths.get(name), 'package.json')).version;

const core = readJson(join(root, 'packages/core/package.json'));
const workspaceDeps = Object.entries(core.dependencies ?? {})
  .filter(([, spec]) => spec.startsWith('workspace:'))
  .map(([name]) => name);
if (workspaceDeps.length === 0) {
  console.error('@mastra/core has no workspace dependencies, so there is nothing to reproduce.');
  process.exit(1);
}

const before = Object.fromEntries([...workspaceDeps, '@mastra/core'].map(name => [name, versionOf(name)]));

const isOnNpm = async (name, version) => {
  const response = await fetch(`https://registry.npmjs.org/${name}/${version}`);
  if (response.status === 404) return false;
  if (response.ok) return true;
  throw new Error(`Could not check ${name}@${version} on npmjs (HTTP ${response.status})`);
};

// A branch that is behind main's latest release bumps to versions main already published
// (e.g. alpha.1 -> alpha.2 after alpha.2 shipped). Version again until every bumped
// dependency is unpublished, as it is on a real version-packages PR.
const MAX_ROUNDS = 10;
let published = workspaceDeps;
for (let round = 1; published.length > 0; round++) {
  if (round > MAX_ROUNDS) {
    throw new Error(
      `Still on npmjs after ${MAX_ROUNDS} version rounds: ${published.map(name => `${name}@${versionOf(name)}`).join(', ')}`,
    );
  }
  // A unique name: in pre mode, .changeset/pre.json records consumed changesets by name and skips them.
  writeFileSync(
    join(root, `.changeset/mcp-compat-version-packages-regression-${Date.now()}-${round}.md`),
    `---\n${published.map(name => `'${name}': patch`).join('\n')}\n---\n\nMCP compat regression check: simulate a version-packages PR.\n`,
  );
  const previous = Object.fromEntries(published.map(name => [name, versionOf(name)]));
  execFileSync('pnpm', ['changeset-cli', 'version'], { cwd: root, stdio: 'inherit' });

  const stillPublished = [];
  for (const name of published) {
    const version = versionOf(name);
    if (version === previous[name]) {
      throw new Error(`changeset version did not bump ${name} (still ${version})`);
    }
    if (await isOnNpm(name, version)) {
      console.log(`${name}@${version} is already on npmjs; versioning again`);
      stillPublished.push(name);
    }
  }
  published = stillPublished;
}

for (const name of workspaceDeps) {
  console.log(`${name}: ${before[name]} -> ${versionOf(name)} (not on npmjs)`);
}
console.log(`@mastra/core: ${before['@mastra/core']} -> ${versionOf('@mastra/core')}`);

const result = spawnSync('bash', [join(here, 'compat.sh')], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
