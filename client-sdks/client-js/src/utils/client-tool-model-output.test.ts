import type { Tool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { getClientToolModelOutput } from './client-tool-model-output';

const toolWith = (toModelOutput?: (output: unknown) => unknown): Tool =>
  ({ id: 'test-tool', description: 'test', toModelOutput }) as unknown as Tool;

describe('getClientToolModelOutput', () => {
  it('returns undefined when the tool has no toModelOutput', async () => {
    expect(await getClientToolModelOutput(toolWith(undefined), { ok: true })).toBeUndefined();
  });

  it('returns undefined when the result is null or undefined', async () => {
    const tool = toolWith(() => ({ type: 'text', value: 'never called' }));
    expect(await getClientToolModelOutput(tool, null)).toBeUndefined();
    expect(await getClientToolModelOutput(tool, undefined)).toBeUndefined();
  });

  it('returns undefined when toModelOutput returns undefined', async () => {
    expect(
      await getClientToolModelOutput(
        toolWith(() => undefined),
        { ok: true },
      ),
    ).toBeUndefined();
  });

  it('passes through text output unchanged', async () => {
    const tool = toolWith(output => ({ type: 'text', value: `Result: ${(output as { ok: boolean }).ok}` }));
    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({ type: 'text', value: 'Result: true' });
  });

  it('supports async toModelOutput', async () => {
    const tool = toolWith(async () => ({ type: 'text', value: 'async result' }));
    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({ type: 'text', value: 'async result' });
  });

  it('normalizes media parts in content output to image-data and file-data', async () => {
    const tool = toolWith(() => ({
      type: 'content',
      value: [
        { type: 'text', text: 'Here is the screenshot.' },
        { type: 'media', data: 'imgb64', mediaType: 'image/jpeg' },
        { type: 'media', data: 'pdfb64', mediaType: 'application/pdf' },
      ],
    }));

    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({
      type: 'content',
      value: [
        { type: 'text', text: 'Here is the screenshot.' },
        { type: 'image-data', data: 'imgb64', mediaType: 'image/jpeg' },
        { type: 'file-data', data: 'pdfb64', mediaType: 'application/pdf' },
      ],
    });
  });

  it('leaves already-normalized content parts unchanged', async () => {
    const output = {
      type: 'content',
      value: [{ type: 'image-data', data: 'imgb64', mediaType: 'image/png' }],
    };
    expect(
      await getClientToolModelOutput(
        toolWith(() => output),
        { ok: true },
      ),
    ).toEqual(output);
  });
});
