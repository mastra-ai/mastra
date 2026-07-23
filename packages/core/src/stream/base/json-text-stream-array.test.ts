import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toStandardSchema } from '../../schema';
import { createJsonTextStreamTransformer } from './output-format-handlers';

async function runTransformer(schema: any, objectChunks: any[]): Promise<string> {
  const transformer = createJsonTextStreamTransformer(schema);
  const writer = transformer.writable.getWriter();
  const reader = transformer.readable.getReader();

  const out: string[] = [];
  const readAll = (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();

  for (const object of objectChunks) {
    await writer.write({ type: 'object', object, runId: '1', from: 'AGENT' } as any);
  }
  await writer.close();
  await readAll;

  return out.join('');
}

describe('createJsonTextStreamTransformer array output', () => {
  const schema = toStandardSchema(z.array(z.object({ a: z.number() }))) as any;

  it('produces valid JSON when the first chunk already has elements', async () => {
    const text = await runTransformer(schema, [[{ a: 1 }], [{ a: 1 }, { a: 2 }], [{ a: 1 }, { a: 2 }, { a: 3 }]]);

    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text)).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it('produces valid JSON for fine-grained streaming (first chunk empty)', async () => {
    const text = await runTransformer(schema, [[], [{ a: 1 }], [{ a: 1 }, { a: 2 }]]);

    expect(JSON.parse(text)).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('produces valid JSON for a single complete chunk', async () => {
    const text = await runTransformer(schema, [[{ a: 1 }, { a: 2 }]]);

    expect(JSON.parse(text)).toEqual([{ a: 1 }, { a: 2 }]);
  });
});
