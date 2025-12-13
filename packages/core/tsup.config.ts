import fs from 'node:fs';
import path from 'node:path';
import babel from '@babel/core';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

import treeshakeDecoratorsBabelPlugin from './tools/treeshake-decorators';

type Plugin = NonNullable<Options['plugins']>[number];

let treeshakeDecorators = {
  name: 'treeshake-decorators',
  renderChunk(code: string, info: { path: string }) {
    if (!code.includes('__decoratorStart')) {
      return null;
    }

    return new Promise((resolve, reject) => {
      babel.transform(
        code,
        {
          babelrc: false,
          configFile: false,
          filename: info.path,
          plugins: [treeshakeDecoratorsBabelPlugin],
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }

          resolve({
            code: result!.code!,
            map: result!.map!,
          });
        },
      );
    });
  },
} satisfies Plugin;

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/base.ts',
    'src/utils.ts',
    '!src/action/index.ts',
    'src/*/index.ts',
    'src/tools/is-vercel-tool.ts',
    'src/workflows/constants.ts',
    'src/workflows/evented/index.ts',
    'src/network/index.ts',
    'src/network/vNext/index.ts',
    'src/vector/filter/index.ts',
    'src/test-utils/llm-mock.ts',
    'src/processors/index.ts',
    'src/zod-to-json.ts',
    'src/evals/scoreTraces/index.ts',
    'src/agent/message-list/index.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  plugins: [treeshakeDecorators],
  sourcemap: true,
  onSuccess: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await generateTypes(
      process.cwd(),
      new Set(['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/external-types']),
    );

    // Copy provider-registry.json to dist folder
    const srcJson = path.join(process.cwd(), 'src/llm/model/provider-registry.json');
    const distJson = path.join(process.cwd(), 'dist/provider-registry.json');

    if (fs.existsSync(srcJson)) {
      fs.copyFileSync(srcJson, distJson);
      console.info('✓ Copied provider-registry.json to dist/');
    }

    // Copy provider-types.generated.d.ts to dist/llm/model/ folder
    const srcDts = path.join(process.cwd(), 'src/llm/model/provider-types.generated.d.ts');
    const distDtsDir = path.join(process.cwd(), 'dist/llm/model');
    const distDts = path.join(distDtsDir, 'provider-types.generated.d.ts');

    if (fs.existsSync(srcDts)) {
      // Ensure directory exists
      if (!fs.existsSync(distDtsDir)) {
        fs.mkdirSync(distDtsDir, { recursive: true });
      }
      fs.copyFileSync(srcDts, distDts);
      console.info('✓ Copied provider-types.generated.d.ts to dist/llm/model/');
    }
  },
});
