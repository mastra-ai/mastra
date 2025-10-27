import { describe, it, expect, vi } from 'vitest';
import { z as zV4 } from 'zod/v4';
import { zodToJsonSchema } from './zod-to-json';
import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// Mock 'zod' to use v4
vi.mock('zod', () => ({
  z: zV4,
}));

// Run the shared test suite with Zod v4
runZodToJsonTestSuite();

// Zod v4 specific tests for fallback behavior
describe('zodToJsonSchema - Zod v4 specific', () => {
  describe('v3 fallback produces valid output', () => {
    it('should produce valid JSON Schema when v4 fails on z.record()', () => {
      const schema = zV4.object({
        variables: zV4.record(zV4.string()).optional(),
      });

      const result = zodToJsonSchema(schema as any);

      // Should produce valid JSON Schema
      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('variables');

      // Verify it's actually valid JSON Schema structure
      expect(result).toHaveProperty('type');
      expect(typeof result.type).toBe('string');
    });

    it('should handle the exact error case from the bug report', () => {
      // This is the schema that was causing:
      // "Cannot read properties of undefined (reading '_zod')"
      const problematicSchema = zV4.object({
        repo: zV4.string(),
        ref: zV4.string().optional(),
        variables: zV4.record(zV4.string()).optional(),
      });

      // Should not throw
      expect(() => zodToJsonSchema(problematicSchema as any)).not.toThrow();

      const result = zodToJsonSchema(problematicSchema as any);

      // Should produce valid schema
      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties?.variables).toBeDefined();
    });
  });

  describe('v3 and v4 output comparison', () => {
    it('should produce valid schema for basic z.record() after patching', () => {
      const schema = zV4.record(zV4.string());

      // Get v4 result with our patch
      const v4Result = zodToJsonSchema(schema as any);

      // Should produce valid object schema
      expect(v4Result.type).toBe('object');
      expect(v4Result).toHaveProperty('additionalProperties');
      expect(v4Result.additionalProperties).toBeDefined();
    });

    it('should produce equivalent schemas for complex z.record() scenarios', () => {
      const schema = zV4.object({
        name: zV4.string(),
        metadata: zV4.record(zV4.union([zV4.string(), zV4.number()])),
      });

      const result = zodToJsonSchema(schema as any);

      // Should have the expected structure
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('name');
      expect(result.properties).toHaveProperty('metadata');
      expect(result.required).toContain('name');
      expect(result.required).toContain('metadata');
    });
  });

  describe('fallback mechanism verification', () => {
    it('should successfully convert all agent-builder schemas that were failing', () => {
      // These are the real schemas that were causing production issues
      const schemas = [
        // AgentBuilderInputSchema
        zV4.object({
          repo: zV4.string(),
          variables: zV4.record(zV4.string()).optional(),
        }),
        // PackageAnalysisSchema
        zV4.object({
          dependencies: zV4.record(zV4.string()).optional(),
          devDependencies: zV4.record(zV4.string()).optional(),
          scripts: zV4.record(zV4.string()).optional(),
        }),
        // FileCopyInputSchema
        zV4.object({
          templateDir: zV4.string(),
          variables: zV4.record(zV4.string()).optional(),
        }),
      ];

      schemas.forEach((schema, index) => {
        expect(() => zodToJsonSchema(schema as any), `Schema ${index} should not throw`).not.toThrow();

        const result = zodToJsonSchema(schema as any);
        expect(result, `Schema ${index} should produce valid output`).toBeDefined();
        expect(result.type, `Schema ${index} should be an object`).toBe('object');
      });
    });

    it('should handle schemas with multiple record fields without errors', () => {
      const schema = zV4.object({
        field1: zV4.record(zV4.string()),
        field2: zV4.record(zV4.number()),
        field3: zV4.record(zV4.boolean()),
      });

      expect(() => zodToJsonSchema(schema as any)).not.toThrow();

      const result = zodToJsonSchema(schema as any);

      expect(result.properties).toHaveProperty('field1');
      expect(result.properties).toHaveProperty('field2');
      expect(result.properties).toHaveProperty('field3');
    });
  });
});
