import { describe, expect, it } from 'vitest';
import { MessageList } from '../message-list';
import { AIV5Adapter } from './AIV5Adapter';

// AI SDK v7 file/image parts carry tagged data objects instead of bare strings/bytes.
const fileMessage = (data: unknown, mediaType = 'image/png') =>
  ({ role: 'user', content: [{ type: 'file', mediaType, data }] }) as any;

const getFileData = (data: unknown, mediaType?: string) => {
  const msg = AIV5Adapter.fromModelMessage(fileMessage(data, mediaType));
  const part = msg.content.parts.find(p => p.type === 'file') as { data: string } | undefined;
  return part?.data;
};

const BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('AIV5Adapter.fromModelMessage — AI SDK v7 tagged FileData', () => {
  it('unwraps { type: "url" } with a data URL string', () => {
    const url = `data:image/png;base64,${BASE64}`;
    expect(getFileData({ type: 'url', url })).toBe(url);
  });

  it('unwraps { type: "url" } with a URL instance', () => {
    expect(getFileData({ type: 'url', url: new URL('https://example.com/a.png') })).toBe('https://example.com/a.png');
  });

  it('unwraps { type: "data" } with base64 string', () => {
    expect(getFileData({ type: 'data', data: BASE64 })).toBe(`data:image/png;base64,${BASE64}`);
  });

  it('unwraps { type: "data" } with bytes', () => {
    const bytes = new Uint8Array(Buffer.from(BASE64, 'base64'));
    expect(getFileData({ type: 'data', data: bytes })).toBe(`data:image/png;base64,${BASE64}`);
  });

  it('encodes { type: "text" } as a base64 data URL', () => {
    expect(getFileData({ type: 'text', text: 'hello' }, 'text/plain')).toBe(
      `data:text/plain;base64,${Buffer.from('hello').toString('base64')}`,
    );
  });

  it('unwraps tagged data on image parts', () => {
    const msg = AIV5Adapter.fromModelMessage({
      role: 'user',
      content: [{ type: 'image', mediaType: 'image/png', image: { type: 'data', data: BASE64 } }],
    } as any);
    const part = msg.content.parts.find(p => p.type === 'file') as { data: string };
    expect(part.data).toBe(`data:image/png;base64,${BASE64}`);
  });

  it('throws for provider references and unknown shapes instead of sending empty data', () => {
    expect(() => getFileData({ type: 'reference', reference: { openai: 'file-1' } })).toThrow(/not supported/);
    expect(() => getFileData({ foo: 1 })).toThrow(/Unrecognized file data/);
    expect(() => getFileData({ type: 'url', url: 42 })).toThrow(/Invalid "url" file data/);
    expect(() => getFileData({ type: 'data', data: null })).toThrow(/Invalid "data" file data/);
  });

  it('keeps file content when added to a MessageList as input', () => {
    const list = new MessageList();
    list.add([fileMessage({ type: 'data', data: BASE64 })], 'input');
    const part = list.get.all.db()[0]!.content.parts.find(p => p.type === 'file') as { data: string };
    expect(part.data).toBe(`data:image/png;base64,${BASE64}`);
  });
});
