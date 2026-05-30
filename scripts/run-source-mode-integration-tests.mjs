import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  MASTRA_SOURCE_MODE: '1',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --conditions=mastra-source`.trim(),
};

function pnpmCommand(commandArgs) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath
    ? { command: process.execPath, args: [npmExecPath, ...commandArgs] }
    : { command: 'pnpm', args: commandArgs };
}

const runs = [
  {
    cwd: 'packages/agent-builder/integration-tests',
    args: ['test:source-mode', '--reporter=dot', '--bail', '1'],
  },
  {
    cwd: 'packages/mcp/integration-tests',
    args: ['test:mcp:source-mode', '--reporter=dot', '--bail', '1'],
  },
  {
    cwd: 'packages/memory/integration-tests',
    args: ['test:source-mode', 'src/with-libsql-storage.test.ts', '--reporter=dot', '--bail', '1'],
  },
];

for (const run of runs) {
  const { command, args } = pnpmCommand(run.args);
  console.info(`\n> (${run.cwd}) ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    cwd: run.cwd,
    env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
