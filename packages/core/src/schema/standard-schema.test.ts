// Tests have been moved to @mastra/schema-compat
// Run tests in packages/schema-compat instead
import { describe, it, expect } from 'vitest';
import { isStandardSchema, isStandardJSONSchema, isStandardSchemaWithJSON } from './standard-schema';

describe('standard-schema re-exports', () => {
  it('should re-export isStandardSchema from schema-compat', () => {
    expect(isStandardSchema).toBeDefined();
  });

  it('should re-export isStandardJSONSchema from schema-compat', () => {
    expect(isStandardJSONSchema).toBeDefined();
  });

  it('should re-export isStandardSchemaWithJSON from schema-compat', () => {
    expect(isStandardSchemaWithJSON).toBeDefined();
  });
});
