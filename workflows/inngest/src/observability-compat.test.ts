import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { coreFeatures } from '@mastra/core/features';
import * as coreObservability from '@mastra/core/observability';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

// The package must load on every core its peer range allows. An ESM import of a named export the
// core lacks fails at link time, before any runtime guard runs, so the whole package entry is
// built and loaded against a core missing the helper this package's workflows save at suspend.
describe('workflow resume tracing compatibility', () => {
  it.each([
    {
      core: 'with the lineage helper (1.81)',
      missing: ['getWorkflowResumeTracingContext'],
      saved: { traceId: 'trace-1', spanId: 'span-1', parentSpanId: 'parent-1', resumedFromSpanId: 'span-1' },
    },
    {
      core: 'without any resume helper (1.80)',
      missing: ['getWorkflowResumeTracingContext', 'getResumeTracingContext'],
      saved: { traceId: 'trace-1', spanId: 'span-1' },
    },
  ])('loads on a core $core and saves the lineage it knows', async ({ missing, saved }) => {
    const directory = await mkdtemp(join(import.meta.dirname, '.resume-compat-'));
    try {
      const observability = join(directory, 'older-observability.mjs');
      const features = join(directory, 'older-features.mjs');
      const kept = Object.keys(coreObservability).filter(name => !missing.includes(name));
      await writeFile(observability, `export { ${kept.join(', ')} } from '@mastra/core/observability';`);
      await writeFile(
        features,
        `export const coreFeatures = new Set(${JSON.stringify([...coreFeatures].filter(flag => flag !== 'workflow-resume-sampling'))});`,
      );
      await build({
        config: false,
        entry: {
          index: join(import.meta.dirname, 'index.ts'),
          compat: join(import.meta.dirname, 'observability-compat.ts'),
        },
        outDir: join(directory, 'dist'),
        format: 'esm',
        dts: false,
        logLevel: 'silent',
        external: [/^(?!@internal\/)[^./]/],
        outputOptions: {
          paths: { '@mastra/core/features': features, '@mastra/core/observability': observability },
        },
      });
      const script = join(directory, 'run.mjs');
      await writeFile(
        script,
        `await import('./dist/index.mjs');
        const { workflowResumeTracingContext } = await import('./dist/compat.mjs');
        process.stdout.write(JSON.stringify(workflowResumeTracingContext({ id: 'span-1', traceId: 'trace-1', parentSpanId: 'parent-1' })));`,
      );
      expect(JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' }))).toEqual(saved);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

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
            ? "import { workflowTermination, agentLoopTermination, generationUsage } from './dist/compat.mjs';"
            : "const { workflowTermination, agentLoopTermination, generationUsage } = require('./dist/compat.cjs');"
        }
        process.stdout.write(JSON.stringify([workflowTermination({status:'failed'}), agentLoopTermination({finishReason:'stop'}), generationUsage({inputTokens:3},[]).usage]));`,
      );
      expect(JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' }))).toEqual([
        {},
        {},
        { inputTokens: 3 },
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
