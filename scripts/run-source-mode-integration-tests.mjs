import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  MASTRA_SOURCE_MODE: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --conditions=mastra-source`.trim(),
};

const runs = [
  {
    cwd: 'packages/agent-builder/integration-tests',
    command: 'pnpm',
    args: ['test:source-mode', '--reporter=dot', '--bail', '1'],
  },
  {
    cwd: 'packages/mcp/integration-tests',
    command: 'pnpm',
    args: ['test:mcp:source-mode', '--reporter=dot', '--bail', '1'],
  },
  {
    cwd: 'packages/memory/integration-tests',
    command: 'pnpm',
    args: ['test:source-mode', 'src/with-libsql-storage.test.ts', '--reporter=dot', '--bail', '1'],
  },
];

for (const run of runs) {
  console.info(`\n> (${run.cwd}) ${run.command} ${run.args.join(' ')}`);
  const result = spawnSync(run.command, run.args, {
    cwd: run.cwd,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
