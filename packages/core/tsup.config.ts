import fs from 'node:fs';
import path from 'node:path';
import babel from '@babel/core';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

const pkg = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'package.json'), 'utf-8'));

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
    'src/observability/context-storage.ts',
    'src/tools/is-vercel-tool.ts',
    'src/workflows/constants.ts',
    'src/storage/constants.ts',
    'src/workflows/evented/index.ts',
    'src/network/index.ts',
    'src/network/vNext/index.ts',
    'src/vector/filter/index.ts',
    'src/test-utils/llm-mock.ts',
    'src/a2a/client.ts',
    'src/processors/index.ts',
    'src/zod-to-json.ts',
    'src/utils/collect-tool-mocks.ts',
    'src/evals/scoreTraces/index.ts',
    'src/agent/message-list/index.ts',
    'src/agent/durable/index.ts',
    'src/auth/ee/index.ts',
    'src/agent-builder/ee/index.ts',
    'src/storage/domains/agents/index.ts',
    'src/storage/domains/mcp-clients/index.ts',
    'src/storage/domains/mcp-servers/index.ts',
    'src/storage/domains/prompt-blocks/index.ts',
    'src/storage/domains/scorer-definitions/index.ts',
    'src/storage/domains/skills/index.ts',
    'src/storage/domains/favorites/index.ts',
    'src/storage/domains/workspaces/index.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  plugins: [treeshakeDecorators],
  define: {
    __MASTRA_VERSION__: JSON.stringify(pkg.version),
  },
  sourcemap: true,
  onSuccess: async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    // `chat` is ESM-only, so the CJS build must never contain `require('chat')` (it would
    // crash CJS consumers). The lazy `import('chat')` in src/channels/chat-lazy.ts stays
    // native in `.cjs` output only because the `treeshake` option above emits CJS through
    // Rollup — without it, tsup rewrites the import to a multiline `require(... 'chat')`.
    const cjsRequireChat = /require\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(['"])chat\1\s*\)/;
    for (const file of fs.readdirSync(path.join(process.cwd(), 'dist'), { recursive: true, encoding: 'utf-8' })) {
      const filePath = path.join(process.cwd(), 'dist', file);
      if (file.endsWith('.cjs') && cjsRequireChat.test(fs.readFileSync(filePath, 'utf-8'))) {
        throw new Error(
          `${filePath} contains require('chat'), which crashes CJS consumers because chat is ESM-only. ` +
            `Keep the dynamic import in src/channels/chat-lazy.ts and the tsup 'treeshake' option intact.`,
        );
      }
    }
    await generateTypes(
      process.cwd(),
      new Set([
        '@ai-sdk/*',
        'eventsource-parser',
        '@internal/ai-sdk-v4',
        '@internal/ai-sdk-v5',
        '@internal/ai-v6',
        '@internal/ai-v7',
        '@internal/external-types',
        '@internal/core',
        '@internal/voice',
        'hono',
        'hono-openapi',
        '@internal/auth',
      ]),
    );

    // Copy provider-registry.json to dist folder
    const srcJson = path.join(process.cwd(), 'src/llm/model/provider-registry.json');
    const distJson = path.join(process.cwd(), 'dist/provider-registry.json');

    if (fs.existsSync(srcJson)) {
      fs.copyFileSync(srcJson, distJson);
      console.info('✓ Copied provider-registry.json to dist/');
    }

    // Copy capabilities/ directory to dist/
    const srcCapDir = path.join(process.cwd(), 'src/llm/model/capabilities');
    const distCapDir = path.join(process.cwd(), 'dist/capabilities');

    if (fs.existsSync(srcCapDir)) {
      if (!fs.existsSync(distCapDir)) {
        fs.mkdirSync(distCapDir, { recursive: true });
      }
      for (const file of fs.readdirSync(distCapDir).filter((f: string) => f.endsWith('.json'))) {
        fs.unlinkSync(path.join(distCapDir, file));
      }
      const capFiles = fs.readdirSync(srcCapDir).filter((f: string) => f.endsWith('.json'));
      for (const file of capFiles) {
        fs.copyFileSync(path.join(srcCapDir, file), path.join(distCapDir, file));
      }
      console.info(`✓ Copied ${capFiles.length} capability files to dist/capabilities/`);
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
