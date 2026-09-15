import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TransformStream } from 'node:stream/web';
import { URL } from 'node:url';
import { TextDecoder, TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';
import { rspack, type Stats } from '@rspack/core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import aiV4BuildConfig from '../../../../packages/_vendored/ai_v4/tsdown.config.ts';

const packageRoot = path.resolve(import.meta.dirname, '../..');
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'mastra-ai-sdk-browser-'));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

it('keeps Node-only test tooling out of the browser-reachable build graph', () => {
  expect(aiV4BuildConfig.entry).toEqual(['src/index.ts', 'src/mcp-stdio.ts']);
});

it('loads toAISdkMessages in a browser bundle', async () => {
  const entry = path.join(tempDir, 'entry.js');
  const outputPath = path.join(tempDir, 'dist');
  await writeFile(
    entry,
    `import { toAISdkMessages } from ${JSON.stringify(path.join(packageRoot, 'src/ui.ts'))};\n` +
      `globalThis.convertedMessages = toAISdkMessages(['hello']);\n`,
  );

  const compiler = rspack({
    mode: 'development',
    target: 'web',
    entry,
    output: { path: outputPath, filename: 'bundle.js', publicPath: '' },
    resolve: { extensions: ['.ts', '.js'] },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: [{ loader: 'builtin:swc-loader', options: { jsc: { parser: { syntax: 'typescript' } } } }],
        },
      ],
    },
    // No resolve.fallback: any Node built-in leaking into the browser graph
    // must fail the bundle step instead of being polyfilled away.
  });

  const stats = await (async () => {
    try {
      return await new Promise<Stats>((resolve, reject) => {
        compiler.run((error, result) => {
          if (error) reject(error);
          else if (!result) reject(new Error('Rspack did not return build stats'));
          else resolve(result);
        });
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        compiler.close(error => (error ? reject(error) : resolve()));
      });
    }
  })();

  expect(stats.hasErrors(), stats.toString({ errors: true })).toBe(false);

  // Supply only the web globals touched during module initialization. Node-only
  // globals such as require, process, and Buffer remain unavailable.
  // `fetch` is a browser global too — @ai-sdk/provider-utils inspects it
  // (Function.prototype.toString) at module init, so it must be a function.
  const sandbox: {
    self?: unknown;
    convertedMessages?: unknown;
    TransformStream: typeof TransformStream;
    TextDecoder: typeof TextDecoder;
    TextEncoder: typeof TextEncoder;
    URL: typeof URL;
    fetch: typeof fetch;
  } = {
    TransformStream,
    TextDecoder,
    TextEncoder,
    URL,
    fetch: () => Promise.reject(new Error('fetch not available in sandbox')),
  };
  sandbox.self = sandbox;
  runInNewContext(await readFile(path.join(outputPath, 'bundle.js'), 'utf8'), sandbox);

  expect(sandbox.convertedMessages).toMatchObject([{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }]);
}, 30_000);
