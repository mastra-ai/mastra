import { deflateSync, inflateSync } from 'node:zlib';
import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import { decode as decodeJpeg, encode as encodeJpeg } from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import type { ProcessLLMRequestArgs } from '../index';
import { ImageDownscaler } from './image-downscaler';
import { downscaleImage, readImageDimensions } from './image-resize';

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGB PNG, top half red and bottom half blue, each row with a different filter. */
function makePng(width: number, height: number): Buffer {
  const stride = width * 3;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = y * stride + x * 3;
      if (y < height / 2) pixels[offset] = 255;
      else pixels[offset + 2] = 255;
    }
  }
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const filter = y % 5;
    raw[y * (stride + 1)] = filter;
    for (let x = 0; x < stride; x++) {
      const value = pixels[y * stride + x]!;
      const left = x >= 3 ? pixels[y * stride + x - 3]! : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const upLeft = x >= 3 && y > 0 ? pixels[(y - 1) * stride + x - 3]! : 0;
      const p = left + up - upLeft;
      const predictor =
        Math.abs(p - left) <= Math.abs(p - up) && Math.abs(p - left) <= Math.abs(p - upLeft)
          ? left
          : Math.abs(p - up) <= Math.abs(p - upLeft)
            ? up
            : upLeft;
      const predicted = [0, left, up, (left + up) >> 1, predictor][filter]!;
      raw[y * (stride + 1) + 1 + x] = (value - predicted) & 0xff;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

function pixelAt(png: Uint8Array, x: number, y: number): number[] {
  const { width } = readImageDimensions(png)!;
  // Undo the Sub filter encodePng writes on every RGBA row.
  const idatStart = png.indexOf(Buffer.from('IDAT')) + 4;
  const idatLength = Buffer.from(png).readUInt32BE(idatStart - 8);
  const raw = inflateSync(png.subarray(idatStart, idatStart + idatLength));
  const stride = width * 4;
  const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
  const decoded = new Uint8Array(stride);
  for (let i = 0; i < stride; i++) decoded[i] = row[i]! + (i >= 4 ? decoded[i - 4]! : 0);
  return Array.from(decoded.subarray(x * 4, x * 4 + 4));
}

const llmRequest = (prompt: LanguageModelV2Prompt) => ({ prompt }) as unknown as ProcessLLMRequestArgs;

describe('downscaleImage', () => {
  it('scales a tall PNG to fit the limit and keeps the picture', () => {
    const resized = downscaleImage(makePng(64, 600), { maxDimension: 100 })!;

    expect(resized.mediaType).toBe('image/png');
    expect(readImageDimensions(resized.data)).toEqual({ width: 11, height: 100 });
    expect(pixelAt(resized.data, 5, 10)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(resized.data, 5, 90)).toEqual([0, 0, 255, 255]);
  });

  it('scales a JPEG and keeps it a JPEG', () => {
    const jpeg = encodeJpeg({ width: 300, height: 40, data: Buffer.alloc(300 * 40 * 4, 200) }, 90).data;

    const resized = downscaleImage(jpeg, { maxDimension: 150 })!;

    expect(resized.mediaType).toBe('image/jpeg');
    expect(readImageDimensions(resized.data)).toEqual({ width: 150, height: 20 });
    const decoded = decodeJpeg(resized.data);
    expect(decoded.data[0]).toBeGreaterThan(190);
  });

  it('leaves images that fit, and formats it cannot decode, alone', () => {
    expect(downscaleImage(makePng(50, 50), { maxDimension: 100 })).toBeUndefined();
    expect(downscaleImage(Buffer.from('GIF89a not really'), { maxDimension: 1 })).toBeUndefined();
  });
});

describe('ImageDownscaler', () => {
  const big = makePng(40, 400);

  it('downscales user images and tool-result screenshots in the prompt', () => {
    const processor = new ImageDownscaler({ maxDimension: 100 });
    const prompt: LanguageModelV2Prompt = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          { type: 'file', mediaType: 'image/png', data: `data:image/png;base64,${big.toString('base64')}` },
        ],
      },
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'browser_screenshot',
            output: {
              type: 'content',
              value: [{ type: 'media', mediaType: 'image/png', data: big.toString('base64') }],
            },
          },
        ],
      },
    ];

    const result = processor.processLLMRequest(llmRequest(prompt));

    const userFile = result.prompt![0]!.content[1] as { data: Uint8Array };
    expect(readImageDimensions(userFile.data)).toEqual({ width: 10, height: 100 });
    const toolPart = result.prompt![1]!.content[0] as { output: { value: Array<{ data: string }> } };
    expect(readImageDimensions(Buffer.from(toolPart.output.value[0]!.data, 'base64'))).toEqual({
      width: 10,
      height: 100,
    });
    // The original prompt is not mutated.
    expect((prompt[1]!.content[0] as any).output.value[0].data).toBe(big.toString('base64'));
  });

  it('returns nothing when no image needs downscaling', () => {
    const processor = new ImageDownscaler({ maxDimension: 1000 });
    const prompt: LanguageModelV2Prompt = [
      { role: 'user', content: [{ type: 'file', mediaType: 'image/png', data: big }] },
      { role: 'user', content: [{ type: 'file', mediaType: 'image/png', data: new URL('https://example.com/a.png') }] },
    ];

    expect(processor.processLLMRequest(llmRequest(prompt))).toEqual({});
  });
});
