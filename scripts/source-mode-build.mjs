#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , target, ...passthroughArgs] = process.argv;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

if (!target) {
  console.error('Usage: node scripts/source-mode-build.mjs <workspace-filter> [...turbo-args]');
  process.exit(1);
}

const repoSourceMode = ['1', 'true'].includes(process.env.MASTRA_REPO_RUN_FROM_SOURCE ?? '');
const turboArgs = passthroughArgs[0] === '--' ? passthroughArgs.slice(1) : passthroughArgs;

function pnpmArgs(args) {
  const npmExecPath = process.env.npm_execpath;
  return npmExecPath ? { command: process.execPath, args: [npmExecPath, ...args] } : { command: 'pnpm', args };
}

async function run(command, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('error', reject);
    child.on('close', code => {
      resolvePromise(code ?? 1);
    });
  });
}

async function runOrExit(command, args, env = {}) {
  const code = await run(command, args, env);
  if (code !== 0) {
    process.exit(code);
  }
}

async function listTypeScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'public') continue;
      files.push(...(await listTypeScriptFiles(path)));
      continue;
    }

    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.test.ts') || entry.name.endsWith('.mock.ts')) continue;
    files.push(path);
  }

  return files;
}

function addNames(modules, specifier, names) {
  if (!specifier.startsWith('@mastra/') && !specifier.startsWith('@internal/')) return;

  const module = modules.get(specifier) ?? { names: new Set(), hasDefault: false };
  for (const name of names) {
    if (name === 'type') continue;
    module.names.add(name);
  }
  modules.set(specifier, module);
}

function parseNamedImports(namedImports) {
  if (!namedImports) return [];

  return namedImports
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part =>
      part
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        ?.trim(),
    )
    .filter(Boolean);
}

