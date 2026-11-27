import { describe, expect, it } from 'vitest';
import { resolveRelativePath } from './path';

describe('resolveRelativePath', () => {
  it.each([
    ['docs/guide.md', 'img/a.png', 'docs/img/a.png'],
    ['docs/guide.md', './a.png', 'docs/a.png'],
    ['docs/guide.md', '../logo.png', 'logo.png'],
    ['README.md', 'assets/my%20logo.png?raw=1#top', 'assets/my logo.png'],
    ['docs/guide.md', 'diagram%231.png', 'docs/diagram#1.png'],
  ])('resolves %s + %s to %s', (from, link, expected) => {
    expect(resolveRelativePath(from, link)).toBe(expected);
  });

  it.each([
    'https://example.com/a.png',
    'data:image/png;base64,AA',
    '/abs.png',
    '#anchor',
    '../outside.png',
    '',
    '100%zz.png',
    'a%2F..%2F..%2Fx.png',
  ])('leaves %s alone', link => {
    expect(resolveRelativePath('README.md', link)).toBeUndefined();
  });
});
