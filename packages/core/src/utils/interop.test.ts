import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { interopDefault } from './interop';
import { pMap } from './p-map';
import { slugify } from './slugify';

const requireFromHere = createRequire(import.meta.url);

/**
 * `require()` of an ESM-only package returns the module namespace. The bundler
 * interop helper in the CommonJS build sets `default` on that namespace to the
 * namespace itself, so a default import gives this object and not the exported
 * function. Load the real namespace here instead of a hand-written mock.
 */
function requireNamespace(specifier: string): unknown {
  const namespace = requireFromHere(specifier);
  if (typeof namespace !== 'object' || namespace === null) {
    throw new Error(`Expected a module namespace for ${specifier}, got ${typeof namespace}`);
  }
  return namespace;
}

describe('interopDefault', () => {
  it('returns the export when the default import is already the function', () => {
    const fn = () => 'called';

    expect(interopDefault(fn)).toBe(fn);
  });

  it('unwraps the module namespace of @sindresorhus/slugify', () => {
    const namespace = requireNamespace('@sindresorhus/slugify') as { default: typeof slugify };

    expect(interopDefault(namespace)('My Server Id')).toBe('my-server-id');
  });

  it('unwraps the module namespace of p-map', async () => {
    const namespace = requireNamespace('p-map') as { default: typeof pMap };

    await expect(interopDefault(namespace)([1, 2], async value => value * 2)).resolves.toEqual([2, 4]);
  });
});

describe('shared ESM-only wrappers', () => {
  it('exports slugify as a function', () => {
    expect(slugify('My Server Id')).toBe('my-server-id');
  });

  it('exports pMap as a function', async () => {
    await expect(pMap([1, 2], async value => value * 2)).resolves.toEqual([2, 4]);
  });
});
