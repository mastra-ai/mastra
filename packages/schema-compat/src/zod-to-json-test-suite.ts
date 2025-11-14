import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema } from './zod-to-json';

/**
 * Shared test suite for zodToJsonSchema that runs with both Zod v3 and v4.
 * The importing test file should mock 'zod' to either v3 or v4 before calling this.
 */
export function runZodToJsonTestSuite() {
  describe('zodToJsonSchema', () => {
    describe('z.record() compatibility', () => {
      it('should convert schema with z.record() fields', () => {
        const schema = z.object({
          name: z.string(),
          variables: z.record(z.string()).optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('name');
        expect(result.properties).toHaveProperty('variables');
      });

      it('should handle nested z.record() in complex schemas', () => {
        const schema = z.object({
          dependencies: z.record(z.string()).optional(),
          devDependencies: z.record(z.string()).optional(),
          scripts: z.record(z.string()).optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('dependencies');
        expect(result.properties).toHaveProperty('devDependencies');
        expect(result.properties).toHaveProperty('scripts');
      });

      it('should handle standalone z.record()', () => {
        const schema = z.record(z.string());

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle z.record() with complex value types', () => {
        const schema = z.record(
          z.object({
            value: z.string(),
            count: z.number(),
          }),
        );

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should produce valid JSON Schema output for z.record()', () => {
        const schema = z.object({
          metadata: z.record(z.union([z.string(), z.number(), z.boolean()])),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('metadata');

        // Verify the record field has valid JSON Schema structure
        const metadataSchema = result.properties!.metadata as any;
        expect(metadataSchema).toBeDefined();
        expect(['object', 'additionalProperties', 'patternProperties'].some(key => key in metadataSchema)).toBe(true);
      });

      it('should handle z.record() with two arguments (key and value schemas)', () => {
        const schema = z.record(z.string(), z.number());

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result).toHaveProperty('additionalProperties');

        // Value type should be number
        const valueSchema = result.additionalProperties as any;
        expect(valueSchema.type).toBe('number');
      });

      it('should handle z.record() with enum keys and complex values', () => {
        const schema = z.record(
          z.enum(['admin', 'user', 'guest']),
          z.object({
            permissions: z.array(z.string()),
            level: z.number(),
          }),
        );

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle z.record() with two args in optional fields', () => {
        const schema = z.object({
          scores: z.record(z.string(), z.number()).optional(),
          metadata: z.record(z.string(), z.string()).optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('scores');
        expect(result.properties).toHaveProperty('metadata');
      });
    });

    describe('real-world failing schemas from agent-builder', () => {
      it('should convert AgentBuilderInputSchema', () => {
        // From packages/agent-builder/src/types.ts line 103-109
        const AgentBuilderInputSchema = z.object({
          repo: z.string().describe('Git URL or local path of the template repo'),
          ref: z.string().optional().describe('Tag/branch/commit to checkout (defaults to main/master)'),
          slug: z.string().optional().describe('Slug for branch/scripts; defaults to inferred from repo'),
          targetPath: z.string().optional().describe('Project path to merge into; defaults to current directory'),
          variables: z.record(z.string()).optional().describe('Environment variables to set in .env file'),
        });

        const result = zodToJsonSchema(AgentBuilderInputSchema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('repo');
        expect(result.properties).toHaveProperty('variables');
        expect(result.required).toContain('repo');
      });

      it('should convert PackageAnalysisSchema', () => {
        // From packages/agent-builder/src/types.ts line 248-258
        const PackageAnalysisSchema = z.object({
          name: z.string().optional(),
          version: z.string().optional(),
          description: z.string().optional(),
          dependencies: z.record(z.string()).optional(),
          devDependencies: z.record(z.string()).optional(),
          peerDependencies: z.record(z.string()).optional(),
          scripts: z.record(z.string()).optional(),
          success: z.boolean().optional(),
          error: z.string().optional(),
        });

        const result = zodToJsonSchema(PackageAnalysisSchema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('dependencies');
        expect(result.properties).toHaveProperty('devDependencies');
        expect(result.properties).toHaveProperty('peerDependencies');
        expect(result.properties).toHaveProperty('scripts');
      });

      it('should convert PackageMergeInputSchema with nested PackageAnalysisSchema', () => {
        // From packages/agent-builder/src/types.ts line 275-280
        const PackageAnalysisSchema = z.object({
          name: z.string().optional(),
          dependencies: z.record(z.string()).optional(),
          devDependencies: z.record(z.string()).optional(),
        });

        const PackageMergeInputSchema = z.object({
          commitSha: z.string(),
          slug: z.string(),
          targetPath: z.string().optional(),
          packageInfo: PackageAnalysisSchema,
        });

        const result = zodToJsonSchema(PackageMergeInputSchema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('packageInfo');
        expect(result.required).toContain('commitSha');
        expect(result.required).toContain('slug');
        expect(result.required).toContain('packageInfo');
      });

      it('should convert FileCopyInputSchema', () => {
        // From packages/agent-builder/src/types.ts line 138-145
        const TemplateUnitSchema = z.object({
          kind: z.enum(['mcp-server', 'tool', 'workflow', 'agent', 'integration', 'network', 'other']),
          id: z.string(),
          file: z.string(),
        });

        const FileCopyInputSchema = z.object({
          orderedUnits: z.array(TemplateUnitSchema),
          templateDir: z.string(),
          commitSha: z.string(),
          slug: z.string(),
          targetPath: z.string().optional(),
          variables: z.record(z.string()).optional(),
        });

        const result = zodToJsonSchema(FileCopyInputSchema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('orderedUnits');
        expect(result.properties).toHaveProperty('variables');
        expect(result.required).toContain('orderedUnits');
      });
    });

    describe('edge cases', () => {
      it('should handle nested z.record() (record of records)', () => {
        const schema = z.record(z.record(z.string()));

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle z.record() in array', () => {
        const schema = z.array(z.record(z.string()));

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('array');
        expect(result.items).toBeDefined();
      });

      it('should handle z.record() in union', () => {
        const schema = z.union([z.string(), z.record(z.string())]);

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        // Union could be represented as anyOf or oneOf
        expect(result.anyOf || result.oneOf).toBeDefined();
      });

      it('should handle empty object with potential for records', () => {
        const schema = z.object({
          data: z.record(z.any()).optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle z.record() with .nullable()', () => {
        const schema = z.object({
          config: z.record(z.string()).nullable(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('config');
      });

      it('should handle z.record() with .default()', () => {
        const schema = z.object({
          settings: z.record(z.string()).default({}),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('settings');
      });

      it('should handle mixed one-arg and two-arg records in same schema', () => {
        const schema = z.object({
          // One-arg form (string values)
          metadata: z.record(z.string()),
          // Two-arg form (number values with explicit string keys)
          scores: z.record(z.string(), z.number()),
          // Two-arg with enum keys
          roles: z.record(z.enum(['admin', 'user']), z.boolean()).optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('metadata');
        expect(result.properties).toHaveProperty('scores');
        expect(result.properties).toHaveProperty('roles');
      });

      it('should handle z.record() with .nullish()', () => {
        const schema = z.object({
          extra: z.record(z.string()).nullish(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('extra');
      });

      it('should handle z.record() with .catch()', () => {
        const schema = z.object({
          config: z.record(z.string()).catch({}),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('config');
      });

      it('should handle z.record() with date values', () => {
        const schema = z.object({
          timestamps: z.record(z.date()),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('timestamps');

        // The record's values should be dates (converted to string with date-time format)
        const timestampsSchema = result.properties!.timestamps as any;
        expect(timestampsSchema).toBeDefined();

        // Verify the additionalProperties (record values) are properly typed as date-time strings
        const additionalProps = timestampsSchema.additionalProperties as any;
        expect(additionalProps).toBeDefined();
        expect(additionalProps.type).toBe('string');
        expect(additionalProps.format).toBe('date-time');
      });

      it('should handle deeply nested optional records', () => {
        const schema = z.object({
          level1: z
            .object({
              level2: z
                .object({
                  level3: z
                    .object({
                      data: z.record(z.string()).optional(),
                    })
                    .optional(),
                })
                .optional(),
            })
            .optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('level1');
      });

      it('should handle z.record() with .describe()', () => {
        const schema = z.object({
          metadata: z.record(z.string()).describe('User metadata fields'),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('metadata');
      });

      it('should handle z.record() with literal union values', () => {
        const schema = z.record(z.union([z.literal('active'), z.literal('inactive')]));

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle intersection with z.record()', () => {
        const baseSchema = z.object({
          name: z.string(),
        });

        const extendedSchema = z.object({
          metadata: z.record(z.string()),
        });

        const schema = z.intersection(baseSchema, extendedSchema);

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        // Intersection could be represented as allOf or merged object
        expect(result.allOf || result.type === 'object').toBeTruthy();
      });

      it('should handle lazy/recursive schemas with records', () => {
        type Node = {
          value: string;
          children: Record<string, Node>;
        };

        const nodeSchema: z.ZodType<Node> = z.lazy(() =>
          z.object({
            value: z.string(),
            children: z.record(nodeSchema),
          }),
        );

        const result = zodToJsonSchema(nodeSchema);

        expect(result).toBeDefined();
        // Lazy schemas might use $ref or be inlined
        expect(result).toBeDefined();
      });
    });

    describe('date handling', () => {
      it('should convert z.date() to string with date-time format', () => {
        const schema = z.object({
          createdAt: z.date(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.properties?.createdAt).toMatchObject({
          type: 'string',
          format: 'date-time',
        });
      });

      it('should handle dates in schemas with z.record()', () => {
        const schema = z.object({
          createdAt: z.date(),
          metadata: z.record(z.string()),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.properties?.createdAt).toMatchObject({
          type: 'string',
          format: 'date-time',
        });
        expect(result.properties).toHaveProperty('metadata');
      });
    });

    describe('basic schema types', () => {
      it('should handle simple object schema', () => {
        const schema = z.object({
          name: z.string(),
          age: z.number(),
          active: z.boolean(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('name');
        expect(result.properties).toHaveProperty('age');
        expect(result.properties).toHaveProperty('active');
      });

      it('should handle optional fields', () => {
        const schema = z.object({
          required: z.string(),
          optional: z.string().optional(),
        });

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.required).toContain('required');
        expect(result.required).not.toContain('optional');
      });

      it('should handle arrays', () => {
        const schema = z.array(z.string());

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('array');
        expect(result.items).toBeDefined();
      });

      it('should handle enums', () => {
        const schema = z.enum(['light', 'dark', 'auto']);

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.enum).toEqual(['light', 'dark', 'auto']);
      });
    });

    describe('different targets and strategies', () => {
      it('should handle openApi3 target', () => {
        const schema = z.object({
          name: z.string(),
          metadata: z.record(z.string()),
        });

        const result = zodToJsonSchema(schema, 'openApi3');

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
      });

      it('should handle different strategy parameters', () => {
        const schema = z.object({
          data: z.record(z.string()),
        });

        const resultNone = zodToJsonSchema(schema, 'jsonSchema7', 'none');
        const resultRoot = zodToJsonSchema(schema, 'jsonSchema7', 'root');

        expect(resultNone).toBeDefined();
        expect(resultRoot).toBeDefined();
      });
    });

    describe('fallback behavior', () => {
      it('should successfully convert schemas that might fail in Zod v4', () => {
        // This schema structure is known to cause issues in Zod v4's toJSONSchema
        const problematicSchema = z.object({
          repo: z.string(),
          variables: z.record(z.string()).optional(),
          dependencies: z.record(z.string()).optional(),
        });

        // Should not throw, even if v4 fails internally
        expect(() => zodToJsonSchema(problematicSchema)).not.toThrow();

        const result = zodToJsonSchema(problematicSchema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(result.properties).toHaveProperty('repo');
        expect(result.properties).toHaveProperty('variables');
        expect(result.properties).toHaveProperty('dependencies');
      });

      it('should handle multiple z.record() fields without errors', () => {
        const schema = z.object({
          field1: z.record(z.string()),
          field2: z.record(z.number()),
          field3: z.record(z.boolean()),
          field4: z.record(z.any()),
        });

        expect(() => zodToJsonSchema(schema)).not.toThrow();

        const result = zodToJsonSchema(schema);

        expect(result).toBeDefined();
        expect(result.type).toBe('object');
        expect(Object.keys(result.properties || {}).length).toBe(4);
      });
    });
  });
}
