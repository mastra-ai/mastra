import fs from 'node:fs';
import path from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

const DATA_FILE_NAME = 'pricing-data.jsonl';

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

    const srcData = path.join(process.cwd(), 'src', 'metrics', DATA_FILE_NAME);
    const distMetricsDir = path.join(process.cwd(), 'dist', 'metrics');
    const distData = path.join(distMetricsDir, DATA_FILE_NAME);

    if (!fs.existsSync(srcData)) {
      throw new Error(`Missing required metrics data file: ${srcData}`);
    }

    fs.mkdirSync(distMetricsDir, { recursive: true });
    fs.copyFileSync(srcData, distData);
    console.info(`✓ Copied metrics/${DATA_FILE_NAME} to dist/metrics/`);
  },
});
