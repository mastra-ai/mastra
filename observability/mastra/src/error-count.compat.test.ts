import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as core from '@mastra/core/observability';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

describe.each(['esm', 'cjs'] as const)('error count compatibility (%s)', format => {
  it('exports unknown counts when the installed core predates origin accounting', async () => {
    const directory = await mkdtemp(join(import.meta.dirname, '.error-count-compat-'));
    try {
      const extension = format === 'esm' ? 'mjs' : 'cjs';
      const compatibilityModule = join(directory, `core.${extension}`);
      const names = Object.keys(core).filter(
        name => !['claimSpanError', 'getSpanErrorOrigin', 'setSpanErrorOrigin', 'withSpanErrorAttempt'].includes(name),
      );
      await writeFile(
        compatibilityModule,
        format === 'esm'
          ? `export { ${names.join(', ')} } from ${JSON.stringify(import.meta.resolve('@mastra/core/observability'))};`
          : `const core = require(${JSON.stringify(require.resolve('@mastra/core/observability'))});
           for (const name of ${JSON.stringify(names)}) exports[name] = core[name];`,
      );
      await build({
        config: false,
        entry: { instance: join(import.meta.dirname, 'instances/index.ts') },
        outDir: join(directory, 'dist'),
        format,
        dts: false,
        treeshake: true,
        external: [/^@mastra\/core(?:\/|$)/],
        outputOptions: { paths: { '@mastra/core/observability': compatibilityModule } },
        logLevel: 'silent',
      });
      await writeFile(
        join(directory, `run.${extension}`),
        `${
          format === 'esm'
            ? "import { DefaultObservabilityInstance } from './dist/instance.mjs';"
            : "const { DefaultObservabilityInstance } = require('./dist/instance.cjs');"
        }
        const obs = new DefaultObservabilityInstance({name:'compat',serviceName:'test',exporters:[]});
        const span = obs.startSpan({name:'agent',type:'agent_run'});
        span.error({error:new Error('failed')});
        const rebuilt = obs.rebuildSpan({...span.exportSpan(),errorCount:1,errorOccurrenceIds:['prior']});
        if (rebuilt.exportSpan().errorCount !== undefined) throw new Error('Unsupported accounting must stay unknown');
        process.stdout.write(JSON.stringify(span.exportSpan()));
      `,
      );
      const span = JSON.parse(
        execFileSync(process.execPath, [join(directory, `run.${extension}`)], { encoding: 'utf8' }),
      );
      expect(span.errorInfo.message).toBe('failed');
      expect(span).not.toHaveProperty('errorCount');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }, 20_000);
});
