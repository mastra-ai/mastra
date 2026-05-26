#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function listFiles(dir, matcher, ignored = () => false) {
  const files = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = join(dir, entry.name);
    const repoPath = relative(repoRoot, absolutePath);
    if (ignored(repoPath, entry)) continue;

    if (entry.isDirectory()) {
      files.push(...listFiles(absolutePath, matcher, ignored));
      continue;
    }

    if (matcher(repoPath)) {
      files.push(repoPath);
    }
  }

  return files;
}

const EXPECTED_VENDORED_SOURCE_PACKAGES = [
  'packages/_vendored/ai_v4/package.json',
  'packages/_vendored/ai_v5/package.json',
  'packages/_vendored/ai_v6/package.json',
];

const ALLOWLISTED_VITEST_CONFIG_REASONS = [
  {
    matches: path => path.startsWith('observability/_examples/'),
    reason: 'observability example projects do not import workspace source packages during repo source-mode tests',
  },
  {
    matches: path => path === 'packages/playground/vitest.config.ts',
    reason: 'playground tests are browser/UI scoped and are not part of the no-build source-mode Vitest lane',
  },
];

function allowlistedVitestConfigReason(path) {
  return ALLOWLISTED_VITEST_CONFIG_REASONS.find(entry => entry.matches(path))?.reason;
}

const sourceExports = spawnSync(process.execPath, ['scripts/source-exports.mjs', 'check'], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (sourceExports.status !== 0) {
  fail('source-exports:check failed');
}

for (const packageJsonPath of EXPECTED_VENDORED_SOURCE_PACKAGES) {
  const packageJson = readJson(join(repoRoot, packageJsonPath));
  const missingSourceExports = Object.entries(packageJson.exports ?? {})
    .filter(([, exportValue]) => exportValue && typeof exportValue === 'object' && !Array.isArray(exportValue))
    .filter(([, exportValue]) => !exportValue['mastra-source'])
    .map(([exportPath]) => exportPath);

  if (missingSourceExports.length) {
    fail(`${packageJsonPath} is missing mastra-source exports for ${missingSourceExports.join(', ')}`);
  }
}

const vitestConfigs = listFiles(
  repoRoot,
  path => path.endsWith('vitest.config.ts'),
  (path, entry) => entry.isDirectory() && (path === '.git' || path.endsWith('node_modules') || path === 'docs/build'),
).sort();

for (const configPath of vitestConfigs) {
  const content = readFileSync(join(repoRoot, configPath), 'utf8');
  if (content.includes('withSourceModeConfig')) continue;
  if (allowlistedVitestConfigReason(configPath)) continue;
  fail(`${configPath} is not wrapped with withSourceModeConfig()`);
}

const rootVitestConfig = readFileSync(join(repoRoot, 'vitest.config.ts'), 'utf8');
if (!rootVitestConfig.includes('./scripts/vitest-source-mode-config')) {
  fail('vitest.config.ts must import the shared source-mode config helper');
}

const sourceModeConfig = readFileSync(join(repoRoot, 'scripts/vitest-source-mode-config.ts'), 'utf8');
for (const forbidden of ['process.cwd()', "'dist'", '"dist"']) {
  if (sourceModeConfig.includes(forbidden)) {
    fail(`scripts/vitest-source-mode-config.ts should not depend on ${forbidden}`);
  }
}

const fixturePackageJsons = listFiles(
  repoRoot,
  path =>
    path.endsWith('package.json') &&
    (path.startsWith('e2e-tests/') || /^packages\/[^/]+\/integration-tests\//.test(path)),
  (path, entry) => entry.isDirectory() && (path === '.git' || path.endsWith('node_modules')),
).sort();

for (const packageJsonPath of fixturePackageJsons) {
  const packageJson = readJson(join(repoRoot, packageJsonPath));
  const devScript = packageJson.scripts?.dev;
  if (typeof devScript === 'string' && devScript.includes('--source-mode')) {
    fail(`${packageJsonPath} has default dev script hardcoding --source-mode`);
  }
}

if (failures.length) {
  console.error('\nSource-mode coverage check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Source-mode coverage check passed.');