async function createSourceTypecheckConfig(targetDir) {
  const srcDir = join(targetDir, 'src');
  const files = existsSync(srcDir) ? await listTypeScriptFiles(srcDir) : [];
  const modules = new Map();

  for (const file of files) {
    const source = await readFile(file, 'utf8');

    const importPattern =
      /import\s+(?:type\s+)?(?:(?<defaultImport>[\w$]+)\s*,\s*)?(?:(?:\*\s+as\s+[\w$]+)|\{(?<namedImports>[^}]+)\})?\s+from\s+['"](?<specifier>@(?:mastra|internal)\/[^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match.groups?.specifier;
      if (!specifier) continue;

      addNames(modules, specifier, parseNamedImports(match.groups?.namedImports));
      if (match.groups?.defaultImport) {
        const module = modules.get(specifier) ?? { names: new Set(), hasDefault: false };
        module.hasDefault = true;
        modules.set(specifier, module);
      }
    }

    const dynamicImportPattern =
      /\b(?:const|let|var)\s+\{(?<namedImports>[^}]+)\}\s*=\s*(?:await\s+)?import\(['"](?<specifier>@(?:mastra|internal)\/[^'"]+)['"]\)/g;
    for (const match of source.matchAll(dynamicImportPattern)) {
      const specifier = match.groups?.specifier;
      if (!specifier) continue;
      addNames(modules, specifier, parseNamedImports(match.groups?.namedImports));
    }
  }

  const packageName = target.replace(/^\.\//, '').replaceAll('/', '-');
  const workDir = join(repoRoot, '.mastra', 'source-typecheck', packageName);
  await rm(workDir, { recursive: true, force: true });
  await mkdir(workDir, { recursive: true });

  const shimsPath = join(workDir, 'workspace-shims.d.ts');
  const tsconfigPath = join(workDir, 'tsconfig.json');

  // Keep source-mode builds package-bounded: this checks the target package source without
  // recursively validating transitive workspace package implementation types.
  const declarations = [...modules.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([specifier, module]) => {
      const exports = [];
      const names = [...module.names].sort((left, right) => left.localeCompare(right));

      for (const name of names) {
        if (name === 'MastraError') {
          exports.push('  export class MastraError extends Error {', '    toJSONDetails(): any;', '  }');
          continue;
        }

        if (name === 'createWatcher') {
          exports.push(
            '  export function createWatcher(inputOptions: { plugins?: any[]; onwarn?: (warning: any) => void; [key: string]: any }, ...args: any[]): Promise<any>;',
            '  export type createWatcher = any;',
          );
          continue;
        }

        if (name === 'getWatcherInputOptions') {
          exports.push(
            '  export function getWatcherInputOptions(...args: any[]): Promise<{ logLevel?: any; plugins?: any[]; [key: string]: any }>;',
            '  export type getWatcherInputOptions = any;',
          );
          continue;
        }

        exports.push(`  export const ${name}: any;`, `  export type ${name} = any;`);
      }

      if (module.hasDefault) {
        exports.unshift('  export default defaultExport;', '  const defaultExport: any;');
      }

      if (exports.length === 0) {
        exports.push('  export const __sourceModeShim: any;');
      }

      return `declare module '${specifier}' {\n${exports.join('\n')}\n}`;
    })
    .join('\n\n');

  await writeFile(shimsPath, `${declarations}\n`, 'utf8');

  const pathMappings = Object.fromEntries(
    [...modules.keys()]
      .sort((left, right) => left.localeCompare(right))
      .map(specifier => [specifier, ['./workspace-shims.d.ts']]),
  );

  const relTargetConfig = relative(workDir, join(targetDir, 'tsconfig.json'));
  const relTargetSrc = relative(workDir, join(targetDir, 'src', '**', '*.ts'));
  const relTargetNodeModules = relative(workDir, join(targetDir, 'node_modules'));
  const relTargetTests = relative(workDir, join(targetDir, '**', '*.test.ts'));
  const relTargetMocks = relative(workDir, join(targetDir, '**', '*.mock.ts'));
  const relTargetDist = relative(workDir, join(targetDir, 'dist', '**'));
  const relTargetPublic = relative(workDir, join(targetDir, 'src', 'public', '**', '*.ts'));
  const relTargetEslintConfig = relative(workDir, join(targetDir, 'eslint.config.js'));

  await writeFile(
    tsconfigPath,
    `${JSON.stringify(
      {
        extends: relTargetConfig,
        compilerOptions: {
          noEmit: true,
          incremental: true,
          tsBuildInfoFile: './tsconfig.tsbuildinfo',
          ignoreDeprecations: '6.0',
          baseUrl: '.',
          paths: pathMappings,
        },
        include: [relTargetSrc, './workspace-shims.d.ts'],
        exclude: [
          relTargetNodeModules,
          relTargetTests,
          relTargetMocks,
          relTargetPublic,
          relTargetDist,
          relTargetEslintConfig,
        ],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  return tsconfigPath;
}

if (!repoSourceMode) {
  const { command, args } = pnpmArgs(['turbo', 'build', '--filter', target, ...turboArgs]);
  await runOrExit(command, args);
  process.exit(0);
}

console.log(`MASTRA_REPO_RUN_FROM_SOURCE=true: running source typecheck for ${target}`);
console.log('Skipping JS bundling and declaration emit.');

await runOrExit(process.execPath, ['scripts/source-exports.mjs', 'check'], {
  MASTRA_SOURCE_MODE: '1',
});

const targetDir = resolve(repoRoot, target);
const tsconfigPath = await createSourceTypecheckConfig(targetDir);
console.log(`Typechecking ${target}/src with ${relative(repoRoot, tsconfigPath)}.`);

await runOrExit(process.execPath, [join(repoRoot, 'node_modules/typescript/bin/tsc'), '-p', tsconfigPath], {
  MASTRA_REPO_RUN_FROM_SOURCE: 'true',
  MASTRA_SOURCE_MODE: '1',
});

console.log(`Source typecheck passed for ${target}.`);
