import { describe, it, expect } from 'vitest';
import {
  listScoresByEntityIdQuerySchema,
  listScoresByRunIdQuerySchema,
  listScoresByScorerIdQuerySchema,
} from './scores';

describe('score list query schemas', () => {
  it.each([
    ['by run id', listScoresByRunIdQuerySchema],
    ['by scorer id', listScoresByScorerIdQuerySchema],
    ['by entity id', listScoresByEntityIdQuerySchema],
  ])('%s rejects a fractional perPage and a negative page at the request boundary', (_label, schema) => {
    expect(schema.safeParse({ perPage: '2.5' }).success).toBe(false);
    expect(schema.safeParse({ page: '-1' }).success).toBe(false);
  });
});
