import chalk from 'chalk';
import { afterEach, describe, expect, it } from 'vitest';
import { highlightCode } from '../syntax-highlight.js';

const tag = (scope: string) => (text: string) => `<${scope}>${text}</${scope}>`;
const colors = { default: tag('d'), keyword: tag('k'), string: tag('s'), comment: tag('c'), number: tag('n') };

// These follow cli-highlight's rules, which previews used before languages were loaded on demand.
// The two were compared byte for byte on 28 languages when this file was written.
describe('highlightCode', () => {
  const chalkLevel = chalk.level;
  afterEach(() => {
    chalk.level = chalkLevel;
  });

  // Runs first on purpose: nothing has registered JavaScript yet, so this checks that showing an
  // HTML file loads the grammar its <script> block is handed to.
  it('highlights a <script> block in an HTML file', () => {
    expect(highlightCode('<script>const a = 1;</script>', 'html', { ...colors, tag: tag('t'), name: tag('m') })).toBe(
      '<t><<m>script</m>></t><k>const</k><d> a = </d><n>1</n><d>;</d><t></<m>script</m>></t>',
    );
  });

  it('colors scopes and decodes entities', () => {
    expect(highlightCode('const a = "<x>" && b;', 'typescript', colors)).toBe(
      '<k>const</k><d> a = </d><s>"<x>"</s><d> && b;</d>',
    );
  });

  it('colors a scope that spans lines as one run', () => {
    expect(highlightCode('/* one\ntwo */\nlet x', 'javascript', colors)).toBe(
      '<c>/* one\ntwo */</c><d>\n</d><k>let</k><d> x</d>',
    );
  });

  it('leaves top-level scopes the theme does not name uncolored, and nested ones in their parent color', () => {
    expect(highlightCode('.a { color: red; }', 'css', colors)).toBe('.a<d> { </d>color<d>: red; }</d>');
    expect(highlightCode('x = "a\\n"', 'python', colors)).toBe('<d>x = </d><s>"a\\n"</s>');
  });

  it('falls back to the default ANSI colors for scopes the theme does not name', () => {
    chalk.level = 1;
    // `class` isn't in the theme, so the declaration takes cli-highlight's default blue around its keyword.
    expect(highlightCode('class A {}', 'javascript', colors)).toBe(`${chalk.blue('<k>class</k> A ')}<d>{}</d>`);
  });

  it('colors an embedded language like the surrounding text', () => {
    expect(highlightCode('RUN npm ci', 'dockerfile', colors)).toBe('<k>RUN</k><d> npm ci</d>');
  });

  it('falls back to the default color for unknown or missing languages', () => {
    expect(highlightCode('a\nb', 'not-a-language', colors)).toBe('<d>a\nb</d>');
    expect(highlightCode('a', undefined, colors)).toBe('<d>a</d>');
  });
});
