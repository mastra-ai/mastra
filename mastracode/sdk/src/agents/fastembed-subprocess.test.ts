import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { embedInSubprocess } from './fastembed-subprocess.js';

// Stand-ins for @mastra/fastembed: the worker imports whatever entry it is given.
function fixture(body: string): string {
  const file = join(mkdtempSync(join(tmpdir(), 'fastembed-subprocess-')), 'fastembed.mjs');
  writeFileSync(file, `export const fastembed = { small: { async doEmbed({ values }) { ${body} } } };\n`);
  return pathToFileURL(file).href;
}

describe('embedInSubprocess', () => {
  it('embeds in a child process and returns its vectors', async () => {
    const entry = fixture(
      'return { embeddings: values.map(v => [v.length, process.pid]), warnings: [{ type: "other", message: "w" }] };',
    );
    const result = await embedInSubprocess({ values: ['ab', 'abcd'] }, entry);
    expect(result.embeddings.map(e => e[0])).toEqual([2, 4]);
    expect(result.embeddings[0]![1]).not.toBe(process.pid);
    expect(result.warnings).toEqual([{ type: 'other', message: 'w' }]);
  });

  it('rejects with the worker error', async () => {
    const entry = fixture('throw new Error("model missing");');
    await expect(embedInSubprocess({ values: ['x'] }, entry)).rejects.toThrow('model missing');
  });

  it('rejects when the worker is killed, as the OOM killer would', async () => {
    const entry = fixture('process.kill(process.pid, "SIGKILL");');
    await expect(embedInSubprocess({ values: ['x'] }, entry)).rejects.toThrow(/signal SIGKILL/);
  });

  it('runs one worker at a time', async () => {
    const entry = fixture(
      'const t0 = Date.now(); await new Promise(r => setTimeout(r, 200)); return { embeddings: [[t0, Date.now()]], warnings: [] };',
    );
    const [a, b] = await Promise.all([
      embedInSubprocess({ values: ['a'] }, entry),
      embedInSubprocess({ values: ['b'] }, entry),
    ]);
    const [[aStart, aEnd], [bStart]] = [a.embeddings[0]!, b.embeddings[0]!];
    expect(bStart! >= aEnd! || aStart! >= b.embeddings[0]![1]!).toBe(true);
  });

  it('kills the worker on abort', async () => {
    const entry = fixture('await new Promise(r => setTimeout(r, 30_000)); return { embeddings: [[1]], warnings: [] };');
    const controller = new AbortController();
    const pending = embedInSubprocess({ values: ['x'], abortSignal: controller.signal }, entry);
    setTimeout(() => controller.abort(new Error('stop')), 300);
    await expect(pending).rejects.toThrow('stop');
  });
});
