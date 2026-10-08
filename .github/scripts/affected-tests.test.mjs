import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { testFileDependencies } from '../../scripts/test-file-dependencies.cjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const ui = 'packages/playground-ui';
const themeTest = `${ui}/src/theme-export.test.ts`;
const colorCoverageTest = `${ui}/src/ds/tokens/color-foundations-coverage.test.tsx`;
const componentsTest = `${ui}/src/components-exports.test.ts`;
const floatingTest = `${ui}/src/ds/primitives/floating.test.ts`;
const schemesTest = `${ui}/src/lib/file/__tests__/schemes.parity.test.ts`;
const hooksTest = `${ui}/src/hooks/__tests__/storybook-coverage.test.ts`;
const importedTest = 'packages/fixture/src/value.test.ts';
const css = `${ui}/theme/colors.css`;
const source = 'packages/fixture/src/value.ts';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'affected-tests-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, content = '') => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  write('package.json', JSON.stringify({ name: 'fixture', private: true, type: 'module' }));
  write('.gitignore', 'node_modules\noutput\n');
  symlinkSync(join(repositoryRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  mkdirSync(join(root, 'workspaces'));

  for (const path of [
    'scripts/affected-tests.mjs',
    'scripts/madge.webpack.config.cjs',
    'scripts/workspace-source-aliases.cjs',
    'scripts/test-file-dependencies.cjs',
    '.github/scripts/ci-routing.cjs',
    '.github/scripts/studio-e2e-routing.cjs',
    '.github/scripts/experiment-worker-routing.cjs',
  ]) {
    write(path);
    copyFileSync(join(repositoryRoot, path), join(root, path));
  }
  for (const path of [themeTest, colorCoverageTest, componentsTest, floatingTest, schemesTest, hooksTest]) {
    write(path, "import { readFileSync } from 'node:fs';\nexport const read = path => readFileSync(path, 'utf8');\n");
  }
  write(source, 'export const value = 1;\n');
  write(importedTest, "import { value } from './value.js';\nexport const result = value;\n");
  write(css, ':root { --color-test: red; }\n');
  // Keep the workflow in affected-only mode so a full-suite fallback cannot mask a miss.
  for (let i = 0; i < 10; i++) write(`packages/fixture/src/unrelated-${i}.test.ts`, 'export {};\n');
  git('add', '.');
  git('commit', '-qm', 'baseline');
  const base = git('rev-parse', 'HEAD');

  const select = (...args) =>
    JSON.parse(
      execFileSync(process.execPath, ['scripts/affected-tests.mjs', '--json', ...args], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );

  const workflow = changedFiles => {
    for (const path of changedFiles) write(path, path === css ? ':root { --color-test: blue; }\n' : 'export {};\n');
    git('add', '.');
    git('commit', '-qm', 'change', '--allow-empty');
    const text = readFileSync(join(repositoryRoot, '.github/workflows/prebuild.yml'), 'utf8');
    const step = text.split('      - name: Compute affected test files\n')[1].split('\n      - name:')[0];
    const script = step
      .split('        run: |\n')[1]
      .split('\n')
      .map(line => line.replace(/^          /, ''))
      .join('\n');
    const output = join(root, 'output');
    mkdirSync(output);
    execFileSync('bash', ['-e', '-o', 'pipefail', '-c', script.replaceAll('/tmp/', `${output}/`)], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BASE_SHA: base,
        HEAD_SHA: git('rev-parse', 'HEAD'),
        GITHUB_OUTPUT: join(output, 'github-output'),
        GITHUB_STEP_SUMMARY: join(output, 'summary'),
      },
    });
    return {
      selected: readFileSync(join(output, 'affected-outputs/unit_test_files.txt'), 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean),
      outputs: readFileSync(join(output, 'github-output'), 'utf8'),
    };
  };
  return { root, write, git, select, workflow };
}

test('selects file-reading theme tests for a CSS-only change', t => {
  const { select } = fixture(t);
  assert.deepEqual(select(css).affectedTests, [colorCoverageTest, themeTest].sort());
});

test('selects directory scanners when a new component has no importers', t => {
  const { select, write } = fixture(t);
  const component = `${ui}/src/ds/components/NewComponent/index.ts`;
  write(component, 'export const NewComponent = 1;\n');
  assert.deepEqual(select(component).affectedTests, [componentsTest, floatingTest, themeTest].sort());
});

test('selects the UI parity test when the core file it reads changes', t => {
  const { select, write } = fixture(t);
  const core = 'packages/core/src/agent/message-list/prompt/attachments-to-parts.ts';
  write(core, 'export {};\n');
  assert.deepEqual(select(core).affectedTests, [schemesTest]);
});

