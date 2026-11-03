import { describe, expect, it } from 'vitest';
import { modelOutputToMcpContent } from './model-output-to-mcp';

const PNG = 'iVBORw0KGgo=';

describe('modelOutputToMcpContent', () => {
  it('maps text and json outputs to text blocks', () => {
    expect(modelOutputToMcpContent({ type: 'text', value: 'hello' }, 't')).toEqual({
      isError: false,
      content: [{ type: 'text', text: 'hello' }],
    });
    expect(modelOutputToMcpContent({ type: 'json', value: { a: 1 } }, 't')).toEqual({
      isError: false,
      content: [{ type: 'text', text: '{"a":1}' }],
    });
  });

  it('maps error outputs to isError results', () => {
    expect(modelOutputToMcpContent({ type: 'error-text', value: 'boom' }, 't')).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'boom' }],
    });
    expect(modelOutputToMcpContent({ type: 'error-json', value: { code: 'X' } }, 't')).toEqual({
      isError: true,
      content: [{ type: 'text', text: '{"code":"X"}' }],
    });
  });

  it('maps content parts to text, image, audio and resource blocks', () => {
    const result = modelOutputToMcpContent(
      {
        type: 'content',
        value: [
          { type: 'text', text: 'Read a.png' },
          { type: 'media', data: PNG, mediaType: 'image/png' },
          { type: 'media', data: 'UklGRg==', mediaType: 'audio/wav' },
          { type: 'media', data: 'JVBERi0=', mediaType: 'application/pdf' },
        ],
      },
      'read file',
    );
    expect(result).toEqual({
      isError: false,
      content: [
        { type: 'text', text: 'Read a.png' },
        { type: 'image', data: PNG, mimeType: 'image/png' },
        { type: 'audio', data: 'UklGRg==', mimeType: 'audio/wav' },
        {
          type: 'resource',
          resource: { uri: 'mastra://tool-output/read%20file/3', mimeType: 'application/pdf', blob: 'JVBERi0=' },
        },
      ],
    });
  });

  it('applies the default media types of image-data and file-data parts', () => {
    expect(
      modelOutputToMcpContent(
        {
          type: 'content',
          value: [
            { type: 'image-data', data: PNG },
            { type: 'file-data', data: 'AAAA', filename: 'x.bin' },
          ],
        },
        't',
      )?.content,
    ).toEqual([
      { type: 'image', data: PNG, mimeType: 'image/jpeg' },
      {
        type: 'resource',
        resource: { uri: 'mastra://tool-output/t/1', mimeType: 'application/octet-stream', blob: 'AAAA' },
      },
    ]);
  });

  it('strips data: URI prefixes from media data and decodes data: URLs', () => {
    expect(
      modelOutputToMcpContent(
        {
          type: 'content',
          value: [
            { type: 'media', data: `data:image/png;base64,${PNG}`, mediaType: 'image/png' },
            { type: 'image-url', url: `data:image/gif;base64,R0lG` },
            { type: 'file-url', url: 'data:text/plain,hi%20there' },
          ],
        },
        't',
      )?.content,
    ).toEqual([
      { type: 'image', data: PNG, mimeType: 'image/png' },
      { type: 'image', data: 'R0lG', mimeType: 'image/gif' },
      {
        type: 'resource',
        resource: {
          uri: 'mastra://tool-output/t/2',
          mimeType: 'text/plain',
          blob: Buffer.from('hi there').toString('base64'),
        },
      },
    ]);
  });

  it('keeps data: URI media type parameters except the base64 marker', () => {
    expect(
      modelOutputToMcpContent(
        {
          type: 'content',
          value: [
            { type: 'file-url', url: 'data:text/plain;charset=iso-8859-1,caf%E9' },
            { type: 'file-url', url: 'data:Text/CSV;header=present;base64,YSxi' },
          ],
        },
        't',
      )?.content,
    ).toEqual([
      {
        type: 'resource',
        resource: {
          uri: 'mastra://tool-output/t/0',
          mimeType: 'text/plain;charset=iso-8859-1',
          blob: Buffer.from([0x63, 0x61, 0x66, 0xe9]).toString('base64'),
        },
      },
      {
        type: 'resource',
        resource: { uri: 'mastra://tool-output/t/1', mimeType: 'text/csv;header=present', blob: 'YSxi' },
      },
    ]);
  });

  it('decodes percent-escapes in data: URIs as raw bytes', () => {
    expect(
      modelOutputToMcpContent(
        {
          type: 'content',
          value: [
            { type: 'image-url', url: 'data:image/png,%89PNG%0D%0A' },
            { type: 'file-url', url: 'data:text/plain,caf%C3%A9 ok' },
          ],
        },
        't',
      )?.content,
    ).toEqual([
      {
        type: 'image',
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString('base64'),
        mimeType: 'image/png',
      },
      {
        type: 'resource',
        resource: {
          uri: 'mastra://tool-output/t/1',
          mimeType: 'text/plain',
          blob: Buffer.from('café ok').toString('base64'),
        },
      },
    ]);
  });

  it('falls back to text for data: URIs that cannot be decoded', () => {
    expect(
      modelOutputToMcpContent(
        {
          type: 'content',
          value: [
            { type: 'file-url', url: 'data:text/plain,100%' },
            { type: 'media', data: 'data:text/plain,100%', mediaType: 'text/plain' },
          ],
        },
        't',
      )?.content,
    ).toEqual([
      { type: 'text', text: 'data:text/plain,100%' },
      { type: 'text', text: JSON.stringify({ type: 'media', data: 'data:text/plain,100%', mediaType: 'text/plain' }) },
    ]);
  });

  it('lowercases media type and subtype, keeping parameters as given', () => {
    const result = modelOutputToMcpContent(
      {
        type: 'content',
        value: [
          { type: 'media', data: PNG, mediaType: 'IMAGE/PNG' },
          { type: 'media', data: PNG, mediaType: 'Audio/Wav' },
          { type: 'media', data: PNG, mediaType: 'Text/Plain; Charset=UTF-8' },
        ],
      },
      't',
    );
    expect(result?.content).toEqual([
      { type: 'image', data: PNG, mimeType: 'image/png' },
      { type: 'audio', data: PNG, mimeType: 'audio/wav' },
      {
        type: 'resource',
        resource: { uri: 'mastra://tool-output/t/2', mimeType: 'text/plain; Charset=UTF-8', blob: PNG },
      },
    ]);
  });

  it('turns remote URLs into text blocks', () => {
    expect(
      modelOutputToMcpContent({ type: 'content', value: [{ type: 'image-url', url: 'https://x.dev/a.png' }] }, 't')
        ?.content,
    ).toEqual([{ type: 'text', text: 'https://x.dev/a.png' }]);
  });

  it('encodes Uint8Array media data as Base64', () => {
    expect(
      modelOutputToMcpContent(
        { type: 'content', value: [{ type: 'media', data: new Uint8Array([1, 2, 3]), mediaType: 'image/png' }] },
        't',
      )?.content,
    ).toEqual([{ type: 'image', data: 'AQID', mimeType: 'image/png' }]);
  });

  it('serializes unknown parts as JSON text', () => {
    expect(
      modelOutputToMcpContent({ type: 'content', value: [{ type: 'file-id', fileId: 'f1' }, 42] }, 't')?.content,
    ).toEqual([
      { type: 'text', text: '{"type":"file-id","fileId":"f1"}' },
      { type: 'text', text: '42' },
    ]);
  });

  it.each([
    ['undefined', undefined],
    ['a raw string', 'plain'],
    ['an array', [1]],
    ['an object without a known type', { stdout: 'x', exitCode: 0 }],
    ['text with a non-string value', { type: 'text', value: 1 }],
    ['content with a non-array value', { type: 'content', value: 'x' }],
  ])('returns undefined for %s', (_label, value) => {
    expect(modelOutputToMcpContent(value, 't')).toBeUndefined();
  });
});
