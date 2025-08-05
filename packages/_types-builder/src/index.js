import { exec as originalExec } from 'child_process';
import { promisify } from 'util';
import { globby } from 'globby';
import fs from 'fs/promises';
import path from 'path';
import { statSync } from 'fs';

const exec = promisify(originalExec);
const rgxFrom = /(?<=from )['|"](.*)['|"]/gm;

// @see https://blog.devgenius.io/compiling-from-typescript-with-js-extension-e2b6de3e6baf
export async function generateTypes(rootDir) {
  try {
    await exec('pnpm tsc -p tsconfig.build.json', {
      stdio: 'inherit',
      cwd: rootDir,
    });

    const dtsFiles = await globby('dist/**/*.d.ts', {
      cwd: rootDir,
      onlyFiles: true,
    });
    for (const dtsFile of dtsFiles) {
      const fullPath = path.join(rootDir, dtsFile);
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
    console.log(err);
    // debug here?
    throw err;
  }
}
