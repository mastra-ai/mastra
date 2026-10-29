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
        name => !['executionFailureTermination', 'agentLoopTermination', 'compactStopReasonContext'].includes(name),
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
          instances: join(import.meta.dirname, 'instances/index.ts'),
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
            ? "import { DefaultObservabilityInstance } from './dist/instances.mjs'; import { ModelSpanTracker } from './dist/tracker.mjs'; import { getOmFailureMetadata } from './dist/observer.mjs';"
            : "const { DefaultObservabilityInstance } = require('./dist/instances.cjs'); const { ModelSpanTracker } = require('./dist/tracker.cjs'); const { getOmFailureMetadata } = require('./dist/observer.cjs');"
        }
        const events = [];
        const tracing = new DefaultObservabilityInstance({ name: 'compat', serviceName: 'compat', exporters: [{ name: 'capture', exportTracingEvent: async event => events.push(event), flush: async () => {}, shutdown: async () => {} }] });
        const span = tracing.startSpan({ name: 'run', type: 'agent_run', outcome: null });
        span.end({ outcome: 'blocked', stopReason: 'guardrail', stopReasonContext: { processorId: 'policy' } });
        if (span.exportSpan().stopReasonContext?.processorId !== 'policy') throw new Error('Custom context must be preserved on old core');
        const model = tracing.startSpan({ name: 'model', type: 'model_generation' });
        const tracker = new ModelSpanTracker(model);
        tracker.startStep();
        tracker.startInference();
        tracker.interruptInference();
        tracker.startInference();
        tracker.reportGenerationError({error: new Error('provider failed')});
        tracker.endGeneration();
        const attempts = events.filter(e => e.type === 'span_ended' && ['model_step', 'model_inference'].includes(e.exportedSpan.type));
        if (attempts.length !== 3) throw new Error('Expected step and inference exports');
        for (const event of attempts) {
          if (event.exportedSpan.outcome !== undefined) throw new Error('Older core must not opt into execution outcomes');
        }
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
