import fs, { writeFileSync, readFileSync, readdirSync, copyFileSync } from 'fs';
import path, { dirname, join, relative } from 'path';

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

function fixDtsFiles(dir: string) {
  const files = readdirSync(dir, { recursive: true });

  const typeFile = process.cwd() + '/dist/ai-sdk.types.d.ts';
  files.forEach(file => {
    if (file.toString().endsWith('.d.ts')) {
      const filePath = join(dir, file.toString());
      const relativePath = relative(dirname(filePath), typeFile);
      let content = readFileSync(filePath, 'utf-8');

      const hasV4Import = content.includes('@internal/ai-sdk-v4');
      // Replace imports from @internal/utils to local file
      content = content.replace(/from ['"]@internal\/ai-sdk-v4['"]/g, `from '${relativePath}'`);
      content = content.replace(/import\(['"]@internal\/ai-sdk-v4['"]/g, `import('${relativePath}'`);

      // content = content.replace(
      //   /import\(['"]@internal\/utils['"]\)/g,
      //   `import('./utils')`
      // );

      if (hasV4Import) {
        console.info(`\t updated ${filePath}`);
      }
      writeFileSync(filePath, content);
    }
  });
}

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
    await generateTypes(process.cwd());

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

    const typeFilePath = path.join(process.cwd(), 'src/_types/ai-sdk.types.d.ts');
    copyFileSync(typeFilePath, path.join(process.cwd(), 'dist/ai-sdk.types.d.ts'));
    console.info('* Fixing local ai-sdk v4 types');
    fixDtsFiles(path.join(process.cwd(), 'dist'));
    console.info('✓ Fixed local ai-sdk v4 types');
  },
});
