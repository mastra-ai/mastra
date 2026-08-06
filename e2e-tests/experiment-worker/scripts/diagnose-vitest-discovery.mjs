import { appendFileSync, readdirSync, realpathSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputPath = resolve(process.cwd(), 'vitest-discovery-debug.jsonl');
const selectedTest = resolve(process.cwd(), 'tests/minimal-agent.test.ts');
const debugConfig = resolve(process.cwd(), '.vitest-discovery-debug.config.mjs');

function record(event, data = {}) {
  appendFileSync(
    outputPath,
    `${JSON.stringify({ timestamp: new Date().toISOString(), event, pid: process.pid, ...data })}\n`,
  );
}

function run(label, args) {
  const result = spawnSync(process.execPath, [resolve(process.cwd(), 'node_modules/vitest/vitest.mjs'), ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
  });

  record('command', {
    label,
    args,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
}

record('environment', {
  cwd: process.cwd(),
  envPwd: process.env.PWD,
  cwdRealpath: realpathSync(process.cwd()),
  selectedTest,
  selectedTestRealpath: realpathSync(selectedTest),
  selectedTestStat: statSync(selectedTest),
  testEntries: readdirSync(resolve(process.cwd(), 'tests'))
    .filter(entry => entry.endsWith('.test.ts'))
    .sort(),
  ci: process.env.CI,
  githubActions: process.env.GITHUB_ACTIONS,
  node: process.version,
  platform: process.platform,
});

writeFileSync(
  debugConfig,
  "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });\n",
);

try {
  run('minimal-config-relative', ['list', 'tests/minimal-agent.test.ts', '--config', debugConfig]);
  run('minimal-config-absolute', ['list', selectedTest, '--config', debugConfig]);
  run('repository-config-relative', ['list', 'tests/minimal-agent.test.ts', '--config', 'vitest.config.ts']);
} finally {
  unlinkSync(debugConfig);
}
