import { describe, expect, it } from 'vitest';
import { fixSseContent, sanitizingFetch } from './gateways/models-dev';

describe('fixSseContent', () => {
  it('replaces boolean content with empty string', () => {
    expect(fixSseContent('"content":true')).toBe('"content":""');
    expect(fixSseContent('"content":false')).toBe('"content":""');
  });

  it('replaces null content with empty string', () => {
    expect(fixSseContent('"content":null')).toBe('"content":""');
  });

  it('wraps numeric content in quotes to preserve the digit', () => {
    expect(fixSseContent('"content":1')).toBe('"content":"1"');
    expect(fixSseContent('"content":2')).toBe('"content":"2"');
    expect(fixSseContent('"content":-1')).toBe('"content":"-1"');
    expect(fixSseContent('"content":3.14')).toBe('"content":"3.14"');
  });

  it('leaves string content unchanged', () => {
    expect(fixSseContent('"content":"normal string"')).toBe('"content":"normal string"');
    expect(fixSseContent('"content":" [^1]"')).toBe('"content":" [^1]"');
    expect(fixSseContent('"content":"^"')).toBe('"content":"^"');
  });

  it('fixes numeric content in a full SSE line', () => {
    const input = 'data: {"id":"x","choices":[{"index":0,"delta":{"content":1}}]}';
    const expected = 'data: {"id":"x","choices":[{"index":0,"delta":{"content":"1"}}]}';
    expect(fixSseContent(input)).toBe(expected);
  });
});

describe('sanitizingFetch', () => {
  it('sanitizes numeric content in SSE response bodies preserving citation digits', async () => {
    const chunks = [
      'data: {"choices":[{"index":0,"delta":{"content":" ["}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"^"}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":1}}]}\n\n',
      'data: {"choices":[{"index":0,"delta":{"content":"]."}}]}\n\n',
    ];
    const innerFetch = async () =>
      new Response(
        new ReadableStream({
          start(ctrl) {
            for (const c of chunks) ctrl.enqueue(new TextEncoder().encode(c));
            ctrl.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );

    const sanitized = await sanitizingFetch(innerFetch)('https://example.com');
    const text = await sanitized.text();

    expect(text).toContain('"content":"1"');
    expect(text).toContain('"content":" ["');
    expect(text).toContain('"content":"^"');
    expect(text).toContain('"content":"]."');
    expect(text).not.toContain('"content":1,');
    expect(text).not.toContain('"content":1\n');
  });

  it('handles numeric content split across stream chunk boundaries', async () => {
    const chunks = [
      'data: {"choices":[{"index":0,"delta":{"content":',
      '1}}]}\n\ndata: {"choices":[{"index":0,"delta":{"content":"ok"}}]}\n\n',
    ];
    const innerFetch = async () =>
      new Response(
        new ReadableStream({
          start(ctrl) {
            for (const c of chunks) ctrl.enqueue(new TextEncoder().encode(c));
            ctrl.close();
          },
        }),
        { headers: { 'content-type': 'text/event-stream' } },
      );

    const sanitized = await sanitizingFetch(innerFetch)('https://example.com');
    const text = await sanitized.text();

    expect(text).toContain('"content":"1"');
    expect(text).toContain('"content":"ok"');
  });
});
