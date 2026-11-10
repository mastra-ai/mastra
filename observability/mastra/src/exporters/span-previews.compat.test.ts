import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as observability from '@mastra/core/observability';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

// Native Node loading catches missing named ESM exports before any runtime guard.
// Keep real core behavior, removing only the newer exports at the package boundary.
describe.each(['esm', 'cjs'] as const)('preview compatibility (%s)', format => {
  it.each([
    { mode: 'span', enabled: true, missing: [] },
    { mode: 'passthrough', enabled: false, missing: [] },
    { mode: 'passthrough', enabled: true, missing: ['buildSpanPreviews'] },
    { mode: 'passthrough', enabled: false, missing: ['buildSpanPreviews'] },
  ])('uses $mode previews with flag=$enabled and missing=$missing', async ({ mode, enabled, missing }) => {
    const directory = await mkdtemp(join(import.meta.dirname, '.preview-compat-'));
    try {
      const extension = format === 'esm' ? 'mjs' : 'cjs';
      const compatibilityModule = join(directory, `observability.${extension}`);
      const names = Object.keys(observability).filter(name => !missing.includes(name));
      await writeFile(
        compatibilityModule,
        format === 'esm'
          ? `export { ${names.join(', ')} } from ${JSON.stringify(import.meta.resolve('@mastra/core/observability'))};`
          : `const observability = require(${JSON.stringify(require.resolve('@mastra/core/observability'))});
           for (const name of ${JSON.stringify(names)}) exports[name] = observability[name];`,
      );
      const forbiddenStorageModule = join(directory, `storage.${extension}`);
      await writeFile(
        forbiddenStorageModule,
        "throw new Error('Exporter must not generate generic storage previews');",
      );
      await build({
        config: false,
        entry: { previews: join(import.meta.dirname, 'span-previews.ts') },
        outDir: join(directory, 'dist'),
        format,
        dts: false,
        treeshake: true,
        // Keep core at the package boundary so the fixtures also apply when run from the repository root.
        external: [/^@mastra\/core(?:\/|$)/],
        outputOptions: {
          paths: { '@mastra/core/observability': compatibilityModule, '@mastra/core/storage': forbiddenStorageModule },
        },
        logLevel: 'silent',
      });
      const script =
        format === 'esm'
          ? `import { withSpanPreviews } from './dist/previews.mjs';
             import { coreFeatures } from '@mastra/core/features';`
          : `const { withSpanPreviews } = require('./dist/previews.cjs');
             const { coreFeatures } = require('@mastra/core/features');`;
      await writeFile(
        join(directory, `run.${extension}`),
        `${script}
        if (!${enabled}) coreFeatures.delete('observability-span-previews');
        const span = {
          id: 'span', traceId: 'trace', type: 'model_step',
          input: [{role:'user',content:'Find my order'}, {role:'tool',content:'Order 123 was shipped'}],
          output: {object:{orderId:'123'},text:'Order shipped'}, errorInfo: {name:'TimeoutError',message:'Partial failure'},
          inputPreview: '', outputPreview: 'Caller supplied', errorPreview: '',
        };
        const result = withSpanPreviews(span);
        if (${JSON.stringify(mode)} === 'passthrough' && result !== span) throw new Error('Unsupported core must retain the original span');
        const withoutPreviews = {...span};
        delete withoutPreviews.inputPreview;
        delete withoutPreviews.outputPreview;
        delete withoutPreviews.errorPreview;
        const unsafeError = withSpanPreviews({...withoutPreviews, errorInfo: {
          message: {stack:'secret'}, stack:'secret', details:{token:'secret'},
        }});
        process.stdout.write(JSON.stringify([result, withSpanPreviews(withoutPreviews), unsafeError]));
      `,
      );
      const result = JSON.parse(
        execFileSync(process.execPath, [join(directory, `run.${extension}`)], { encoding: 'utf8' }),
      );
      expect(result[0]).toMatchObject({ inputPreview: '', outputPreview: 'Caller supplied', errorPreview: '' });
      if (mode === 'passthrough') {
        expect(result[1]).not.toHaveProperty('inputPreview');
        expect(result[1]).not.toHaveProperty('outputPreview');
        expect(result[1]).not.toHaveProperty('errorPreview');
      } else {
        expect(result[1]).toMatchObject({
          inputPreview: 'Tool: Order 123 was shipped',
          outputPreview: '{"orderId":"123"}',
          errorPreview: 'TimeoutError: Partial failure',
        });
      }
      expect(result[2].errorPreview).toBe(mode === 'passthrough' ? undefined : '');
      expect(result[1].output).toEqual({ object: { orderId: '123' }, text: 'Order shipped' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
