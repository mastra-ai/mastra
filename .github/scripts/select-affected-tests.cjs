const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const { discoverWorkspacePackages, selectWorkspacePackages } = require('./ci-routing.cjs');
const { dependencyAffectedTests } = require('./dependency-test-routing.cjs');
const { experimentWorkerE2eChanged } = require('./experiment-worker-routing.cjs');
const { studioE2eChanged } = require('./studio-e2e-routing.cjs');
const { shardCount } = require('./test-shards.cjs');

// Prebuild's test routing: which tests and suites a diff needs. Run by the
// "Compute affected test files" step in .github/workflows/prebuild.yml.

const ROUTING_FILES = ['.github/workflows/prebuild.yml', '.github/scripts/select-affected-tests.cjs'];
const EXPERIMENT_ENTRY_FILES = ['packages/cli/src/commands/index.ts', 'packages/cli/src/index.ts'];
const WORKSPACE_DOCKER_PACKAGES = ['s3', 'gcs', 'azure'];
const TEST_FILE_RE = /\.(?:test|spec)(?:-d)?\.tsx?$/;
const FIXTURE_RE = /__fixtures__|\/fixtures\//;

const isPackageE2eTest = file =>
  file.startsWith('packages/') &&
  (file.includes('.e2e.') ||
    file.startsWith('packages/evals/src/scorers/llm/') ||
    file.startsWith('packages/rag/src/'));
