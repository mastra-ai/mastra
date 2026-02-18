import { describe, it, expect } from 'vitest';

import { isGlobPattern, extractGlobBase, createGlobMatcher, matchGlob } from './glob';

// =============================================================================
// isGlobPattern
// =============================================================================
describe('isGlobPattern', () => {
  it('should return false for plain paths', () => {
    expect(isGlobPattern('/docs')).toBe(false);
    expect(isGlobPattern('/src/index.ts')).toBe(false);
    expect(isGlobPattern('README.md')).toBe(false);
    expect(isGlobPattern('/a/b/c')).toBe(false);
  });

  it('should detect * wildcard', () => {
    expect(isGlobPattern('*.ts')).toBe(true);
    expect(isGlobPattern('/src/*.ts')).toBe(true);
  });

  it('should detect ** globstar', () => {
    expect(isGlobPattern('**/*.ts')).toBe(true);
    expect(isGlobPattern('/docs/**/*.md')).toBe(true);
  });

  it('should detect ? single-char wildcard', () => {
    expect(isGlobPattern('file?.txt')).toBe(true);
  });

  it('should detect brace expansion', () => {
    expect(isGlobPattern('*.{js,ts}')).toBe(true);
    expect(isGlobPattern('/src/{a,b}/index.ts')).toBe(true);
  });

  it('should detect character classes', () => {
    expect(isGlobPattern('[abc].txt')).toBe(true);
    expect(isGlobPattern('/src/[A-Z]*.ts')).toBe(true);
  });
});

// =============================================================================
// extractGlobBase
// =============================================================================
describe('extractGlobBase', () => {
  it('should return the path as-is for plain paths', () => {
    expect(extractGlobBase('/docs')).toBe('/docs');
    expect(extractGlobBase('/src/utils')).toBe('/src/utils');
  });

  it('should extract base from ** patterns', () => {
    expect(extractGlobBase('/docs/**/*.md')).toBe('/docs');
    expect(extractGlobBase('/src/utils/**')).toBe('/src/utils');
  });

  it('should return root for patterns starting with **', () => {
    expect(extractGlobBase('**/*.md')).toBe('/');
    expect(extractGlobBase('**')).toBe('/');
  });

  it('should extract base from * patterns', () => {
    expect(extractGlobBase('/src/*.ts')).toBe('/src');
    expect(extractGlobBase('/a/b/*.config.js')).toBe('/a/b');
  });

  it('should handle brace expansion in path', () => {
    expect(extractGlobBase('/src/{a,b}/index.ts')).toBe('/src');
  });

  it('should handle character classes in path', () => {
    expect(extractGlobBase('/src/[A-Z]*.ts')).toBe('/src');
  });

  it('should handle ? wildcard', () => {
    expect(extractGlobBase('/src/file?.ts')).toBe('/src');
  });

  it('should return root when glob is at top level', () => {
    expect(extractGlobBase('/*.ts')).toBe('/');
  });

  it('should extract base from ./ prefixed patterns', () => {
    // ./**/skills → first meta at 2, prefix './', lastSlash 1, returns '.'
    expect(extractGlobBase('./**/skills')).toBe('.');
    // ./src/**/*.ts → first meta at 6, prefix './src/', lastSlash 5, returns './src'
    expect(extractGlobBase('./src/**/*.ts')).toBe('./src');
  });
});

