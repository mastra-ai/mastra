import { describe, expect, it } from 'vitest';
import { highlight, languageForPath } from './highlight';
import type { HighlightResult, HighlightToken } from './highlight';

const rejoin = (lines: HighlightToken[][] | null) =>
  lines?.map(line => line.map(token => token.content).join('')).join('\n');

const classOf = (lines: HighlightToken[][] | null, content: string) =>
  lines?.flat().find(token => token.content === content)?.className;

const samples: Array<[string, string]> = [
  ['typescript', 'const a: number = 1;\n\nfunction f() {\n  return "x";\n}\n'],
  ['tsx', 'export const App = () => <div className="a">{"hi"}</div>;\n'],
  ['json', '{\n  "a": [1, true, null],\n  "b": "c"\n}'],
  ['python', 'def f(x):\n    # comment\n    return "y"\n'],
  ['yaml', 'key: value\nlist:\n  - 1\n'],
  ['markdown', '# Title\n\nSome **bold** text\n\n- item\n'],
  ['bash', 'echo "hi" && ls -la\n'],
  ['sql', 'SELECT * FROM users WHERE id = 1;'],
  ['css', '.a { color: red; }\n'],
  ['html', '<div class="a">hi</div>\n'],
  ['diff', '-old\n+new\n'],
];

describe('highlight', () => {
  it.each(samples)('colors %s streamed in small chunks exactly like a fresh parse', async (lang, sample) => {
    // Long enough that Lezer has earlier nodes to reuse; 7-char chunks split tokens mid-way.
    const code = Array.from({ length: 30 }, () => sample).join('\n');
    let previous: HighlightResult | undefined;

    for (let end = 7; end < code.length + 7; end += 7) {
      const chunk = code.slice(0, end);
      const streamed = await highlight(chunk, lang, previous);
      const fresh = await highlight(chunk, lang);
      expect(streamed?.tokens).toEqual(fresh?.tokens);
      previous = streamed ?? undefined;
    }
  });

  it('parses from scratch when the code no longer extends the previous pass', async () => {
    const previous = await highlight('const a = "x";', 'typescript');
    const rewritten = await highlight('let b = 2;', 'typescript', previous ?? undefined);
    expect(rewritten?.tokens).toEqual((await highlight('let b = 2;', 'typescript'))?.tokens);
  });

  it.each([
    ['typescript', 'const a: number = 1;\n\nfunction f() {\n  return "x";\n}\n'],
    ['json', '{\n  "a": [1, true, null],\n  "b": "c"\n}'],
    ['python', 'def f(x):\n    # comment\n    return "y"\n'],
    ['yaml', 'key: value\nlist:\n  - 1\n'],
    ['markdown', '# Title\n\nSome **bold** text\n'],
    ['bash', 'echo "hi" && ls -la\n'],
    ['sql', 'SELECT * FROM users WHERE id = 1;'],
  ])('keeps every character of %s source so line offsets stay correct', async (lang, code) => {
    const lines = (await highlight(code, lang))?.tokens ?? null;
    expect(lines).not.toBeNull();
    expect(rejoin(lines)).toBe(code);
    expect(lines).toHaveLength(code.split('\n').length);
  });

  it('colors TypeScript keywords, strings and definitions', async () => {
    const lines = (await highlight('const greeting = "hello";', 'ts'))?.tokens ?? null;
    expect(classOf(lines, 'const')).toBe('syntax-keyword');
    expect(classOf(lines, '"hello"')).toBe('syntax-string');
    expect(classOf(lines, 'greeting')).toBe('syntax-definition');
  });

  it('colors JSON strings and literals', async () => {
    const lines = (await highlight('{"name": "mastra", "ok": true}', 'json'))?.tokens ?? null;
    expect(classOf(lines, '"mastra"')).toBe('syntax-string');
    expect(classOf(lines, 'true')).toBe('syntax-literal');
  });

  it('colors legacy-mode languages such as python', async () => {
    const lines = (await highlight('def f():\n    return "y"', 'py'))?.tokens ?? null;
    expect(classOf(lines, 'def')).toBe('syntax-keyword');
    expect(classOf(lines, '"y"')).toBe('syntax-string');
  });

  it('returns null for languages without a grammar', async () => {
    expect(await highlight('fn main() {}', 'rust')).toBeNull();
  });
});

describe('languageForPath', () => {
  it.each([
    ['src/index.ts', 'typescript'],
    ['App.tsx', 'tsx'],
    ['data.json', 'json'],
    ['README.md', 'markdown'],
    ['script.py', 'python'],
    ['config.yml', 'yaml'],
    ['icon.svg', 'xml'],
    ['Makefile', undefined],
    [undefined, undefined],
  ])('%s → %s', (path, lang) => {
    expect(languageForPath(path)).toBe(lang);
  });
});
