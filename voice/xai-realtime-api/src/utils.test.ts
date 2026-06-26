import { PassThrough } from 'node:stream';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { int16ArrayToBase64, isReadableStream, readableToBase64, transformTools } from './utils';

describe('xAI realtime utils', () => {
  it('encodes PCM16 little-endian audio to base64', () => {
    expect(int16ArrayToBase64(new Int16Array([1, -1]))).toBe('AQD//w==');
  });

  it('detects Node readable streams', () => {
    expect(isReadableStream(new PassThrough())).toBe(true);
    expect(isReadableStream({})).toBe(false);
  });

  it('converts readable streams to base64', async () => {
    const stream = new PassThrough();
    stream.end(Buffer.from([1, 2, 3]));

    await expect(readableToBase64(stream)).resolves.toBe('AQID');
  });

  it('converts Zod tool schemas to xAI function parameters', () => {
    const [tool] = transformTools({
      getWeather: {
        id: 'getWeather',
        description: 'Get weather',
        inputSchema: z.object({
          location: z.string(),
        }),
        execute: async () => ({ temperature: 22 }),
      },
    });

    expect(tool?.xaiTool).toMatchObject({
      type: 'function',
      name: 'getWeather',
      description: 'Get weather',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string' },
        },
        required: ['location'],
      },
    });
  });

  it('passes Mastra tool invocation options through transformed tools', async () => {
    const execute = vi.fn().mockResolvedValue({ ok: true });
    const [tool] = transformTools({
      lookup: {
        id: 'lookup',
        description: 'Lookup',
        inputSchema: z.object({ id: z.string() }),
        execute,
      },
    });

    await tool?.execute({ id: '123' }, { toolCallId: 'call_123', requestContext: { userId: 'user-1' } });

    expect(execute).toHaveBeenCalledWith(
      { id: '123' },
      {
        toolCallId: 'call_123',
        messages: [],
        requestContext: { userId: 'user-1' },
      },
    );
  });

  it('warns through the provided logger when skipping tools without execute functions', () => {
    const logger = { warn: vi.fn() };

    const tools = transformTools(
      {
        lookup: {
          id: 'lookup',
          description: 'Lookup',
          inputSchema: z.object({ id: z.string() }),
        },
      },
      logger,
    );

    expect(tools).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('Skipping xAI realtime tool "lookup" because it has no execute function.');
  });

  it('falls back to console.warn when no logger is provided', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      transformTools({
        lookup: {
          id: 'lookup',
          description: 'Lookup',
          inputSchema: z.object({ id: z.string() }),
        },
      });

      expect(warn).toHaveBeenCalledWith('Skipping xAI realtime tool "lookup" because it has no execute function.');
    } finally {
      warn.mockRestore();
    }
  });
});
