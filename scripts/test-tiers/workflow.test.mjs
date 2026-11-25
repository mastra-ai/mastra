import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workflow = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../.github/workflows/test-tiers.yml'),
  'utf8',
);

/** Evaluates the subset of GitHub expression syntax these two expressions use. */
const evaluate = (expression, github) =>
  new Function(
    'github',
    'startsWith',
    'format',
    `return (${expression.replace(/!=/g, '!==').replace(/([^!=])==/g, '$1===')});`,
  )(
    github,
    (s, prefix) => String(s ?? '').startsWith(prefix),
    (f, ...args) => f.replace(/\{(\d+)\}/g, (_, i) => String(args[i])),
  );

const concurrency = /^concurrency:\n([\s\S]*?)\n\n/m.exec(workflow)?.[1] ?? '';
const group = /group: >-\n\s+\$\{\{([\s\S]*?)\}\}/.exec(concurrency)?.[1];
const updateIf = /^ {2}update:\n[\s\S]*?\n {4}if: >-\n([\s\S]*?)\n {4}runs-on:/m.exec(workflow)?.[1];

const run = (overrides = {}) => ({
  repository: 'mastra-ai/mastra',
  event_name: 'workflow_run',
  run_id: 101,
  event: {
    workflow_run: {
      event: 'pull_request',
      conclusion: 'failure',
      head_repository: { full_name: 'mastra-ai/mastra' },
      head_branch: 'changeset-release/main',
      ...overrides.workflow_run,
    },
  },
  ...overrides.top,
});

const cases = {
  'daily schedule': run({ top: { event_name: 'schedule', event: {} } }),
  'manual dispatch': run({ top: { event_name: 'workflow_dispatch', event: {} } }),
  'failed versioning-PR Prebuild': run(),
  'passed versioning-PR Prebuild': run({ workflow_run: { conclusion: 'success' } }),
  'cancelled versioning-PR Prebuild': run({ workflow_run: { conclusion: 'cancelled' } }),
  'failed Prebuild on another PR': run({ workflow_run: { head_branch: 'feat/x' } }),
  'failed Prebuild on main': run({ workflow_run: { event: 'push', head_branch: 'main' } }),
  'failed versioning-PR Prebuild from a fork': run({
    workflow_run: { head_repository: { full_name: 'someone/mastra' } },
  }),
};

// GitHub keeps only one pending run per concurrency group (queue: single), and a job's `if` is only
// read once the run starts. With every Prebuild completion in one group, a run that would do
// nothing replaced a failed versioning run's pending update (and its escape alert) while the daily
// update held the group; on Nov 18 seven pending runs were cancelled that way in 27 minutes.
test('only runs that update the tiers wait in the shared group, and none of them replaces another', () => {
  assert.ok(group, 'concurrency.group is an expression');
  assert.ok(updateIf, 'the update job has an if');
  assert.match(concurrency, /^\s+cancel-in-progress: false$/m);
  assert.match(concurrency, /^\s+queue: max$/m);

  const groups = {};
  for (const [name, github] of Object.entries(cases)) {
    const updates = evaluate(updateIf, github);
    const g = evaluate(group, github);
    groups[name] = g;
    assert.equal(g === 'test-tiers', updates, `${name}: in the shared group only if it updates the tiers`);
  }
  assert.deepEqual(
    Object.entries(groups)
      .filter(([, g]) => g === 'test-tiers')
      .map(([name]) => name),
    ['daily schedule', 'manual dispatch', 'failed versioning-PR Prebuild'],
  );
  // A run that does nothing gets a group of its own, so it can never replace a pending real one.
  assert.equal(groups['passed versioning-PR Prebuild'], 'test-tiers-noop-101');
  assert.notEqual(
    evaluate(group, run({ workflow_run: { conclusion: 'success' }, top: { run_id: 102 } })),
    groups['passed versioning-PR Prebuild'],
  );
});
