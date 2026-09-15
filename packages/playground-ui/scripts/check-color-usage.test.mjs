import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { buildReport, compareReports, parseArguments } from './check-color-usage.mjs';

const createRepository = () => {
  const directory = mkdtempSync(join(tmpdir(), 'color-usage-'));
  execFileSync('git', ['init', '-q', directory]);
  mkdirSync(join(directory, 'src', 'Button'), { recursive: true });
  mkdirSync(join(directory, 'src', '__tests__'), { recursive: true });
  mkdirSync(join(directory, 'src', '.storybook'), { recursive: true });
  return directory;
};

const track = (repository, file, content) => {
  const path = join(repository, file);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  execFileSync('git', ['-C', repository, 'add', file]);
};

test('parses report options and configurable roots', () => {
  assert.deepEqual(parseArguments(['--report', '--root', 'frontend', '--component', 'Button']), {
    mode: 'report',
    roots: ['frontend'],
    component: 'Button',
    baseline: '',
  });
  assert.throws(() => parseArguments([]), /Choose --check or --report/);
  assert.throws(() => parseArguments(['--check', '--report']), /Choose either/);
});

test('reports legacy, foundation, and achromatic usage by source group', () => {
  const repository = createRepository();
  track(
    repository,
    'src/Button/button.tsx',
    "const classes = 'hover:bg-surface2/50 text-neutral3 border-border1 bg-gray-1 bg-card text-muted-foreground'; const css = 'var(--surface3) var(--sidebar)'; const values = [Colors.surface1, Colors['neutral2'], BorderColors.border2, Colors.card, BorderColors['sidebar-border'], Colors.accent3, 'var(--sidebar-nav-hover)', '#fff', 'rgb(0 0 0 / 50%)', 'oklch(0.2 0 0)'];",
  );
  track(repository, 'src/__tests__/button.test.tsx', "const value = 'bg-surface2';");
  track(repository, 'src/.storybook/button.stories.tsx', "const value = 'text-neutral3';");

  const report = buildReport({ repositoryRoot: repository, roots: ['src'] });

  assert.equal(
    report.groups.production.find(record => record.token === 'surface2' && record.form === 'tailwind')?.count,
    1,
  );
  assert.equal(
    report.groups.production.find(record => record.token === 'surface3' && record.form === 'css-variable')?.count,
    1,
  );
  assert.equal(
    report.groups.production.find(record => record.token === 'surface1' && record.form === 'typescript')?.count,
    1,
  );
  assert.equal(report.groups.production.find(record => record.token === 'gray-1')?.kind, 'foundation');
  assert.equal(report.groups.production.find(record => record.token === 'card')?.kind, 'semantic');
  assert.equal(report.groups.production.find(record => record.token === 'sidebar-border')?.form, 'typescript');
  assert.equal(
    report.groups.production.some(record => record.token === 'accent'),
    false,
  );
  assert.equal(report.groups.production.filter(record => record.kind === 'achromatic').length, 3);
  assert.equal(report.groups.tests[0]?.token, 'surface2');
  assert.equal(report.groups.stories[0]?.token, 'neutral3');
});

test('filters reports to one component', () => {
  const repository = createRepository();
  track(repository, 'src/Button/button.tsx', "const value = 'bg-surface2';");
  track(repository, 'src/card.tsx', "const value = 'bg-surface3';");

  const report = buildReport({ repositoryRoot: repository, roots: ['src'], component: 'Button' });

  assert.deepEqual(
    report.groups.production.map(record => record.file),
    ['src/Button/button.tsx'],
  );
});

test('rejects new, increased, removed, and direct foundation usage', () => {
  const repository = createRepository();
  track(repository, 'src/Button/button.tsx', "const value = 'bg-surface2';");
  const baseline = buildReport({ repositoryRoot: repository, roots: ['src'] });

  track(repository, 'src/Button/button.tsx', "const value = 'bg-surface2 hover:bg-surface2 bg-(--gray-1)';");
  const current = buildReport({ repositoryRoot: repository, roots: ['src'] });
  const failures = compareReports(baseline, current);

  assert.ok(failures.some(failure => failure.includes('surface2 (tailwind) increased 1 -> 2')));
  assert.ok(failures.some(failure => failure.includes('direct foundation reference gray-1')));

  track(repository, 'src/Button/button.tsx', "const value = 'bg-card';");
  const removed = compareReports(baseline, buildReport({ repositoryRoot: repository, roots: ['src'] }));
  assert.ok(removed.some(failure => failure.includes('baseline is stale for removed surface2')));
});
