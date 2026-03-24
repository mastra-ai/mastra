import fs from 'node:fs';
import path from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());

    const srcRollup = path.join(process.cwd(), 'src', 'metrics', 'pricing-data.jsonl');
    const distMetricsDir = path.join(process.cwd(), 'dist', 'metrics');
    const distRollup = path.join(distMetricsDir, 'pricing-model.jsonl');

    if (fs.existsSync(srcRollup)) {
      fs.mkdirSync(distMetricsDir, { recursive: true });
      fs.copyFileSync(srcRollup, distRollup);
      console.info('✓ Copied metrics/pricing-data.jsonl to dist/metrics/');
    }
  },
});
