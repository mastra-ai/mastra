import * as babel from '@babel/core';
import { currentTarget } from '@neon-rs/load';
import { familySync, GLIBC } from 'detect-libc';
import { dirname, join } from 'path';
import type { Plugin } from 'rollup';

import fsExtra from 'fs-extra/esm';

import { rewriteLibsqlImport } from '../babel/fix-libsql';

export function libSqlFix(): Plugin {
  return {
    name: 'libSqlFix',
    transform(code, id) {
      if (!id.includes('\\libsql\\index.js') && !id.includes('/libsql/index.js')) {
        return null;
      }

      return new Promise((resolve, reject) => {
        babel.transform(
          code,
          {
            babelrc: false,
            configFile: false,
            filename: id,
            plugins: [rewriteLibsqlImport],
          },
          (err, result) => {
            if (err) {
              return reject(err);
            }

            resolve({
              code: result!.code!,
              map: result!.map!,
            });
          },
        );
      });
    },
    async generateBundle({ file, dir }) {
      if (!file && !dir) {
        throw new Error('No output options were given.');
      }

      const outputDirectory = dir || dirname(file!);

      let target = currentTarget();
      // Workaround for Bun, which reports a musl target, but really wants glibc...
      if (familySync() == GLIBC) {
        switch (target) {
          case 'linux-x64-musl':
            target = 'linux-x64-gnu';
            break;
          case 'linux-arm64-musl':
            target = 'linux-arm64-gnu';
            break;
        }
      }

      const fileToCopy = await this.resolve(`@libsql/${target}/index.node`);
      if (fileToCopy) {
        await fsExtra.copy(fileToCopy.id, join(outputDirectory, 'libsql.node'));
      } else {
        // throw new Error(`libsql binding not found for @libsql/${target}/index.node`);
      }
    },
  } satisfies Plugin;
}
