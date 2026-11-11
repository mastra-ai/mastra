// Regression check for the E2E MCP compatibility job on version-packages PRs (#29938, #27054).
//
// A version-packages PR bumps @mastra/core's workspace dependencies (e.g. @mastra/schema-compat)
// to versions that are only published after the PR merges. The old compat.sh packed core alone,
// so installing it asked npmjs for those versions and failed with ERR_PNPM_NO_MATCHING_VERSION.
//
// This puts the checkout in that state for real: it adds a patch changeset for each of core's
// workspace dependencies, runs the same `pnpm changeset-cli version` as the version-packages
// workflow, checks that the bumped dependency versions are not on npmjs, then runs compat.sh.
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
// A unique name: in pre mode, .changeset/pre.json records consumed changesets by name and skips them.
writeFileSync(
  join(root, `.changeset/mcp-compat-version-packages-regression-${Date.now()}.md`),
  `---\n${workspaceDeps.map(name => `'${name}': patch`).join('\n')}\n---\n\nMCP compat regression check: simulate a version-packages PR.\n`,
);
execFileSync('pnpm', ['changeset-cli', 'version'], { cwd: root, stdio: 'inherit' });

for (const name of workspaceDeps) {
  const version = versionOf(name);
  if (version === before[name]) {
    throw new Error(`changeset version did not bump ${name} (still ${version})`);
  }
  const response = await fetch(`https://registry.npmjs.org/${name}/${version}`);
  if (response.status !== 404) {
    throw new Error(
      `${name}@${version} is not an unpublished version on npmjs (HTTP ${response.status}), so this does not reproduce a version-packages PR`,
    );
  }
  console.log(`${name}: ${before[name]} -> ${version} (not on npmjs)`);
}
console.log(`@mastra/core: ${before['@mastra/core']} -> ${versionOf('@mastra/core')}`);

const result = spawnSync('bash', [join(here, 'compat.sh')], { cwd: root, stdio: 'inherit' });
process.exit(result.status ?? 1);
