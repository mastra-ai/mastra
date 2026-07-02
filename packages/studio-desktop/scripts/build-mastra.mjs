import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = findWorkspaceRoot(packageRoot);
const cliEntry = workspaceRoot ? join(workspaceRoot, 'packages/cli/dist/index.js') : undefined;
const editorEntry = workspaceRoot ? join(workspaceRoot, 'packages/editor/dist/index.js') : undefined;
const mastraBuildEnv = {
  ...process.env,
  MASTRA_TELEMETRY_DISABLED: process.env.MASTRA_TELEMETRY_DISABLED ?? '1',
};

function findWorkspaceRoot(startDir) {
  let current = startDir;
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  return undefined;
}

function run(command, args, options) {
  const result = spawnSync(command, args, options);

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runPnpm(args) {
  const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  run(pnpmBin, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

if (workspaceRoot && editorEntry && !existsSync(editorEntry)) {
  runPnpm(['--filter', '@mastra/editor', 'build']);
}

if (workspaceRoot && cliEntry && !existsSync(cliEntry)) {
  runPnpm(['build:cli']);
}

if (cliEntry && existsSync(cliEntry)) {
  run(process.execPath, [cliEntry, 'build', '--dir', join(packageRoot, 'src/starter/mastra'), '--root', packageRoot], {
    cwd: packageRoot,
    env: mastraBuildEnv,
    stdio: 'inherit',
  });
} else {
  const mastraBin = process.platform === 'win32' ? 'mastra.cmd' : 'mastra';
  run(mastraBin, ['build', '--dir', join(packageRoot, 'src/starter/mastra'), '--root', packageRoot], {
    cwd: packageRoot,
    env: mastraBuildEnv,
    stdio: 'inherit',
  });
}
