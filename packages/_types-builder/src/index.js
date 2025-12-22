import { spawn } from 'child_process';
import { globby } from 'globby';
import fs from 'fs/promises';
import path from 'path';
import { statSync } from 'fs';
import { replaceTypes } from './replace-types.js';

const rgxFrom = /(?<=from )['|"](.*)['|"]/gm;

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
  } catch (err) {
    // TypeScript errors are already printed to console via stdio: 'inherit'
    // Just exit with the same code as tsc
    process.exit(typeof err.code === 'number' ? err.code : 1);
  }
}
