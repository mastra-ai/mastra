// Tests have been moved to @mastra/schema-compat
// Run tests in packages/schema-compat instead
import { describe, it, expect } from 'vitest';
import { AiSdkSchemaWrapper, toStandardSchema } from './ai-sdk';

describe('ai-sdk adapter re-exports', () => {
  it('should re-export AiSdkSchemaWrapper from schema-compat', () => {
    expect(AiSdkSchemaWrapper).toBeDefined();
  });

  it('should re-export toStandardSchema from schema-compat', () => {
    expect(toStandardSchema).toBeDefined();
  });
});
