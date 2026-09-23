import { describe, it, expect } from 'vitest';
import { listItemsQuerySchema, paginationQuerySchema } from './datasets';

describe('dataset list query schemas', () => {
  it.each([
    ['datasets and versions', paginationQuerySchema],
    ['items', listItemsQuerySchema],
  ])('%s rejects a fractional perPage and a negative page at the request boundary', (_label, schema) => {
    expect(schema.safeParse({ perPage: '2.5' }).success).toBe(false);
    expect(schema.safeParse({ page: '-1' }).success).toBe(false);
  });
});
