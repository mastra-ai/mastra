import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateTokenCount as tokenxEstimate, sliceByTokens as tokenxSlice } from 'tokenx';
import { describe, expect, it } from 'vitest';
import { estimateTokenCount, getTokenx, sliceByTokens } from './tokenx';

const here = dirname(fileURLToPath(import.meta.url));

function sourceWithoutTypeImports(relativePath: string): string {
  return readFileSync(join(here, relativePath), 'utf8')
    .split('\n')
    .filter(line => !/^\s*import type\b/.test(line))
    .join('\n');
}

function assertNoStaticTokenx(relativePath: string): void {
  const src = sourceWithoutTypeImports(relativePath);
  expect(src, relativePath).not.toMatch(/from\s+['"]tokenx['"]/);
  expect(src, relativePath).not.toMatch(/import\s*\(\s*['"]tokenx['"]\s*\)/);
  expect(src, relativePath).not.toMatch(/(?<![.\w])require\s*\(\s*['"]tokenx['"]\s*\)/);
}

describe('lazy tokenx loader', () => {
  it('does not statically import tokenx from the loader or its core callers', () => {
    assertNoStaticTokenx('./tokenx.ts');
    assertNoStaticTokenx('../processors/processors/token-limiter.ts');
    assertNoStaticTokenx('../processors/tool-result-reminder.ts');
    assertNoStaticTokenx('../workspace/tools/output-helpers.ts');
  });

  it('keeps the tokenx specifier behind importModule so the bundler cannot emit require("tokenx")', () => {
    const src = readFileSync(join(here, './tokenx.ts'), 'utf8');
    expect(src).toMatch(/const importModule = \(moduleName: string\) => import\(/);
    expect(src).toMatch(/importModule\('tokenx'\)/);
  });

  it('returns the same estimates as tokenx', async () => {
    const samples = ['', 'hello world', 'function foo() { return 1; }\n', '你好世界'];
    for (const sample of samples) {
      await expect(estimateTokenCount(sample)).resolves.toBe(tokenxEstimate(sample));
    }
  });

  it('returns the same slices as tokenx', async () => {
    const text = 'one two three four five six seven eight nine ten';
    await expect(sliceByTokens(text, 0, 4)).resolves.toBe(tokenxSlice(text, 0, 4));
    await expect(sliceByTokens(text, -3)).resolves.toBe(tokenxSlice(text, -3));
  });

  it('caches the loaded module', async () => {
    const first = await getTokenx();
    const second = await getTokenx();
    expect(first).toBe(second);
    expect(typeof first.estimateTokenCount).toBe('function');
    expect(typeof first.sliceByTokens).toBe('function');
  });
});