test('unions explicit file dependencies with transitive import selection', t => {
  const { select } = fixture(t);
  assert.deepEqual(select(source, css, css).affectedTests, [importedTest, colorCoverageTest, themeTest].sort());
});

test('keeps selecting consumers of a deleted CSS file', t => {
  const { root, select, git } = fixture(t);
  rmSync(join(root, css));
  git('add', '-u');
  assert.deepEqual(select(css).affectedTests, [colorCoverageTest, themeTest].sort());
});

test('does not resurrect a removed registered test', t => {
  const { root, select, git } = fixture(t);
  rmSync(join(root, themeTest));
  git('add', '-u');
  assert.deepEqual(select(css).affectedTests, [colorCoverageTest]);
});

test('ignores an unstaged test deletion during local selection', t => {
  const { root, select } = fixture(t);
  rmSync(join(root, themeTest));
  assert.deepEqual(select(css).affectedTests, [colorCoverageTest]);
});

test('selects directory scanners for a newly added hook without importers', t => {
  const { select, write } = fixture(t);
  const hook = `${ui}/src/hooks/use-new-hook.ts`;
  write(hook, 'export const useNewHook = () => null;\n');
  assert.deepEqual(select(hook).affectedTests, [hooksTest, themeTest].sort());
});

test('keeps filesystem dependencies even when the test has a type-only import', t => {
  const { select, write } = fixture(t);
  const core = 'packages/core/src/agent/message-list/prompt/attachments-to-parts.ts';
  write(core, 'export interface Protocol { scheme: string }\n');
  write(
    schemesTest,
    "import type { Protocol } from '../../../../../core/src/agent/message-list/prompt/attachments-to-parts';\n",
  );
  assert.deepEqual(select(core).affectedTests, [schemesTest]);
});

test('rechecks registered tests when their dependency declarations change', t => {
  const { select } = fixture(t);
  assert.deepEqual(
    select('scripts/test-file-dependencies.cjs').affectedTests,
    [themeTest, colorCoverageTest, componentsTest, floatingTest, schemesTest, hooksTest].sort(),
  );
});

test('does not match a sibling directory with the same prefix', t => {
  const { select, write } = fixture(t);
  const path = `${ui}/theme-backup/colors.css`;
  write(path, ':root {}\n');
  assert.deepEqual(select(path).affectedTests, []);
});

test('keeps normal import selection narrow for unrelated code', t => {
  const { select } = fixture(t);
  assert.deepEqual(select(source).affectedTests, [importedTest]);
});

test('does not select registered tests for unrelated documentation', t => {
  const { select, write } = fixture(t);
  write('README.md', '# Documentation\n');
  assert.deepEqual(select('README.md').affectedTests, []);
});

test('includes CSS changes in local --git selection', t => {
  const { select, write } = fixture(t);
  write(css, ':root { --color-test: blue; }\n');
  assert.deepEqual(select('--git').affectedTests, [colorCoverageTest, themeTest].sort());
});

test('supports explicit dependencies in file-level selection too', t => {
  const { select } = fixture(t);
  assert.deepEqual(select('--file-level', css).affectedTests, [colorCoverageTest, themeTest].sort());
});

test('CI passes a CSS-only diff to the selector and schedules its tests', t => {
  const result = fixture(t).workflow([css]);
  assert.deepEqual(result.selected, [colorCoverageTest, themeTest].sort());
  assert.match(result.outputs, /run_full=false/);
});

test('CI preserves both imported tests and file-reading tests in a mixed diff', t => {
  const result = fixture(t).workflow([source, css]);
  assert.deepEqual(result.selected, [importedTest, colorCoverageTest, themeTest].sort());
  assert.match(result.outputs, /run_full=false/);
});

test('CI handles an empty diff without running tests', t => {
  const result = fixture(t).workflow([]);
  assert.deepEqual(result.selected, []);
  assert.match(result.outputs, /run_full=false/);
});

test('CI preserves filenames with spaces in the changed-file list', t => {
  const result = fixture(t).workflow([`${ui}/theme/new palette.css`]);
  assert.deepEqual(result.selected, [colorCoverageTest, themeTest].sort());
});

test('CI still falls back to the full suite when more than half the tests are affected', t => {
  const project = fixture(t);
  for (let i = 0; i < 10; i++) {
    project.write(
      `packages/fixture/src/unrelated-${i}.test.ts`,
      "import { value } from './value.js';\nexport const result = value;\n",
    );
  }
  const result = project.workflow([source]);
  assert.match(result.outputs, /run_full=true/);
});

test('every registered test exists, so a renamed test cannot silently leave the registry', () => {
  for (const testFile of Object.keys(testFileDependencies)) {
    assert.ok(existsSync(join(repositoryRoot, testFile)), `${testFile} is registered but missing`);
  }
});