const isExternalE2eTest = file => file.startsWith('e2e-tests/') || file.startsWith('packages/playground/e2e/');
const storeOf = file => (file.match(/^stores\/([^/]+)\//) || [])[1];

/**
 * Turns the changed files and the selected tests into the routing Prebuild's jobs read.
 *
 * @param {{
 *   changedFiles: string[],
 *   affectedTests: string[],
 *   fullSuite: boolean,
 *   workspacePackages: ReturnType<typeof discoverWorkspacePackages>,
 *   experimentEntryDiff?: string,
 *   timings?: Record<string, number>,
 * }} input
 */
function routeTests({
  changedFiles,
  affectedTests,
  fullSuite,
  workspacePackages,
  experimentEntryDiff = '',
  timings = {},
}) {
  const codeFiles = changedFiles.filter(file => !file.endsWith('.md'));
  const changed = predicate => codeFiles.some(predicate);
  const affected = predicate => affectedTests.some(predicate);
  const routingChanged = changed(file => ROUTING_FILES.includes(file));
  const lockfileChanged = changed(file => file === 'pnpm-lock.yaml');

  const workspaceSelection = selectWorkspacePackages({
    affectedTests,
    changedFiles,
    runFull: fullSuite,
    workspacePackages,
  });

  const flags = {
    stores_changed:
      fullSuite ||
      routingChanged ||
      affected(file => file.startsWith('stores/')) ||
      changed(file => file.startsWith('stores/') || file === '.github/workflows/test-combined-stores.yml'),
    workspaces_changed: workspaceSelection.packages.length > 0,
    memory_changed:
      fullSuite ||
      routingChanged ||
      affected(file => file.startsWith('packages/memory/integration-tests/')) ||
      changed(file => file.startsWith('packages/memory/')),
    e2e_changed:
      fullSuite ||
      lockfileChanged ||
      studioE2eChanged(codeFiles) ||
      affected(isExternalE2eTest) ||
      changed(
        file =>
          (file.startsWith('e2e-tests/') &&
            !file.startsWith('e2e-tests/experiment-worker/') &&
            !file.startsWith('e2e-tests/_local-registry-setup/')) ||
          file.startsWith('packages/playground/e2e/') ||
          file.startsWith('packages/playground-ui/') ||
          file.startsWith('server-adapters/hono/') ||
          file.startsWith('packages/server/') ||
          // e2e-mcp-compat: the core MCP/tool contract must keep published @mastra/mcp 1.x working.
          file.startsWith('packages/core/src/mcp/') ||
          file.startsWith('packages/core/src/tools/') ||
          file.startsWith('packages/mcp/integration-tests/') ||
          file === '.github/workflows/e2e-tests.yml',
      ),
    experiment_worker_e2e_changed: fullSuite || experimentWorkerE2eChanged(codeFiles, experimentEntryDiff),
    mastracode_e2e_changed:
      fullSuite ||
      lockfileChanged ||
      changed(
        file =>
          file.startsWith('mastracode/') ||
          file.startsWith('packages/core/') ||
          file === '.github/workflows/mastracode-e2e.yml',
      ),
    // The worker-takeover suite drives real child processes against Redis streams and a
    // Postgres workflow store; it only exercises the paths that matter when lease
    // ownership, evented delivery, or the workflow store change.
    durable_streams_changed:
      fullSuite ||
      lockfileChanged ||
      routingChanged ||
      changed(
        file =>
          file.startsWith('packages/core/src/agent/') ||
          file.startsWith('packages/core/src/mastra/') ||
          file.startsWith('packages/core/src/workflows/evented/') ||
          file.startsWith('pubsub/redis-streams/') ||
          file.startsWith('stores/pg/') ||
          file.startsWith('packages/memory/') ||
          file === '.github/workflows/test-durable-streams.yml' ||
          file === '.github/workflows/test-suite.yml',
      ),
  };

  // Which stores' suites run when stores_changed: those with affected tests or changed files.
  // Shared store test code, the store workflows, the routing, the lockfile or a workspace
  // manifest outside stores/ (the import graph doesn't follow dependencies or exports) run all.
  const allStores =
    fullSuite ||
    routingChanged ||
    lockfileChanged ||
    changed(
      file =>
        file.startsWith('stores/_test-utils/') ||
        (/(^|\/)package\.json$/.test(file) && !file.startsWith('stores/')) ||
        file === '.github/workflows/test-combined-stores.yml',
    );
  const storeSelection = allStores
    ? 'all'
    : [...new Set([...affectedTests, ...codeFiles].map(storeOf))]
        .filter(store => store && store !== '_test-utils')
        .sort();

  // The full suite runs every test itself, so it carries no selection.
  const unitTestFiles = fullSuite
    ? []
    : affectedTests.filter(file => !isPackageE2eTest(file) && !isExternalE2eTest(file));

  return {
    runFull: fullSuite,
    unitTestFiles,
    // As many shards as the recorded durations call for (about 2.5 minutes each, at most 16);
    // each runs `vitest --shard=k/N`, balanced by the same timings
    // (scripts/vitest-timing-sequencer.ts). Narrow PRs stay one job.
    unitShards: Array.from({ length: Math.max(1, shardCount({ files: unitTestFiles, timings })) }, (_, i) => i + 1),
    e2eTestFiles: fullSuite ? [] : affectedTests.filter(isPackageE2eTest),
    storeSelection,
    workspaceSelection,
    workspaceDockerPackages: workspaceSelection.packages.filter(pkg => WORKSPACE_DOCKER_PACKAGES.includes(pkg)),
    flags,
  };
}

/**
 * The lockfiles at both ends of the PR diff. Dependency routing compares their resolved
 * trees. A pull_request checkout is the merge commit, so the working-tree lockfile also
 * holds lockfile changes that reached main after the branch point.
 *
 * @param {(...args: string[]) => string} git
 * @param {{ baseSha: string, headSha: string, changedFiles: string[] }} diff
 */
function diffLockfiles(git, { baseSha, headSha, changedFiles }) {
  const headLockfile = git('show', `${headSha}:pnpm-lock.yaml`);
  if (!changedFiles.includes('pnpm-lock.yaml')) return { baseLockfile: '', headLockfile };
  const mergeBase = git('merge-base', baseSha, headSha).trim();
  return { baseLockfile: git('show', `${mergeBase}:pnpm-lock.yaml`), headLockfile };
}

function main() {
  const { BASE_SHA, HEAD_SHA, FULL_SUITE, GITHUB_OUTPUT, GITHUB_STEP_SUMMARY, TEST_TIMINGS } = process.env;
  const requestedFullSuite = FULL_SUITE === 'true';
  const git = (...args) => execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 1 << 28 });
  const lines = text => text.split(/\r?\n/).filter(Boolean);
  const summary = text => fs.appendFileSync(GITHUB_STEP_SUMMARY, text);
  const outDir = '/tmp/affected-outputs';

  // The full suite ignores the diff, and a workflow_call has no PR base to diff against.
  const range = `${BASE_SHA}...${HEAD_SHA}`;
  const changedFiles = requestedFullSuite ? [] : lines(git('diff', '--name-only', range));
  const addedOrRemovedFiles = requestedFullSuite
    ? []
    : lines(git('diff', '--name-status', '--find-renames', range))
        .filter(line => /^[ADR]/.test(line))
        .flatMap(line => line.split('\t').slice(1));

  const testFiles = lines(git('ls-files')).filter(
    file => TEST_FILE_RE.test(file) && !FIXTURE_RE.test(file) && !file.includes('node_modules'),
  );

  const changedSources = changedFiles.filter(file => /\/src\/.*\.(ts|tsx)$/.test(file) && !FIXTURE_RE.test(file));
  let graphTests = [];
  if (changedSources.length > 0) {
    console.error(`Changed source files:\n${changedSources.join('\n')}`);
    const output = execFileSync('node', ['scripts/affected-tests.mjs', '--json', ...changedSources], {
      encoding: 'utf-8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    graphTests = JSON.parse(output).affectedTests || [];
  } else {
    console.error('No source file changes found; the import graph selects no tests.');
  }

  // The import graph misses dependency bumps and tests that scan their package's files.
  const dependencySelection = requestedFullSuite
    ? null
    : dependencyAffectedTests({
        changedFiles,
        addedOrRemovedFiles,
        ...diffLockfiles(git, { baseSha: BASE_SHA, headSha: HEAD_SHA, changedFiles }),
        testFiles,
        readTest: file => fs.readFileSync(file, 'utf-8'),
      });
  if (dependencySelection && dependencySelection.reason !== 'none') {
    console.error(`Dependency routing: ${dependencySelection.reason}`);
    for (const { dir, reason } of dependencySelection.packages) console.error(`  ${dir}: ${reason}`);
    const packages = dependencySelection.packages.map(pkg => `\`${pkg.dir}\``).join(', ') || 'none';
    summary(`## Dependency test routing\n\n- Reason: \`${dependencySelection.reason}\`\n- Packages: ${packages}\n`);
  }

  const affectedTests = [...new Set([...graphTests, ...(dependencySelection?.tests || [])])].sort();
  let timings = {};
  if (TEST_TIMINGS && fs.existsSync(TEST_TIMINGS)) {
    try {
      timings = JSON.parse(fs.readFileSync(TEST_TIMINGS, 'utf-8'));
    } catch {
      console.error(`Could not read ${TEST_TIMINGS}; planning unit shards without timings.`);
    }
  }
  const changedEntryFiles = changedFiles.filter(file => EXPERIMENT_ENTRY_FILES.includes(file));
  const routing = routeTests({
    changedFiles,
    affectedTests,
    // Only the release PR, workflow calls and wide dependency changes run the full suite.
    // A regular PR runs its affected tests, however many there are.
    fullSuite: requestedFullSuite || Boolean(dependencySelection?.runFull),
    workspacePackages: discoverWorkspacePackages(),
    experimentEntryDiff: changedEntryFiles.length ? git('diff', '--unified=0', range, '--', ...changedEntryFiles) : '',
    timings,
  });

  const { workspaceSelection } = routing;
  const outputs = {
    ...routing.flags,
    run_full: routing.runFull,
    // The unit list can reach hundreds of KB, so it travels in the artifact; the job
    // output only says whether there is one.
    has_unit_tests: routing.unitTestFiles.length > 0,
    unit_shards: JSON.stringify(routing.unitShards),
    store_selection: routing.storeSelection === 'all' ? 'all' : JSON.stringify(routing.storeSelection),
    workspace_packages: JSON.stringify(workspaceSelection.packages),
    workspace_docker_packages: JSON.stringify(routing.workspaceDockerPackages),
  };
  fs.appendFileSync(
    GITHUB_OUTPUT,
    Object.entries(outputs)
      .map(([name, value]) => `${name}=${value}\n`)
      .join('') +
      `e2e_test_files<<AFFECTED_EOF\n${routing.e2eTestFiles.map(file => `${file}\n`).join('')}AFFECTED_EOF\n`,
  );

  // Read by test-suite.yml (unit list) and secrets.test-workspaces.yml (the rest).
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(`${outDir}/unit_test_files.txt`, routing.unitTestFiles.map(file => `${file}\n`).join(''));
  fs.writeFileSync(`${outDir}/workspace_packages.json`, `${outputs.workspace_packages}\n`);
  fs.writeFileSync(`${outDir}/base_sha.txt`, `${BASE_SHA}\n`);
  fs.writeFileSync(`${outDir}/head_sha.txt`, `${HEAD_SHA}\n`);
  // The unit test shards balance their files by the same timings.
  fs.writeFileSync(`${outDir}/test-timings.json`, JSON.stringify(timings));

  const packages = workspaceSelection.packages.map(pkg => `\`${pkg}\``).join(', ') || 'none';
  summary(`## Workspace test routing\n\n- Reason: \`${workspaceSelection.reason}\`\n- Packages: ${packages}\n`);
  console.error(`Affected: ${affectedTests.length}/${testFiles.length} tests`);
  console.error(`Affected unit/type tests: ${routing.unitTestFiles.length}`);
  console.error(`Affected package E2E tests: ${routing.e2eTestFiles.length}`);
  console.error(
    `Workspace packages (${workspaceSelection.reason}): ${workspaceSelection.packages.join(', ') || 'none'}`,
  );
  console.error(routing.runFull ? 'Running the full suite.' : `Running ${affectedTests.length} affected tests.`);
}

if (require.main === module) main();

module.exports = { routeTests, diffLockfiles };
