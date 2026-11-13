// Test tiers: which test files and test jobs a PR runs.
//
// tiers.json lives on the ci/test-tiers branch and marks each test file, and each job tiered
// as a whole (`job:<key>`), `in` (runs on every PR that selects it) or `out` (runs only on
// full-suite runs: the versioning PR, main, a `full-tests` label, or a PR that edits the file
// or the job's own paths). Anything it doesn't list is `in`. Anything wrong with the file
// means nothing is dropped.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TIERS_VERSION = 1;

// One window for every tier rule: a file goes `out` after this many days without a
// failure, a catch or a versioning failure keeps it `in` this long, and a new file gets
// this long `in` before it can go `out`.
export const WINDOW_DAYS = 30;

// The same E2E predicates prebuild.yml applies to split its unit list from the package E2E
// list (E2E Test (packages/*)). Both lists are tiered per file; e2e-tests/ and playground
// suites are tiered per job instead.
export const isPackageE2eTest = file =>
  file.startsWith('packages/') &&
  (file.includes('.e2e.') ||
    file.startsWith('packages/evals/src/scorers/llm/') ||
    file.startsWith('packages/rag/src/'));
export const isExternalE2eTest = file => file.startsWith('e2e-tests/') || file.startsWith('packages/playground/e2e/');
export const isE2eTest = file => isPackageE2eTest(file) || isExternalE2eTest(file);

/** @returns {{ tiers: object | null, problem: string | null }} */
export function loadTiers(path) {
  let text;
  try {
    text = fs.readFileSync(path, 'utf8');
  } catch {
    return { tiers: null, problem: `${path} is missing` };
  }
  let tiers;
  try {
    tiers = JSON.parse(text);
  } catch (error) {
    return { tiers: null, problem: `${path} is not valid JSON (${error.message})` };
  }
  if (tiers?.version !== TIERS_VERSION) {
    return { tiers: null, problem: `${path} has version ${JSON.stringify(tiers?.version)}, expected ${TIERS_VERSION}` };
  }
  if (!tiers.files || typeof tiers.files !== 'object') {
    return { tiers: null, problem: `${path} has no files map` };
  }
  return { tiers, problem: null };
}

/**
 * @param {{ files: string[], tiers: object | null, problem?: string | null, changedFiles: string[], fullSuite: boolean, fullTestsLabel: boolean }} input
 * @returns {{ kept: string[], dropped: string[], reason: string }}
 */
export function selectUnitTests({ files, tiers, problem = null, changedFiles, fullSuite, fullTestsLabel }) {
  if (fullSuite) return { kept: files, dropped: [], reason: 'full suite runs every file' };
  if (fullTestsLabel) return { kept: files, dropped: [], reason: 'full-tests label runs every file' };
  if (!tiers)
    return { kept: files, dropped: [], reason: `no tiers, running every file: ${problem ?? 'tiers not loaded'}` };

  const changed = new Set(changedFiles);
  const kept = [];
  const dropped = [];
  for (const file of files) {
    if (tiers.files[file]?.tier === 'out' && !changed.has(file)) dropped.push(file);
    else kept.push(file);
  }
  return { kept, dropped, reason: 'tiers applied' };
}

// Jobs that run as one unit (a package's `pnpm test`, a Playwright suite, a validator test) are
// tiered under `job:<key>` in the same map, under the same rule as files: an `out` job is
// skipped on PRs, even when the source it exercises changes, and a break shows on the
// versioning PR (accepted, no exceptions). It still runs when the PR changes one of its own
// paths: its own test code, its package, the workflow and routing files that define it, and
// for E2E the lockfile. Deliberately narrower than the Prebuild routing predicates: carrying
// e.g. packages/core/ would keep every job on every core PR and tier nothing.
const CI_PATHS = ['.github/workflows/prebuild.yml', '.github/scripts/select-affected-tests.cjs', 'scripts/test-tiers/'];
const E2E_SHARED_PATHS = [
  '.github/workflows/e2e-tests.yml',
  '.github/scripts/studio-e2e-routing.cjs',
  'pnpm-lock.yaml',
];
const E2E_JOB_PATHS = {
  monorepo: ['e2e-tests/monorepo/'],
  'kitchen-sink': ['packages/playground/e2e/'],
  deployers: ['e2e-tests/deployers/'],
  'create-mastra': ['e2e-tests/create-mastra/'],
  commonjs: ['e2e-tests/commonjs/'],
  'no-bundling': ['e2e-tests/no-bundling/'],
  'mcp-compat': ['packages/mcp/integration-tests/'],
  'client-js': ['e2e-tests/client-js/'],
  'type-check': ['e2e-tests/type-check/'],
};
const EXPERIMENT_PATHS = [
  'e2e-tests/experiment-worker/',
  'e2e-tests/_local-registry-setup/',
  '.github/workflows/e2e-tests.yml',
  '.github/workflows/e2e-experiment-worker.yml',
  '.github/scripts/experiment-worker-routing.cjs',
  'pnpm-lock.yaml',
];

