import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { resolveSlugify, slugify } from './slugify';

const require = createRequire(import.meta.url);

/**
 * Verbatim copy of the rolldown CommonJS interop helper emitted into
 * `packages/core/dist/rolldown-runtime-*.cjs`. The bundled output calls it as
 * `__toESM(require('@sindresorhus/slugify'), 1)`, which is what breaks the
 * plain `slugify.default(...)` call under `require()`.
 */
function __toESM(mod: any, isNodeMode?: number, target?: any) {
  target = mod != null ? Object.create(Object.getPrototypeOf(mod)) : {};
  const copyProps = (to: any, from: any, except?: string) => {
    if ((from && typeof from === 'object') || typeof from === 'function') {
      for (const key of Object.getOwnPropertyNames(from)) {
        if (!Object.prototype.hasOwnProperty.call(to, key) && key !== except) {
          const desc = Object.getOwnPropertyDescriptor(from, key);
          Object.defineProperty(to, key, {
            get: () => from[key],
            enumerable: !desc || desc.enumerable,
          });
        }
      }
    }
    return to;
  };
  return copyProps(
    isNodeMode || !mod || !mod.__esModule
      ? Object.defineProperty(target, 'default', { value: mod, enumerable: true })
      : target,
    mod,
  );
}

describe('slugify interop', () => {
  it('slugifies under the ESM import path', () => {
    expect(slugify('My Server ID')).toBe('my-server-id');
  });

  it('reproduces the rolldown bridge that shadows the real default export', () => {
    const bridged = __toESM(require('@sindresorhus/slugify'), 1);

    // This is the exact value the generated CJS calls: `(0, mod.default)(id)`.
    expect(typeof bridged.default).not.toBe('function');
  });

  it('resolves a callable through the rolldown bridge', () => {
    const bridged = __toESM(require('@sindresorhus/slugify'), 1);
    const resolved = resolveSlugify(bridged.default);

    expect(typeof resolved).toBe('function');
    expect(resolved('My Server ID')).toBe('my-server-id');
  });

  it('resolves a double-wrapped default export', () => {
    const fn = (value: string) => value.toLowerCase().replace(/\s+/g, '-');
    const resolved = resolveSlugify({ default: { default: fn } });

    expect(resolved).toBe(fn);
    expect(resolved('My Server ID')).toBe('my-server-id');
  });

  it('passes a plain function through unchanged', () => {
    const fn = (value: string) => value.toUpperCase();
    expect(resolveSlugify(fn)).toBe(fn);
  });
});
