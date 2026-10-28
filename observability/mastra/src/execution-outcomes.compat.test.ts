import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as observability from '@mastra/core/observability';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe.each(['esm', 'cjs'] as const)('older core outcome compatibility (%s)', format => {
  it('loads the model tracker and observer failure handling without the new helpers', async () => {
    const directory = await mkdtemp(join(import.meta.dirname, '.outcome-compat-'));
    try {
      const extension = format === 'esm' ? 'mjs' : 'cjs';
      const compatibilityModule = join(directory, `observability.${extension}`);
      const names = Object.keys(observability).filter(
        name => !['executionFailureTermination', 'agentLoopTermination'].includes(name),
      );
      await writeFile(
        compatibilityModule,
        format === 'esm'
          ? `export { ${names.join(', ')} } from ${JSON.stringify(import.meta.resolve('@mastra/core/observability'))};`
          : `const source = require(${JSON.stringify(require.resolve('@mastra/core/observability'))});
           for (const name of ${JSON.stringify(names)}) exports[name] = source[name];`,
      );
      await build({
        config: false,
        entry: {
          tracker: join(import.meta.dirname, 'model-tracing.ts'),
          observer: join(import.meta.dirname, '../../../packages/memory/src/processors/observational-memory/error.ts'),
        },
        outDir: join(directory, 'dist'),
        format,
        dts: false,
        logLevel: 'silent',
        external: [/^@mastra\/core(?:\/|$)/],
        outputOptions: { paths: { '@mastra/core/observability': compatibilityModule } },
      });
      const script = join(directory, `run.${extension}`);
      await writeFile(
        script,
        `${
          format === 'esm'
            ? "import { ModelSpanTracker } from './dist/tracker.mjs'; import { getOmFailureMetadata } from './dist/observer.mjs';"
            : "const { ModelSpanTracker } = require('./dist/tracker.cjs'); const { getOmFailureMetadata } = require('./dist/observer.cjs');"
        }
        const tracker = new ModelSpanTracker();
        tracker.reportGenerationError({error: new Error('provider failed')});
        tracker.endGeneration({outcome:'abort', stopReason:'caller_cancelled'});
        process.stdout.write(JSON.stringify(getOmFailureMetadata(new Error('storage failed'), 'abort')));`,
      );
      expect(JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' }))).toEqual({
        failurePolicy: 'abort',
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