export const isJobKey = key => key.startsWith('job:');

// Shared E2E test code no single job claims (_local-registry-setup, a new suite) keeps every
// E2E job on.
const claimedE2eDirs = Object.values(E2E_JOB_PATHS)
  .flat()
  .concat('e2e-tests/experiment-worker/')
  .filter(prefix => prefix.startsWith('e2e-tests/'));
const isUnclaimedE2eFile = file =>
  file.startsWith('e2e-tests/') && !claimedE2eDirs.some(prefix => file.startsWith(prefix));

/** Whether a changed file keeps the job running even when it is `out`. */
export function jobOwnsFile(key, file) {
  if (jobOwnPaths(key).some(prefix => file.startsWith(prefix))) return true;
  // Shared store test code (stores/_test-utils/, stores/oxlint.config.ts) keeps every store on.
  if (key.startsWith('job:store/')) return /^stores\/(_|[^/]+$)/.test(file);
  return key.startsWith('job:e2e/') && key !== 'job:e2e/experiments' && isUnclaimedE2eFile(file);
}

/** Path prefixes whose change keeps the job running even when it is `out`. */
export function jobOwnPaths(key) {
  const [group, name] = key.slice('job:'.length).split('/');
  const workflow = file => `.github/workflows/${file}`;
  const own = (...paths) => [...paths, ...CI_PATHS];
  switch (group) {
    case 'store':
      return own(`stores/${name}/`, workflow('test-combined-stores.yml'));
    case 'memory':
      return own('packages/memory/');
    case 'workspace-unit':
    case 'workspace-docker':
      return own(`workspaces/${name}/`, workflow('test-workspaces.yml'));
    case 'workspace-cloud':
      return own(`workspaces/${name}/`, workflow('secrets.test-workspaces.yml'));
    case 'e2e':
      if (name === 'experiments') return own(...EXPERIMENT_PATHS);
      return E2E_JOB_PATHS[name] ? own(...E2E_JOB_PATHS[name], ...E2E_SHARED_PATHS) : [];
    case 'mastracode-e2e':
    case 'mastracode-om':
      return own('mastracode/', 'pnpm-lock.yaml', workflow('mastracode-e2e.yml'));
    // Only the validator's own `node --test` step; the changeset checks of the PR always run.
    case 'qa':
      return own(workflow('lint.yml'), '.github/scripts/check-changeset-packages');
    default:
      return [];
  }
}

/**
 * Which of `keys` this PR skips. Same escape hatches as the file filter: a full suite, the
 * full-tests label or any problem with tiers.json skips nothing; a key tiers.json doesn't list
 * runs.
 * @param {{ keys: string[], tiers: object | null, problem?: string | null, changedFiles: string[], fullSuite: boolean, fullTestsLabel: boolean }} input
 * @returns {{ skipped: string[], reason: string }}
 */
export function selectJobs({ keys, tiers, problem = null, changedFiles, fullSuite, fullTestsLabel }) {
  if (fullSuite) return { skipped: [], reason: 'full suite runs every job' };
  if (fullTestsLabel) return { skipped: [], reason: 'full-tests label runs every job' };
  if (!tiers) return { skipped: [], reason: `no tiers, running every job: ${problem ?? 'tiers not loaded'}` };
  const skipped = keys.filter(
    key => tiers.files[key]?.tier === 'out' && !changedFiles.some(file => jobOwnsFile(key, file)),
  );
  return { skipped, reason: 'tiers applied' };
}

// CLI for workflows that gate a job themselves:
//   node select.mjs skip-jobs --tiers=<path> --changed=<file list> [--full-suite] [--full-tests-label] <key>...
// prints the JSON array of keys to skip.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  if (command !== 'skip-jobs') {
    console.error(
      'usage: select.mjs skip-jobs --tiers=<path> --changed=<path> [--full-suite] [--full-tests-label] <key>...',
    );
    process.exit(2);
  }
  const flag = name => rest.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const changedPath = flag('changed');
  const changedFiles = changedPath ? fs.readFileSync(changedPath, 'utf8').split(/\r?\n/).filter(Boolean) : [];
  const { skipped, reason } = selectJobs({
    keys: rest.filter(arg => !arg.startsWith('--')),
    ...loadTiers(flag('tiers') ?? 'tiers.json'),
    changedFiles,
    fullSuite: rest.includes('--full-suite'),
    fullTestsLabel: rest.includes('--full-tests-label'),
  });
  console.error(`Test tiers: ${reason}; skipping ${skipped.length ? skipped.join(', ') : 'nothing'}`);
  console.log(JSON.stringify(skipped));
}
