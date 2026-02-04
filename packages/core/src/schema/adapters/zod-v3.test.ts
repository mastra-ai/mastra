// Tests have been moved to @mastra/schema-compat
// Run tests in packages/schema-compat instead
import { describe, it, expect } from 'vitest';
import { toStandardSchema } from './zod-v3';

describe('zod-v3 adapter re-exports', () => {
  it('should re-export toStandardSchema from schema-compat', () => {
    expect(toStandardSchema).toBeDefined();
  });
});
