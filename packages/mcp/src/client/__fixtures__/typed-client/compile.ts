import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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

/**
 * Compiles `source` at `path`, then recompiles it with `@ts-expect-error` directives
 * removed so the expected failures can be observed. Vitest transpilation alone would
 * not typecheck, so every type-level expectation is proved through a real `tsc` run.
 */
export function compileStrict(source: string, path: string) {
  writeFileSync(path, source);
  const strict = compileConsumer([path]);
  const directives = source.match(/@ts-expect-error/g)?.length ?? 0;
  let negative: ReturnType<typeof compileConsumer> | undefined;
  if (directives) {
    writeFileSync(path, source.replace(/@ts-expect-error/g, 'negative-case'));
    negative = compileConsumer([path]);
  }
  return { strict, negative, directives };
}
