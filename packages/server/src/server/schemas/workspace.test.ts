import { describe, expect, it } from 'vitest';
import { normalizeQueryParams } from '../server-adapter/index';
import {
  fsDeleteQuerySchema,
  fsListQuerySchema,
  fsMkdirBodySchema,
  fsWriteBodySchema,
  searchSkillsQuerySchema,
} from './workspace';

/**
 * Regression tests for boolean flags on workspace / skills routes.
 *
 * These flags are carried as strings over HTTP (query params, and the client SDK
 * serializes explicit booleans with `String(...)`). A plain `z.coerce.boolean()`
 * applies JavaScript truthiness, so the nonempty string `"false"` coerced to
 * `true` and flipped the flag on. The schemas must accept `"true"`/`"false"` and
 * parse each to the matching boolean.
 */
describe('workspace boolean flags parse string query params', () => {
  describe('fsListQuerySchema.recursive', () => {
    it('parses "false" as false', () => {
      expect(fsListQuerySchema.parse({ path: '/', recursive: 'false' }).recursive).toBe(false);
    });

    it('parses "true" as true', () => {
      expect(fsListQuerySchema.parse({ path: '/', recursive: 'true' }).recursive).toBe(true);
    });

    it('keeps the omitted flag undefined', () => {
      expect(fsListQuerySchema.parse({ path: '/' }).recursive).toBeUndefined();
    });

    it('accepts real booleans unchanged', () => {
      expect(fsListQuerySchema.parse({ path: '/', recursive: false }).recursive).toBe(false);
      expect(fsListQuerySchema.parse({ path: '/', recursive: true }).recursive).toBe(true);
    });
  });

  describe('fsDeleteQuerySchema.recursive and .force', () => {
    it('parses "false" as false', () => {
      const parsed = fsDeleteQuerySchema.parse({ path: '/dir', recursive: 'false', force: 'false' });
      expect(parsed.recursive).toBe(false);
      expect(parsed.force).toBe(false);
    });

    it('parses "true" as true', () => {
      const parsed = fsDeleteQuerySchema.parse({ path: '/dir', recursive: 'true', force: 'true' });
      expect(parsed.recursive).toBe(true);
      expect(parsed.force).toBe(true);
    });

    it('keeps omitted flags undefined', () => {
      const parsed = fsDeleteQuerySchema.parse({ path: '/dir' });
      expect(parsed.recursive).toBeUndefined();
      expect(parsed.force).toBeUndefined();
    });
  });

  describe('searchSkillsQuerySchema.includeReferences', () => {
    it('parses "false" as false', () => {
      expect(searchSkillsQuerySchema.parse({ query: 'q', includeReferences: 'false' }).includeReferences).toBe(false);
    });

    it('parses "true" as true', () => {
      expect(searchSkillsQuerySchema.parse({ query: 'q', includeReferences: 'true' }).includeReferences).toBe(true);
    });

    it('defaults to true when omitted', () => {
      expect(searchSkillsQuerySchema.parse({ query: 'q' }).includeReferences).toBe(true);
    });
  });

  describe('body schemas', () => {
    it('fsWriteBodySchema.recursive parses "false" as false', () => {
      expect(fsWriteBodySchema.parse({ path: '/f.txt', content: 'x', recursive: 'false' }).recursive).toBe(false);
    });

    it('fsMkdirBodySchema.recursive parses "false" as false', () => {
      expect(fsMkdirBodySchema.parse({ path: '/dir', recursive: 'false' }).recursive).toBe(false);
    });
  });
});

/**
 * Contract test for the client SDK wire format.
 *
 * The SDK builds query strings with `URLSearchParams` and serializes explicit
 * booleans via `String(...)`, so `recursive: false` travels as `recursive=false`.
 * Reproduce that serialization here and run it through the same normalization
 * the server adapter applies, proving the schema sees the SDK's actual input.
 */
describe('client SDK wire contract', () => {
  it('round-trips an explicit false flag from URLSearchParams to the schema', () => {
    const searchParams = new URLSearchParams();
    searchParams.set('path', '/dir');
    searchParams.set('recursive', String(false));
    searchParams.set('force', String(false));

    const wire = Object.fromEntries(searchParams.entries());
    expect(wire.recursive).toBe('false');
    expect(wire.force).toBe('false');

    const parsed = fsDeleteQuerySchema.parse(normalizeQueryParams(wire));
    expect(parsed.recursive).toBe(false);
    expect(parsed.force).toBe(false);
  });

  it('round-trips an explicit false flag for skills search', () => {
    const searchParams = new URLSearchParams();
    searchParams.set('query', 'q');
    searchParams.set('includeReferences', String(false));

    const parsed = searchSkillsQuerySchema.parse(normalizeQueryParams(Object.fromEntries(searchParams.entries())));
    expect(parsed.includeReferences).toBe(false);
  });
});
