import { describe, expect, it } from 'vitest';

import { rewriteSpecifier, rewriteRelativeSpecifiers } from '../../scripts/rewrite-specifiers.mjs';

describe('rewriteSpecifier', () => {
  // Mock resolver: './foo' and '../bar' are files, './dir' is a directory
  const resolveSuffix = (spec: string): string | null => {
    if (spec === './foo' || spec === '../bar' || spec === './dyn') return '.js';
    if (spec === './dir') return '/index.js';
    return null;
  };

  it('appends .js for a file import', () => {
    expect(rewriteSpecifier('./foo', resolveSuffix)).toBe('./foo.js');
  });

  it('appends /index.js for a directory import', () => {
    expect(rewriteSpecifier('./dir', resolveSuffix)).toBe('./dir/index.js');
  });

  it('leaves already-qualified .js specifiers unchanged', () => {
    expect(rewriteSpecifier('./foo.js', resolveSuffix)).toBe(null);
  });

  it('leaves .json specifiers unchanged', () => {
    expect(rewriteSpecifier('./data.json', resolveSuffix)).toBe(null);
  });

  it('replaces .ts extension with .js', () => {
    expect(rewriteSpecifier('./foo.ts', resolveSuffix)).toBe('./foo.js');
  });

  it('appends index.js for trailing-slash directory specifiers', () => {
    expect(rewriteSpecifier('./dir/', resolveSuffix)).toBe('./dir/index.js');
  });

  it('returns null for unresolvable specifiers', () => {
    expect(rewriteSpecifier('./missing', resolveSuffix)).toBe(null);
  });

  it('leaves non-relative asset specifiers unchanged', () => {
    expect(rewriteSpecifier('./style.css', resolveSuffix)).toBe(null);
  });
});

describe('rewriteRelativeSpecifiers', () => {
  const resolveSuffix = (spec: string): string | null => {
    if (spec === './foo' || spec === './bar' || spec === '../baz' || spec === './dyn') return '.js';
    if (spec === './dir') return '/index.js';
    return null;
  };

  it('rewrites static imports with from keyword', () => {
    const src = `import { foo } from './foo';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import { foo } from './foo.js';`);
  });

  it('rewrites static exports with from keyword', () => {
    const src = `export { foo } from './foo';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`export { foo } from './foo.js';`);
  });

  it('rewrites type imports', () => {
    const src = `import type { Foo } from './bar';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import type { Foo } from './bar.js';`);
  });

  it('rewrites export * statements', () => {
    const src = `export * from './bar';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`export * from './bar.js';`);
  });

  it('rewrites dynamic imports', () => {
    const src = `const mod = await import('./dyn');`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`const mod = await import('./dyn.js');`);
  });

  it('rewrites side-effect imports', () => {
    const src = `import './foo';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import './foo.js';`);
  });

  it('rewrites parent-directory specifiers', () => {
    const src = `import { baz } from '../baz';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import { baz } from '../baz.js';`);
  });

  it('rewrites directory imports to /index.js', () => {
    const src = `import { x } from './dir';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import { x } from './dir/index.js';`);
  });

  it('leaves already-qualified specifiers unchanged', () => {
    const src = `import { foo } from './foo.js';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(src);
  });

  it('leaves package imports unchanged', () => {
    const src = `import { Mastra } from '@mastra/core/mastra';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(src);
  });

  it('leaves hono and other package imports unchanged', () => {
    const src = `import type { Context } from 'hono';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(src);
  });

  it('leaves node: protocol imports unchanged', () => {
    const src = `import { readFileSync } from 'node:fs';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(src);
  });

  it('handles multiple imports in one file', () => {
    const src = `import { a } from './foo';
import { b } from './bar';
import { c } from '@mastra/core';`;
    const expected = `import { a } from './foo.js';
import { b } from './bar.js';
import { c } from '@mastra/core';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(expected);
  });

  it('handles multi-line import statements', () => {
    const src = `import {
  foo,
  bar,
} from './foo';`;
    const expected = `import {
  foo,
  bar,
} from './foo.js';`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(expected);
  });

  it('handles double-quoted specifiers', () => {
    const src = `import { foo } from "./foo";`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(`import { foo } from "./foo.js";`);
  });

  // Regex-based rewriting may match import-like syntax inside strings/template
  // literals. This is harmless: the filesystem resolver only rewrites when the
  // target file actually exists, and such patterns are vanishingly rare in
  // real TypeScript source.
  it('leaves source unchanged when no resolvable relative specifiers present', () => {
    const src = `import { foo } from '@mastra/core';
const x = 1;`;
    expect(rewriteRelativeSpecifiers(src, resolveSuffix)).toBe(src);
  });
});
