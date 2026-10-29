import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

// Execute native Node modules: a missing named export fails before runtime guards.
describe.each(['esm', 'cjs'] as const)('outcome compatibility (%s)', format => {
  it.each([false, true])('loads older core with feature flag=%s', async enabled => {
    const directory = await mkdtemp(join(import.meta.dirname, '.outcome-compat-'));
    try {
      const extension = format === 'esm' ? 'mjs' : 'cjs';
      const features = join(directory, `features.${extension}`);
      const olderCore = join(directory, `older-core.${extension}`);
      await writeFile(
        features,
        `${format === 'esm' ? 'export const coreFeatures =' : 'exports.coreFeatures ='} new Set(${JSON.stringify(enabled ? ['execution-outcomes'] : [])});`,
      );
      await writeFile(olderCore, format === 'esm' ? 'export const legacy = true;' : 'exports.legacy = true;');
      await build({
        config: false,
        entry: { compat: join(import.meta.dirname, 'observability-compat.ts') },
        outDir: join(directory, 'dist'),
        format,
        dts: false,
        logLevel: 'silent',
        external: [/^@mastra\/core(?:\/|$)/],
        outputOptions: {
          paths: {
            '@mastra/core/features': features,
            '@mastra/core/agent/durable': olderCore,
            '@mastra/core/observability': olderCore,
            '@mastra/core/workflows': olderCore,
          },
        },
      });
      const script = join(directory, `run.${extension}`);
      await writeFile(
        script,
        `${
          format === 'esm'
            ? "import { workflowTermination, agentLoopTermination, endRunSpansWithError } from './dist/compat.mjs';"
            : "const { workflowTermination, agentLoopTermination, endRunSpansWithError } = require('./dist/compat.cjs');"
        }
        endRunSpansWithError('run-id', new Error('deadline'));
        process.stdout.write(JSON.stringify([workflowTermination({status:'failed'}), agentLoopTermination({finishReason:'stop'})]));`,
      );
      expect(JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' }))).toEqual([{}, {}]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
