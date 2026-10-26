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
    { missing: ['buildPreview'] },
    { missing: ['PREVIEW_MAX_LENGTH'] },
    { missing: ['buildPreview', 'PREVIEW_MAX_LENGTH'] },
  ])('preserves spans when core lacks $missing', async ({ missing }) => {
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
          id: 'span', traceId: 'trace', type: 'agent_run',
          input: [{role:'user',content:'Find my order'}],
          output: {text:'Order shipped'}, errorInfo: {message:'Partial failure'},
          inputPreview: '', outputPreview: 'Caller supplied', errorPreview: null,
        };
        const result = withSpanPreviews(span);
        if (result !== span) throw new Error('Unsupported core must retain the original span');
        const withoutPreviews = {...span};
        delete withoutPreviews.inputPreview;
        delete withoutPreviews.outputPreview;
        delete withoutPreviews.errorPreview;
        process.stdout.write(JSON.stringify([result, withSpanPreviews(withoutPreviews)]));
      `,
      );
      const result = JSON.parse(
        execFileSync(process.execPath, [join(directory, `run.${extension}`)], { encoding: 'utf8' }),
      );
      expect(result[0]).toMatchObject({ inputPreview: '', outputPreview: 'Caller supplied', errorPreview: null });
      expect(result[1]).not.toHaveProperty('inputPreview');
      expect(result[1]).not.toHaveProperty('outputPreview');
      expect(result[1]).not.toHaveProperty('errorPreview');
      expect(result[1].output).toEqual({ text: 'Order shipped' });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
