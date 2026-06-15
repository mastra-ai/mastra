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

  it('passes through media parts in content output', async () => {
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
        { type: 'media', data: 'imgb64', mediaType: 'image/jpeg' },
        { type: 'media', data: 'pdfb64', mediaType: 'application/pdf' },
      ],
    });
  });

  it('normalizes convenience and legacy content parts to media', async () => {
    const tool = toolWith(() => ({
      type: 'content',
      value: [
        { type: 'image-url', url: 'data:image/png;base64,imgb64' },
        { type: 'image-data', data: 'legacy-imgb64' },
        { type: 'file-data', data: 'legacy-fileb64' },
      ],
    }));

    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({
      type: 'content',
      value: [
        { type: 'media', data: 'data:image/png;base64,imgb64', mediaType: 'image/png' },
        { type: 'media', data: 'legacy-imgb64', mediaType: 'image/jpeg' },
        { type: 'media', data: 'legacy-fileb64', mediaType: 'application/octet-stream' },
      ],
    });
  });

  it('extracts media type from comma-delimited data URLs', async () => {
    const tool = toolWith(() => ({
      type: 'content',
      value: [{ type: 'image-url', url: 'data:image/svg+xml,<svg></svg>' }],
    }));

    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'data:image/svg+xml,<svg></svg>', mediaType: 'image/svg+xml' }],
    });
  });

  it('prefers explicit mediaType over data URL parsing', async () => {
    const tool = toolWith(() => ({
      type: 'content',
      value: [{ type: 'image-url', url: 'data:image/png;base64,imgb64', mediaType: 'image/webp' }],
    }));

    expect(await getClientToolModelOutput(tool, { ok: true })).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'data:image/png;base64,imgb64', mediaType: 'image/webp' }],
    });
  });
});
