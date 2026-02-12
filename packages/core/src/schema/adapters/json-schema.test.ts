// Tests have been moved to @mastra/schema-compat
// Run tests in packages/schema-compat instead
import { describe, it, expect } from 'vitest';
import { JsonSchemaWrapper, toStandardSchema } from './json-schema';

describe('json-schema adapter re-exports', () => {
  it('should re-export JsonSchemaWrapper from schema-compat', () => {
    expect(JsonSchemaWrapper).toBeDefined();
  });

  it('should re-export toStandardSchema from schema-compat', () => {
    expect(toStandardSchema).toBeDefined();
  });
});
