import { describe, it, expect, vi } from 'vitest';
import { z as zV4 } from 'zod/v4';
import { zodToJsonSchema } from './zod-to-json';
import { runZodToJsonTestSuite } from './zod-to-json-test-suite';

// Mock 'zod' to use v4
vi.mock('zod', async () => {
  const { z } = await import('zod/v4');
  return { z };
});

// Run the shared test suite with Zod v4
runZodToJsonTestSuite();

// Zod v4 specific tests for patched record behavior
describe('zodToJsonSchema - Zod v4 specific', () => {
  describe('patched v4 path produces valid output', () => {
    it('should produce valid JSON Schema when patching z.record()', () => {
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
      const vars = result.properties!.variables as any;
      expect(vars?.additionalProperties).toMatchObject({ type: 'string' });
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

  describe('v4 output validation', () => {
    it('should produce valid schema for basic z.record() after patching', () => {
      const schema = zV4.record(zV4.string());

      // Get v4 result with our patch
      const v4Result = zodToJsonSchema(schema as any);

      // Should produce valid object schema
      expect(v4Result.type).toBe('object');
      expect(v4Result).toHaveProperty('additionalProperties');
      expect(v4Result.additionalProperties).toBeDefined();
      expect((v4Result.additionalProperties as any).type).toBe('string');
    });

    it('should produce valid schema for complex z.record() scenarios', () => {
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

  describe('idempotency verification', () => {
    it('should handle multiple conversions of the same lazy schema with z.record()', () => {
      // Create a lazy schema that contains a z.record()
      const lazySchema = zV4.lazy(() =>
        zV4.object({
          data: zV4.record(zV4.string()),
        }),
      );

      // Convert the same schema multiple times
      const result1 = zodToJsonSchema(lazySchema as any);
      const result2 = zodToJsonSchema(lazySchema as any);
      const result3 = zodToJsonSchema(lazySchema as any);

      // All results should be valid
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();

      // Should not throw and should produce consistent results
      expect(result1.type).toBe('object');
      expect(result2.type).toBe('object');
      expect(result3.type).toBe('object');
    });

    it('should handle nested lazy schemas with records without re-wrapping getters', () => {
      // Create a schema with nested lazy and record
      const nestedLazySchema = zV4.object({
        nested: zV4.lazy(() =>
          zV4.object({
            records: zV4.record(zV4.string()),
          }),
        ),
      });

      // Convert multiple times - should not cause getter wrapping issues
      const result1 = zodToJsonSchema(nestedLazySchema as any);
      const result2 = zodToJsonSchema(nestedLazySchema as any);

      // Both should succeed
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.type).toBe('object');
      expect(result2.type).toBe('object');
    });

    it('should not double-wrap lazy getter across multiple conversions', () => {
      type Node = { value: string; children: Record<string, any> };
      const nodeSchema: zV4.ZodType<Node> = zV4.lazy(() =>
        zV4.object({
          value: zV4.string(),
          children: zV4.record(nodeSchema),
        }),
      );
      // Call twice; should not throw or degrade
      expect(() => zodToJsonSchema(nodeSchema as any)).not.toThrow();
      expect(() => zodToJsonSchema(nodeSchema as any)).not.toThrow();
      const res = zodToJsonSchema(nodeSchema as any);
      expect(res).toBeDefined();
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
