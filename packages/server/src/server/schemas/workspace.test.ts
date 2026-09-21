import { describe, it, expect } from 'vitest';
import { fsDeleteQuerySchema, fsListQuerySchema, searchSkillsQuerySchema } from './workspace';

describe('workspace query boolean coercion', () => {
  // HTTP query params arrive as strings, and the client SDK serializes explicit
  // booleans with String(value), so an explicit `false` reaches the server as
  // "false". z.coerce.boolean() used to flip that to `true`
  // (Boolean("false") === true), silently enabling recursion, forced deletion,
  // or reference-file search that the caller had turned off.
  it.each([
    ['fsListQuerySchema.recursive', () => fsListQuerySchema.parse({ path: '.', recursive: 'false' }).recursive],
    [
      'fsDeleteQuerySchema.recursive',
      () => fsDeleteQuerySchema.parse({ path: 'fixture', recursive: 'false' }).recursive,
    ],
    ['fsDeleteQuerySchema.force', () => fsDeleteQuerySchema.parse({ path: 'fixture', force: 'false' }).force],
    [
      'searchSkillsQuerySchema.includeReferences',
      () => searchSkillsQuerySchema.parse({ query: 'sample', includeReferences: 'false' }).includeReferences,
    ],
  ])('parses the string "false" as false for %s', (_label, parse) => {
    expect(parse()).toBe(false);
  });

  it.each([
    ['fsListQuerySchema.recursive', () => fsListQuerySchema.parse({ path: '.', recursive: 'true' }).recursive],
    [
      'fsDeleteQuerySchema.recursive',
      () => fsDeleteQuerySchema.parse({ path: 'fixture', recursive: 'true' }).recursive,
    ],
    ['fsDeleteQuerySchema.force', () => fsDeleteQuerySchema.parse({ path: 'fixture', force: 'true' }).force],
    [
      'searchSkillsQuerySchema.includeReferences',
      () => searchSkillsQuerySchema.parse({ query: 'sample', includeReferences: 'true' }).includeReferences,
    ],
  ])('still parses the string "true" as true for %s', (_label, parse) => {
    expect(parse()).toBe(true);
  });

  it('leaves omitted flags at their existing defaults', () => {
    // Omitted optional flags stay undefined; includeReferences keeps its default.
    expect(fsListQuerySchema.parse({ path: '.' }).recursive).toBeUndefined();
    expect(fsDeleteQuerySchema.parse({ path: 'fixture' }).recursive).toBeUndefined();
    expect(fsDeleteQuerySchema.parse({ path: 'fixture' }).force).toBeUndefined();
    expect(searchSkillsQuerySchema.parse({ query: 'sample' }).includeReferences).toBe(true);
  });

  it('accepts real boolean values (non-string callers)', () => {
    expect(fsListQuerySchema.parse({ path: '.', recursive: false }).recursive).toBe(false);
    expect(fsDeleteQuerySchema.parse({ path: 'fixture', force: true }).force).toBe(true);
  });
});