// =============================================================================
// createGlobMatcher
// =============================================================================
describe('createGlobMatcher', () => {
  it('should match ** globstar patterns', () => {
    const match = createGlobMatcher('**/*.ts');
    expect(match('index.ts')).toBe(true);
    expect(match('src/index.ts')).toBe(true);
    expect(match('src/utils/helpers.ts')).toBe(true);
    expect(match('src/style.css')).toBe(false);
  });

  it('should match * wildcard patterns', () => {
    const match = createGlobMatcher('*.ts');
    expect(match('index.ts')).toBe(true);
    expect(match('src/index.ts')).toBe(false); // * doesn't cross /
  });

  it('should match brace expansion patterns', () => {
    const match = createGlobMatcher('*.{js,ts}');
    expect(match('index.js')).toBe(true);
    expect(match('index.ts')).toBe(true);
    expect(match('style.css')).toBe(false);
  });

  it('should match config file patterns', () => {
    const match = createGlobMatcher('*.config.{js,ts}');
    expect(match('vitest.config.ts')).toBe(true);
    expect(match('eslint.config.js')).toBe(true);
    expect(match('index.ts')).toBe(false);
  });

  it('should match multiple patterns', () => {
    const match = createGlobMatcher(['**/*.ts', '**/*.tsx']);
    expect(match('index.ts')).toBe(true);
    expect(match('App.tsx')).toBe(true);
    expect(match('style.css')).toBe(false);
  });

  it('should match directory patterns', () => {
    const match = createGlobMatcher('**/skills/**');
    expect(match('skills/test')).toBe(true);
    expect(match('a/skills/test')).toBe(true);
    expect(match('a/skills/b/c')).toBe(true);
    expect(match('other/test')).toBe(false);
  });

  it('should not match dotfiles by default', () => {
    const match = createGlobMatcher('**/*.ts');
    expect(match('.hidden.ts')).toBe(false);
  });

  it('should match dotfiles when dot option is true', () => {
    const match = createGlobMatcher('**/*.ts', { dot: true });
    expect(match('.hidden.ts')).toBe(true);
  });

  it('should handle path with leading slash stripped', () => {
    // Paths passed to picomatch should be relative (no leading slash)
    const match = createGlobMatcher('src/**/*.ts');
    expect(match('src/index.ts')).toBe(true);
    expect(match('src/utils/helpers.ts')).toBe(true);
    expect(match('lib/index.ts')).toBe(false);
  });

  it('should normalize ./ prefix on patterns', () => {
    const match = createGlobMatcher('./**/skills');
    expect(match('skills')).toBe(true);
    expect(match('a/skills')).toBe(true);
    expect(match('./a/skills')).toBe(true);
    expect(match('/a/skills')).toBe(true);
  });

  it('should normalize / prefix on patterns', () => {
    const match = createGlobMatcher('/docs/**/*.md');
    expect(match('/docs/readme.md')).toBe(true);
    expect(match('docs/readme.md')).toBe(true);
    expect(match('./docs/readme.md')).toBe(true);
  });

  it('should normalize / prefix on test paths', () => {
    const match = createGlobMatcher('docs/**/*.md');
    expect(match('/docs/readme.md')).toBe(true);
    expect(match('./docs/readme.md')).toBe(true);
    expect(match('docs/readme.md')).toBe(true);
  });

  it('should handle mixed prefixes between pattern and path', () => {
    // ./ pattern, / path
    const match1 = createGlobMatcher('./src/**/*.ts');
    expect(match1('/src/index.ts')).toBe(true);

    // / pattern, ./ path
    const match2 = createGlobMatcher('/src/**/*.ts');
    expect(match2('./src/index.ts')).toBe(true);

    // ./ pattern, bare path
    const match3 = createGlobMatcher('./src/**/*.ts');
    expect(match3('src/index.ts')).toBe(true);
  });
});

// =============================================================================
// matchGlob
// =============================================================================
describe('matchGlob', () => {
  it('should do one-off pattern matching', () => {
    expect(matchGlob('src/index.ts', '**/*.ts')).toBe(true);
    expect(matchGlob('style.css', '**/*.ts')).toBe(false);
  });

  it('should support multiple patterns', () => {
    expect(matchGlob('index.ts', ['**/*.ts', '**/*.js'])).toBe(true);
    expect(matchGlob('index.js', ['**/*.ts', '**/*.js'])).toBe(true);
    expect(matchGlob('style.css', ['**/*.ts', '**/*.js'])).toBe(false);
  });
});
