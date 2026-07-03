import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = findWorkspaceRoot(packageRoot);
const cliEntry = workspaceRoot ? join(workspaceRoot, 'packages/cli/dist/index.js') : undefined;
const editorEntry = workspaceRoot ? join(workspaceRoot, 'packages/editor/dist/index.js') : undefined;
const outputDir = join(packageRoot, '.mastra/output');
const outputPackageJson = join(outputDir, 'package.json');
const desktopRuntimeDependencies = ['p-retry'];
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

function runPnpmInOutput(args) {
  const pnpmBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  run(pnpmBin, args, {
    cwd: outputDir,
    env: process.env,
    stdio: 'inherit',
  });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function getRuntimeDependencyVersion(dependencyName) {
  const sourcePackageJsonPaths = [
    workspaceRoot ? join(workspaceRoot, 'packages/core/package.json') : undefined,
    join(packageRoot, 'package.json'),
  ].filter(Boolean);

  for (const packageJsonPath of sourcePackageJsonPaths) {
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = readJson(packageJsonPath);
    const version = packageJson.dependencies?.[dependencyName] ?? packageJson.devDependencies?.[dependencyName];
    if (version) return version;
  }

  throw new Error(`Could not resolve version for desktop runtime dependency "${dependencyName}"`);
}

function ensureDesktopRuntimeDependencies() {
  if (!existsSync(outputPackageJson)) {
    throw new Error(`Mastra build did not create ${outputPackageJson}`);
  }

  const packageJson = readJson(outputPackageJson);
  packageJson.dependencies ??= {};

  let shouldInstall = false;

  for (const dependencyName of desktopRuntimeDependencies) {
    if (!packageJson.dependencies[dependencyName]) {
      packageJson.dependencies[dependencyName] = getRuntimeDependencyVersion(dependencyName);
      shouldInstall = true;
    }

    if (!existsSync(join(outputDir, 'node_modules', dependencyName, 'package.json'))) {
      shouldInstall = true;
    }
  }

  writeFileSync(outputPackageJson, `${JSON.stringify(packageJson, null, 2)}\n`);

  if (shouldInstall) {
    runPnpmInOutput(['install', '--prod', '--ignore-scripts', '--no-frozen-lockfile']);
  }
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

ensureDesktopRuntimeDependencies();
