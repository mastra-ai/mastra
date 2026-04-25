import { spawn } from 'child_process';
import { globby } from 'globby';
import fs from 'fs/promises';
import path from 'path';
import { existsSync, statSync } from 'fs';
import { replaceTypes } from './replace-types.js';

const rgxFrom = /(?<=from )['|"](.*)['|"]/gm;

// pnpm-specific environment variables that npm doesn't recognize
// These cause "Unknown env config" warnings when passed to npx/npm
const pnpmSpecificEnvVars = new Set([
  'npm_config_catalog',
  'npm_config_verify-deps-before-run',
  'npm_config_npm-globalconfig',
  'npm_config__jsr-registry',
  'npm_config_patched-dependencies',
]);

/**
 * Get a filtered copy of process.env without pnpm-specific npm_config_* variables
 * @returns {NodeJS.ProcessEnv}
 */
function getFilteredEnv() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !pnpmSpecificEnvVars.has(key)));
}

/**
 * Remove orphaned index.d.ts files that have no corresponding index.js.
 *
 * tsup bundles JS into single entry files (e.g. dist/auth/ee/index.js) but tsc
 * emits individual .d.ts files for every source file (e.g. dist/auth/ee/defaults/index.d.ts).
 * When a package uses a wildcard export like "./*", TypeScript resolves deep imports
 * that don't actually exist at runtime, causing MODULE_NOT_FOUND errors at deploy time.
 *
 * @param {string} rootDir
 * @returns {Promise<void>}
 */
async function cleanOrphanedDts(rootDir) {
  const indexDtsFiles = await globby('dist/**/index.d.ts', {
    cwd: rootDir,
    onlyFiles: true,
  });

  let removed = 0;

  for (const dtsFile of indexDtsFiles) {
    const dir = path.dirname(dtsFile);
    const jsFile = path.join(rootDir, dir, 'index.js');

    if (existsSync(jsFile)) {
      continue;
    }

    // Remove the orphaned index.d.ts and its sourcemap
    const fullDtsPath = path.join(rootDir, dtsFile);
    const fullMapPath = fullDtsPath + '.map';

    await fs.rm(fullDtsPath, { force: true });
    await fs.rm(fullMapPath, { force: true });
    removed++;
  }

  // Clean up directories that are now empty or contain only orphaned .d.ts/.d.ts.map files
  if (removed > 0) {
    await cleanEmptyDtsDirs(rootDir);
    // eslint-disable-next-line no-console
    console.log(`\u2713 Removed ${removed} orphaned index.d.ts files (no matching index.js)`);
  }
}

/**
 * Recursively remove directories under dist/ that contain only .d.ts and .d.ts.map files
 * but no .js files. These are leftover directories from tsc that had their index.d.ts removed.
 *
 * @param {string} rootDir
 * @returns {Promise<void>}
 */
async function cleanEmptyDtsDirs(rootDir) {
  const distDir = path.join(rootDir, 'dist');

  async function cleanDir(dir) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // Recurse into subdirectories first (bottom-up)
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await cleanDir(path.join(dir, entry.name));
      }
    }

    // Re-read after child cleanup
    entries = await fs.readdir(dir, { withFileTypes: true });

    if (entries.length === 0) {
      await fs.rmdir(dir);
      return;
    }

    // Check if directory only has .d.ts and .d.ts.map files (no .js, no subdirs)
    const hasNonDts = entries.some(e => {
      if (e.isDirectory()) return true;
      return !e.name.endsWith('.d.ts') && !e.name.endsWith('.d.ts.map');
    });

    if (!hasNonDts) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  // Only clean subdirectories of dist, not dist itself
  const topEntries = await fs.readdir(distDir, { withFileTypes: true });
  for (const entry of topEntries) {
    if (entry.isDirectory()) {
      await cleanDir(path.join(distDir, entry.name));
    }
  }
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
      let modified = false;
      let code = (await fs.readFile(fullPath)).toString();

      code = code.replace(rgxFrom, (_, p) => {
        if (!(p.startsWith('./') || p.startsWith('../')) || p.endsWith('.js')) {
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

    // Remove orphaned index.d.ts files that would create phantom exports
    await cleanOrphanedDts(rootDir);
  } catch (err) {
    // TypeScript errors are already printed to console via stdio: 'inherit'
    // Just exit with the same code as tsc
    process.exit(typeof err.code === 'number' ? err.code : 1);
  }
}
