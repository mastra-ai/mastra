import { spawn } from 'node:child_process';
import { builtinModules } from 'node:module';
import { glob as globby } from 'tinyglobby';
import fs from 'node:fs/promises';
import path from 'node:path';
import { statSync } from 'node:fs';
import { replaceTypes } from './replace-types.js';

const rgxFrom = /(?<=from )['|"](.*)['|"]/gm;
const importSpecifierRegex =
  /(?:import|export)\s+(?:type\s+)?(?:[^'\"]*?\s+from\s+)?['\"]([^'\"]+)['\"]|import\(\s*['\"]([^'\"]+)['\"]\s*\)/gm;
const nodeBuiltinModules = new Set([...builtinModules, ...builtinModules.map(moduleName => `node:${moduleName}`)]);

function isNodeBuiltinModuleSpecifier(moduleSpecifier) {
  for (const moduleName of nodeBuiltinModules) {
    if (moduleSpecifier === moduleName || moduleSpecifier.startsWith(`${moduleName}/`)) {
      return true;
    }
  }

  return false;
}

// pnpm-specific environment variables that npm doesn't recognize
// These cause "Unknown env config" warnings when passed to npx/npm
const pnpmSpecificEnvVars = new Set([
  'npm_config_catalog',
  'npm_config_verify-deps-before-run',
  'npm_config_npm-globalconfig',
  'npm_config__jsr-registry',
  'npm_config_patched-dependencies',
  'pnpm_config_catalog',
  'pnpm_config_verify-deps-before-run',
  'pnpm_config_npm-globalconfig',
  'pnpm_config__jsr-registry',
  'pnpm_config_patched-dependencies',
]);

/**
 * Get a filtered copy of process.env without pnpm-specific npm_config_* or pnpm_config_* variables
 * @returns {NodeJS.ProcessEnv}
 */
function getFilteredEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !pnpmSpecificEnvVars.has(key)));
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function getPackageName(moduleSpecifier) {
  if (
    moduleSpecifier.startsWith('.') ||
    moduleSpecifier.startsWith('/') ||
    isNodeBuiltinModuleSpecifier(moduleSpecifier)
  ) {
    return null;
  }

  if (moduleSpecifier.startsWith('@')) {
    return moduleSpecifier.split('/').slice(0, 2).join('/');
  }

  return moduleSpecifier.split('/')[0];
}

function getTypesPackageName(packageName) {
  if (packageName.startsWith('@')) {
    return `@types/${packageName.slice(1).replace('/', '__')}`;
  }

  return `@types/${packageName}`;
}

function matchesBundledPackage(packageName, bundledPackage) {
  if (bundledPackage.endsWith('/*')) {
    return packageName.startsWith(bundledPackage.slice(0, -1));
  }

  return packageName === bundledPackage || getTypesPackageName(packageName) === bundledPackage;
}

async function validateDeclarationRuntimeImports(rootDir, bundledPackages) {
  const packageJsonPath = path.join(rootDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  const runtimeDependencies = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
    ...Object.keys(packageJson.optionalDependencies ?? {}),
    ...(packageJson.bundleDependencies ?? []),
    ...(packageJson.bundledDependencies ?? []),
  ]);
  const devDependencies = new Set(Object.keys(packageJson.devDependencies ?? {}));
  const packageName = packageJson.name;
  const dtsFiles = await globby('dist/**/*.d.ts', {
    cwd: rootDir,
    onlyFiles: true,
  });
  const invalidImports = [];

  for (const dtsFile of dtsFiles) {
    if (dtsFile.includes('/_types/') || dtsFile.includes('\\_types\\')) {
      continue;
    }

    const fullPath = path.join(rootDir, dtsFile);
    const code = stripComments(await fs.readFile(fullPath, 'utf8'));

    for (const match of code.matchAll(importSpecifierRegex)) {
      const moduleSpecifier = match[1] ?? match[2];
      const importedPackage = getPackageName(moduleSpecifier);

      if (
        !importedPackage ||
        importedPackage === packageName ||
        runtimeDependencies.has(importedPackage) ||
        runtimeDependencies.has(getTypesPackageName(importedPackage)) ||
        Array.from(bundledPackages).some(bundledPackage => matchesBundledPackage(importedPackage, bundledPackage))
      ) {
        continue;
      }

      invalidImports.push({
        file: dtsFile,
        moduleSpecifier,
        importedPackage,
        reason: devDependencies.has(importedPackage) ? 'devDependency' : 'undeclared dependency',
      });
    }
  }

  if (!invalidImports.length) {
    return;
  }

  const details = invalidImports
    .map(({ file, moduleSpecifier, reason }) => `  - ${file} imports '${moduleSpecifier}' (${reason})`)
    .join('\n');

  throw new Error(
    `Generated declaration files reference packages that are not runtime dependencies. ` +
      `Add the package to generateTypes(..., bundledPackages), move it to dependencies/peerDependencies, or remove it from the public types.\n${details}`,
  );
}

// @see https://blog.devgenius.io/compiling-from-typescript-with-js-extension-e2b6de3e6baf
/**
 * Generate types for the given root directory and bundled packages.
 *
 * @param {string} rootDir
 * @param {Set<string>} bundledPackages
 * @returns {Promise<void>}
 */
export async function generateTypes(rootDir, bundledPackages = new Set()) {
  try {
    // Use spawn instead of exec to properly inherit stdio
    // Use shell: true for cross-platform compatibility
    const tscProcess = spawn('npx', ['tsc', '-p', 'tsconfig.build.json'], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      env: getFilteredEnv(),
    });

    await new Promise((resolve, reject) => {
      tscProcess.on('close', code => {
        if (code !== 0) {
          reject({ code });
        } else {
          resolve();
        }
      });

      tscProcess.on('error', reject);
    });

    const dtsFiles = await globby('dist/**/*.d.ts', {
      cwd: rootDir,
      onlyFiles: true,
    });

    for (const dtsFile of dtsFiles) {
      const fullPath = path.join(rootDir, dtsFile);
      if (bundledPackages.size) {
        try {
          await replaceTypes(fullPath, rootDir, bundledPackages);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.log(`failed to embed types: ${fullPath}`, err);
          throw err;
        }
      }
      if (dtsFile.includes('/_types/') || dtsFile.includes('\\_types\\')) {
        continue;
      }

      let modified = false;
      let code = (await fs.readFile(fullPath)).toString();

      code = code.replace(rgxFrom, (_, p) => {
        if (!(p.startsWith('./') || p.startsWith('../')) || p.endsWith('.js') || /\.d\.(ts|mts|cts)$/.test(p)) {
          return `'${p}'`;
        }

        modified = true;

        // if the import is a directory, append /index.js to it, else just add .js
        try {
          // console.log('statfsSync', path.join(path.dirname(fullPath), p));
          if (statSync(path.join(path.dirname(fullPath), p)).isDirectory()) {
            return `'${p}/index.js'`;
          }
        } catch {
          // do nothing
        }

        return `'${p}.js'`;
      });

      if (!modified) {
        continue;
      }

      await fs.writeFile(fullPath, code);
    }

    await validateDeclarationRuntimeImports(rootDir, bundledPackages);
  } catch (err) {
    // TypeScript errors are already printed to console via stdio: 'inherit'
    if (typeof err.code !== 'number') {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    process.exit(typeof err.code === 'number' ? err.code : 1);
  }
}
