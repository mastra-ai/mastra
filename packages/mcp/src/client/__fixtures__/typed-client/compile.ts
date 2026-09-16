import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const require = createRequire(import.meta.url);

export function compileConsumer(rootNames: string[]) {
  return spawnSync(
    process.execPath,
    [
      resolve(dirname(require.resolve('typescript/package.json')), require('typescript/package.json').bin.tsc),
      '--ignoreConfig',
      '--strict',
      '--noEmit',
      '--skipLibCheck',
      '--types',
      'node',
      '--target',
      'ES2022',
      '--module',
      'ESNext',
      '--moduleResolution',
      'Bundler',
      '--esModuleInterop',
      '--pretty',
      'false',
      ...rootNames,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );
}
