import { describe, expect, it } from 'vitest';

import { parseHoverValue } from './LspHoverCard';

describe('parseHoverValue', () => {
  it('splits a typical TS hover into code + prose segments', () => {
    const value = '```typescript\n(method) Array<string>.map<number>(...): number[]\n```\n---\nReturns a new array.';
    expect(parseHoverValue(value)).toEqual([
      { kind: 'code', code: '(method) Array<string>.map<number>(...): number[]', lang: 'typescript' },
      { kind: 'prose', text: 'Returns a new array.' },
    ]);
  });

  it('handles multiple fences with interleaved prose', () => {
    const value = 'intro\n```ts\nconst a = 1;\n```\nmiddle\n```\nplain\n```\nend';
    expect(parseHoverValue(value)).toEqual([
      { kind: 'prose', text: 'intro' },
      { kind: 'code', code: 'const a = 1;', lang: 'ts' },
      { kind: 'prose', text: 'middle' },
      { kind: 'code', code: 'plain', lang: '' },
      { kind: 'prose', text: 'end' },
    ]);
  });

  it('drops horizontal rules and empty segments', () => {
    expect(parseHoverValue('---\n\n```ts\nx\n```\n\n---\n')).toEqual([{ kind: 'code', code: 'x', lang: 'ts' }]);
  });

  it('treats a fence-free payload as prose', () => {
    expect(parseHoverValue('just docs')).toEqual([{ kind: 'prose', text: 'just docs' }]);
  });
});
