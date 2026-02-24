import { describe, it, expect } from 'vitest';

import { getLanguageId, LANGUAGE_EXTENSIONS } from './language';

describe('LANGUAGE_EXTENSIONS', () => {
  it('maps TypeScript extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.ts']).toBe('typescript');
    expect(LANGUAGE_EXTENSIONS['.tsx']).toBe('typescriptreact');
  });

  it('maps JavaScript extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.js']).toBe('javascript');
    expect(LANGUAGE_EXTENSIONS['.jsx']).toBe('javascriptreact');
    expect(LANGUAGE_EXTENSIONS['.mjs']).toBe('javascript');
    expect(LANGUAGE_EXTENSIONS['.cjs']).toBe('javascript');
  });

  it('maps Python extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.py']).toBe('python');
    expect(LANGUAGE_EXTENSIONS['.pyi']).toBe('python');
  });

  it('maps Go extension', () => {
    expect(LANGUAGE_EXTENSIONS['.go']).toBe('go');
  });

  it('maps Rust extension', () => {
    expect(LANGUAGE_EXTENSIONS['.rs']).toBe('rust');
  });

  it('maps C/C++ extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.c']).toBe('c');
    expect(LANGUAGE_EXTENSIONS['.cpp']).toBe('cpp');
    expect(LANGUAGE_EXTENSIONS['.cc']).toBe('cpp');
    expect(LANGUAGE_EXTENSIONS['.cxx']).toBe('cpp');
    expect(LANGUAGE_EXTENSIONS['.h']).toBe('c');
    expect(LANGUAGE_EXTENSIONS['.hpp']).toBe('cpp');
  });

  it('maps Java extension', () => {
    expect(LANGUAGE_EXTENSIONS['.java']).toBe('java');
  });

  it('maps web extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.html']).toBe('html');
    expect(LANGUAGE_EXTENSIONS['.css']).toBe('css');
    expect(LANGUAGE_EXTENSIONS['.scss']).toBe('scss');
    expect(LANGUAGE_EXTENSIONS['.sass']).toBe('sass');
    expect(LANGUAGE_EXTENSIONS['.less']).toBe('less');
  });

  it('maps data format extensions', () => {
    expect(LANGUAGE_EXTENSIONS['.json']).toBe('json');
    expect(LANGUAGE_EXTENSIONS['.jsonc']).toBe('jsonc');
    expect(LANGUAGE_EXTENSIONS['.yaml']).toBe('yaml');
    expect(LANGUAGE_EXTENSIONS['.yml']).toBe('yaml');
    expect(LANGUAGE_EXTENSIONS['.md']).toBe('markdown');
  });
});

describe('getLanguageId', () => {
  it('returns correct language ID for TypeScript file', () => {
    expect(getLanguageId('/src/app.ts')).toBe('typescript');
  });

  it('returns correct language ID for TSX file', () => {
    expect(getLanguageId('/src/component.tsx')).toBe('typescriptreact');
  });

  it('returns correct language ID for JavaScript file', () => {
    expect(getLanguageId('/src/app.js')).toBe('javascript');
  });

  it('returns correct language ID for Python file', () => {
    expect(getLanguageId('/src/main.py')).toBe('python');
  });

  it('returns correct language ID for Go file', () => {
    expect(getLanguageId('/src/main.go')).toBe('go');
  });

  it('returns correct language ID for Rust file', () => {
    expect(getLanguageId('/src/main.rs')).toBe('rust');
  });

  it('returns undefined for unknown extension', () => {
    expect(getLanguageId('/src/data.xyz')).toBeUndefined();
  });

  it('returns undefined for file with no extension', () => {
    expect(getLanguageId('Makefile')).toBeUndefined();
  });

  it('handles deeply nested paths', () => {
    expect(getLanguageId('/a/b/c/d/e/file.ts')).toBe('typescript');
  });

  it('handles files with multiple dots', () => {
    expect(getLanguageId('/src/app.test.ts')).toBe('typescript');
    expect(getLanguageId('/src/utils.spec.js')).toBe('javascript');
  });
});
