import { PassThrough } from 'node:stream';
import type { Request } from 'express';
import { describe, expect, it } from 'vitest';

import { parseMultipartFormData } from '../utils/parse-multipart';

const buildMultipartBody = (
  boundary: string,
  parts: Array<{
    name: string;
    filename?: string;
    contentType?: string;
    content: string | Buffer;
  }>,
): Buffer => {
  const buffers: Buffer[] = [];
  for (const part of parts) {
    buffers.push(Buffer.from(`--${boundary}\r\n`));
    const disposition = part.filename
      ? `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"\r\n`
      : `Content-Disposition: form-data; name="${part.name}"\r\n`;
    buffers.push(Buffer.from(disposition));
    if (part.contentType) {
      buffers.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`));
    }
    buffers.push(Buffer.from(`\r\n`));
    buffers.push(typeof part.content === 'string' ? Buffer.from(part.content) : part.content);
    buffers.push(Buffer.from(`\r\n`));
  }
  buffers.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(buffers);
};

const createMultipartRequest = (boundary: string, body: Buffer): Request => {
  const stream = new PassThrough();
  const req = stream as unknown as Request;
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'content-length': String(body.length),
  } as any;
  stream.end(body);
  return req;
};

describe('NestJS Adapter - Multipart FormData', () => {
  it('should parse file uploads as Buffers', async () => {
    const boundary = '----mastra-boundary-upload';
    const body = buildMultipartBody(boundary, [
      {
        name: 'audio',
        filename: 'test.wav',
        contentType: 'audio/wav',
        content: Buffer.from([0x52, 0x49, 0x46, 0x46]),
      },
    ]);

    const req = createMultipartRequest(boundary, body);
    const parsed = await parseMultipartFormData(req);

    expect(parsed.audio).toBeDefined();
    expect(Buffer.isBuffer(parsed.audio)).toBe(true);
    expect((parsed.audio as Buffer).length).toBe(4);
  });

  it('should parse JSON string fields in FormData', async () => {
    const boundary = '----mastra-boundary-options';
    const body = buildMultipartBody(boundary, [
      {
        name: 'audio',
        filename: 'test.wav',
        contentType: 'audio/wav',
        content: Buffer.from([1, 2, 3, 4]),
      },
      {
        name: 'options',
        content: JSON.stringify({ language: 'en', format: 'mp3' }),
      },
    ]);

    const req = createMultipartRequest(boundary, body);
    const parsed = await parseMultipartFormData(req);

    expect(typeof parsed.options).toBe('object');
    expect((parsed.options as any).language).toBe('en');
    expect((parsed.options as any).format).toBe('mp3');
  });

  it('should handle plain string fields in FormData', async () => {
    const boundary = '----mastra-boundary-string';
    const body = buildMultipartBody(boundary, [
      {
        name: 'audio',
        filename: 'test.wav',
        contentType: 'audio/wav',
        content: Buffer.from([1, 2, 3, 4]),
      },
      {
        name: 'name',
        content: 'test-recording',
      },
    ]);

    const req = createMultipartRequest(boundary, body);
    const parsed = await parseMultipartFormData(req);

    expect(parsed.name).toBe('test-recording');
  });

  it('should reject files exceeding size limit', async () => {
    const boundary = '----mastra-boundary-limit';
    const body = buildMultipartBody(boundary, [
      {
        name: 'audio',
        filename: 'large.wav',
        contentType: 'audio/wav',
        content: Buffer.alloc(200, 0x1),
      },
    ]);

    const req = createMultipartRequest(boundary, body);

    await expect(
      parseMultipartFormData(req, {
        maxFileSize: 100,
      }),
    ).rejects.toThrow();
  });

  it('should handle empty FormData gracefully', async () => {
    const boundary = '----mastra-empty-boundary';
    const body = Buffer.from(`--${boundary}--\r\n`);

    const req = createMultipartRequest(boundary, body);
    const parsed = await parseMultipartFormData(req);

    expect(Object.keys(parsed)).toEqual([]);
  });

  it('should handle multiple files', async () => {
    const boundary = '----mastra-boundary-multiple';
    const body = buildMultipartBody(boundary, [
      {
        name: 'file1',
        filename: 'file1.wav',
        contentType: 'audio/wav',
        content: Buffer.from([1, 2, 3]),
      },
      {
        name: 'file2',
        filename: 'file2.wav',
        contentType: 'audio/wav',
        content: Buffer.from([4, 5, 6]),
      },
    ]);

    const req = createMultipartRequest(boundary, body);
    const parsed = await parseMultipartFormData(req);

    expect(Buffer.isBuffer(parsed.file1)).toBe(true);
    expect(Buffer.isBuffer(parsed.file2)).toBe(true);
  });
});
