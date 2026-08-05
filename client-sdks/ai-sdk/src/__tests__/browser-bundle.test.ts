import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { rspack, type Stats } from '@rspack/core';
import { afterAll, beforeAll, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const packageRoot = path.resolve(import.meta.dirname, '../..');
let tempDir: string;

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'mastra-ai-sdk-browser-'));
});

afterAll(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

it('loads toAISdkMessages in a browser bundle', async () => {
  const entry = path.join(tempDir, 'entry.js');
  const outputPath = path.join(tempDir, 'dist');
  await writeFile(
    entry,
    `import { toAISdkMessages } from ${JSON.stringify(path.join(packageRoot, 'dist/ui.js'))};\n` +
      `globalThis.convertedMessages = toAISdkMessages(['hello']);\n`,
  );

  const compiler = rspack({
    mode: 'development',
    target: 'web',
    entry,
    output: { path: outputPath, filename: 'bundle.js', publicPath: '' },
    // No resolve.fallback: any Node built-in leaking into the browser graph
    // must fail the bundle step instead of being polyfilled away.
  });

  const stats = await new Promise<Stats>((resolve, reject) => {
    compiler.run((error, result) => {
      if (error) reject(error);
      else if (!result) reject(new Error('Rspack did not return build stats'));
      else resolve(result);
    });
  });
  await new Promise<void>((resolve, reject) => {
    compiler.close(error => (error ? reject(error) : resolve()));
  });

  expect(stats.hasErrors(), stats.toString({ errors: true })).toBe(false);

  // Execute the browser bundle in Node; rspack dev bundles reference `self`,
  // so alias it to globalThis first.
  const { stdout } = await execFileAsync(process.execPath, [
    '-e',
    `globalThis.self = globalThis; require(${JSON.stringify(path.join(outputPath, 'bundle.js'))}); process.stdout.write(JSON.stringify(globalThis.convertedMessages));`,
  ]);
  expect(JSON.parse(stdout)).toMatchObject([{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }]);
}, 30_000);
