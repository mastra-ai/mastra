import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import * as storage from '@mastra/core/storage';
import { build } from 'tsdown';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

// Native Node loading catches missing named ESM exports before any runtime guard.
// Keep real core behavior, removing only the newer exports at the package boundary.
describe.each(['esm', 'cjs'] as const)('preview compatibility (%s)', format => {
  it.each([
    { mode: 'span', missing: [] },
    { mode: 'span', missing: ['buildPreview', 'PREVIEW_MAX_LENGTH'] },
    { mode: 'generic', missing: ['buildSpanPreviews'] },
    { mode: 'passthrough', missing: ['buildSpanPreviews', 'buildPreview', 'PREVIEW_MAX_LENGTH'] },
  ])('uses $mode previews when core lacks $missing', async ({ mode, missing }) => {
    const directory = await mkdtemp(join(import.meta.dirname, '.preview-compat-'));
    try {
      const extension = format === 'esm' ? 'mjs' : 'cjs';
      const compatibilityModule = join(directory, `storage.${extension}`);
      const names = Object.keys(storage).filter(name => !missing.includes(name));
      await writeFile(
        compatibilityModule,
        format === 'esm'
          ? `export { ${names.join(', ')} } from ${JSON.stringify(import.meta.resolve('@mastra/core/storage'))};`
          : `const storage = require(${JSON.stringify(require.resolve('@mastra/core/storage'))});
           for (const name of ${JSON.stringify(names)}) exports[name] = storage[name];`,
      );
      await build({
        config: false,
        entry: { previews: join(import.meta.dirname, 'span-previews.ts') },
        outDir: join(directory, 'dist'),
        format,
        dts: false,
        treeshake: true,
        outputOptions: { paths: { '@mastra/core/storage': compatibilityModule } },
        logLevel: 'silent',
      });
      const script =
        format === 'esm'
          ? `import { withSpanPreviews } from './dist/previews.mjs';`
          : `const { withSpanPreviews } = require('./dist/previews.cjs');`;
      await writeFile(
        join(directory, `run.${extension}`),
        `${script}
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
        expect(result[1]).toMatchObject(
          mode === 'span'
            ? {
                inputPreview: 'Tool: Order 123 was shipped',
                outputPreview: '{"orderId":"123"}',
                errorPreview: 'TimeoutError: Partial failure',
              }
            : {
                inputPreview: 'Find my order',
                outputPreview: 'Order shipped',
                errorPreview: 'Partial failure',
              },
        );
      }
      expect(result[2].errorPreview).toBe(mode === 'passthrough' ? undefined : '');
      expect(result[1].output).toEqual({ object: { orderId: '123' }, text: 'Order shipped' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
