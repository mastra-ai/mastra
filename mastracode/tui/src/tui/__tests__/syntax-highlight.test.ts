import { describe, expect, it } from 'vitest';
import { highlightCode } from '../syntax-highlight.js';

const tag = (scope: string) => (text: string) => `<${scope}>${text}</${scope}>`;
const colors = { default: tag('d'), keyword: tag('k'), string: tag('s'), comment: tag('c') };

describe('highlightCode', () => {
  it('colors scopes and decodes entities', () => {
    expect(highlightCode('const a = "<x>" && b;', 'typescript', colors)).toBe(
      '<k>const</k><d> a = </d><s>"<x>"</s><d> && b;</d>',
    );
  });

  it('keeps every line self-contained when a scope spans lines', () => {
    const lines = highlightCode('/* one\ntwo */\nlet x', 'javascript', colors).split('\n');
    expect(lines).toEqual(['<c>/* one</c>', '<c>two */</c>', '<k>let</k><d> x</d>']);
  });

  // Same rules cli-highlight applied, so previews look the same after the switch.
  it('leaves top-level scopes the theme does not name uncolored, and nested ones in their parent color', () => {
    expect(highlightCode('.a { color: red; }', 'css', colors)).toBe('.a<d> { </d>color<d>: red; }</d>');
    expect(highlightCode('x = "a\\n"', 'python', colors)).toBe('<d>x = </d><s>"a\\n"</s>');
  });

  it('colors an embedded language like the surrounding text', () => {
    expect(highlightCode('RUN npm ci', 'dockerfile', colors)).toBe('<k>RUN</k><d> npm ci</d>');
  });

  it('registers html through the xml grammar', () => {
    expect(highlightCode('<p>', 'html', { ...colors, tag: tag('t') })).toContain('<t>');
  });

  it('falls back to the default color for unknown or missing languages', () => {
    expect(highlightCode('a\nb', 'not-a-language', colors)).toBe('<d>a</d>\n<d>b</d>');
    expect(highlightCode('a', undefined, colors)).toBe('<d>a</d>');
  });
});
