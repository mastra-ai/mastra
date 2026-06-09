import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodToJsonSchema, ensureAllPropertiesRequired } from './zod-to-json';

/**
 * Shared test suite for zodToJsonSchema that runs with both Zod v3 and v4.
 * The caller passes the zod instance to use for the tests.
 *
 * @param z - The zod instance (either v3 or v4)
 */

// Detect if we're running with Zod v4 (v4 has _zod property on schema instances)
const isZodV4 = '_zod' in z.string();

/**
 * Creates a z.record() schema that works with both Zod v3 and v4.
 * - Zod v4: z.record(keyType, valueType) - requires both key and value types
 * - Zod v3: z.record(valueType) - only takes value type (keys are implicitly strings)
 *
 * @param valueType - The Zod type for record values
 * @returns A z.record() schema compatible with the current Zod version
 */
function createRecord<T extends z.ZodTypeAny>(valueType: T) {
  if (isZodV4) {
    return z.record(z.string(), valueType);
  }
  // @ts-expect-error - zod v3 does not support record with key and value types
  return z.record(valueType);
}

describe('zodToJsonSchema', () => {
  describe('z.record() compatibility', () => {
    it('should convert schema with z.record() fields', () => {
      const schema = z.object({
        name: z.string(),
        variables: createRecord(z.string()).optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('name');
      expect(result.properties).toHaveProperty('variables');
    });

    it('should handle nested z.record() in complex schemas', () => {
      const schema = z.object({
        dependencies: createRecord(z.string()).optional(),
        devDependencies: createRecord(z.string()).optional(),
        scripts: createRecord(z.string()).optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('dependencies');
      expect(result.properties).toHaveProperty('devDependencies');
      expect(result.properties).toHaveProperty('scripts');
    });

    it('should handle standalone z.record()', () => {
      const schema = createRecord(z.string());

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
    });

    it('should handle z.record() with complex value types', () => {
      const schema = createRecord(
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
        metadata: createRecord(z.union([z.string(), z.number(), z.boolean()])),
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
        variables: createRecord(z.string()).optional().describe('Environment variables to set in .env file'),
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
        dependencies: createRecord(z.string()).optional(),
        devDependencies: createRecord(z.string()).optional(),
        peerDependencies: createRecord(z.string()).optional(),
        scripts: createRecord(z.string()).optional(),
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
        dependencies: createRecord(z.string()).optional(),
        devDependencies: createRecord(z.string()).optional(),
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
        variables: createRecord(z.string()).optional(),
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
      const schema = z.record(createRecord(z.string()));

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
    });

    it('should handle z.record() in array', () => {
      const schema = z.array(createRecord(z.string()));

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('array');
      expect(result.items).toBeDefined();
    });

    it('should handle z.record() in union', () => {
      const schema = z.union([z.string(), createRecord(z.string())]);

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      // Union could be represented as anyOf or oneOf
      expect(result.anyOf || result.oneOf).toBeDefined();
    });

    it('should handle empty object with potential for records', () => {
      const schema = z.object({
        data: createRecord(z.any()).optional(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
    });

    it('should handle z.record() with .nullable()', () => {
      const schema = z.object({
        config: createRecord(z.string()).nullable(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('config');
    });

    it('should handle z.record() with .default()', () => {
      const schema = z.object({
        settings: createRecord(z.string()).default({}),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('settings');
    });

    it('should handle mixed one-arg and two-arg records in same schema', () => {
      const schema = z.object({
        // One-arg form (string values)
        metadata: createRecord(z.string()),
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
        extra: createRecord(z.string()).nullish(),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('extra');
    });

    it('should handle z.record() with .catch()', () => {
      const schema = z.object({
        config: createRecord(z.string()).catch({}),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('config');
    });

    it('should handle z.record() with date values', () => {
      const schema = z.object({
        timestamps: createRecord(z.date()),
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
                    data: createRecord(z.string()).optional(),
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
        metadata: createRecord(z.string()).describe('User metadata fields'),
      });

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(result.properties).toHaveProperty('metadata');
    });

    it('should handle z.record() with literal union values', () => {
      const schema = createRecord(z.union([z.literal('active'), z.literal('inactive')]));

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
    });

    it('should handle intersection with z.record()', () => {
      const baseSchema = z.object({
        name: z.string(),
      });

      const extendedSchema = z.object({
        metadata: createRecord(z.string()),
      });

      const schema = z.intersection(baseSchema, extendedSchema);

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      // Intersection could be represented as allOf or merged object
      expect(result.allOf || result.type === 'object').toBeTruthy();
    });

    it('should handle lazy/recursive schemas with records', () => {
      const nodeSchema: any = z.lazy(() =>
        z.object({
          value: z.string(),
          children: createRecord(nodeSchema),
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
        metadata: createRecord(z.string()),
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
      expect(result.required).toContain('optional');
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
        metadata: createRecord(z.string()),
      });

      const result = zodToJsonSchema(schema, 'openApi3');

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
    });

    it('should handle different strategy parameters', () => {
      const schema = z.object({
        data: createRecord(z.string()),
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
        variables: createRecord(z.string()).optional(),
        dependencies: createRecord(z.string()).optional(),
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
        field1: createRecord(z.string()),
        field2: createRecord(z.number()),
        field3: createRecord(z.boolean()),
        field4: createRecord(z.any()),
      });

      expect(() => zodToJsonSchema(schema)).not.toThrow();

      const result = zodToJsonSchema(schema);

      expect(result).toBeDefined();
      expect(result.type).toBe('object');
      expect(Object.keys(result.properties || {}).length).toBe(4);
    });
  });
});

// =============================================================================
// ensureAllPropertiesRequired — unit tests
// =============================================================================

describe('ensureAllPropertiesRequired', () => {
  it('should add all properties to required array for object schemas', () => {
    // Test ensureAllPropertiesRequired directly on a raw JSON schema
    // (zodToJsonSchema already calls this internally now)
    const rawSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        isComplete: { type: 'boolean' },
        completionReason: { type: 'string' },
        finalResult: { type: 'string' },
      },
      required: ['isComplete', 'completionReason'],
    };

    const fixed = ensureAllPropertiesRequired(rawSchema);

    expect(fixed.required).toContain('isComplete');
    expect(fixed.required).toContain('completionReason');
    expect(fixed.required).toContain('finalResult');
  });

  it('should handle the defaultCompletionSchema pattern', () => {
    const defaultCompletionSchema = z.object({
      isComplete: z.boolean().describe('Whether the task is complete'),
      completionReason: z.string().describe('Explanation of why the task is or is not complete'),
      finalResult: z.string().optional().describe('The final result text to return to the user'),
    });

    const schema = zodToJsonSchema(defaultCompletionSchema);
    const fixed = ensureAllPropertiesRequired(schema);

    expect(fixed.type).toBe('object');
    expect(fixed.required).toEqual(expect.arrayContaining(['isComplete', 'completionReason', 'finalResult']));
    expect(fixed.required).toHaveLength(3);
  });

  it('should recursively fix nested object schemas', () => {
    const schema = {
      type: 'object' as const,
      properties: {
        outer: {
          type: 'object' as const,
          properties: {
            required: { type: 'string' as const },
            optional: { type: ['string', 'null'] as const },
          },
          required: ['required'],
        },
      },
      required: [] as string[],
    };

    const fixed = ensureAllPropertiesRequired(schema);

    expect(fixed.required).toContain('outer');

    const outerProp = fixed.properties!.outer as any;
    expect(outerProp.required).toContain('required');
    expect(outerProp.required).toContain('optional');
  });

  it('should handle schemas without properties (no-op)', () => {
    const schema = { type: 'string' as const };
    const fixed = ensureAllPropertiesRequired(schema);
    expect(fixed).toEqual({ type: 'string' });
  });

  it('should handle null/non-object schemas', () => {
    expect(ensureAllPropertiesRequired(null as any)).toBeNull();
    expect(ensureAllPropertiesRequired(true as any)).toBe(true);
  });

  it('should handle schemas with items (arrays)', () => {
    const schema = {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          age: { type: ['number', 'null'] as const },
        },
        required: ['name'],
      },
    };

    const fixed = ensureAllPropertiesRequired(schema);
    const items = fixed.items as any;
    expect(items.required).toContain('name');
    expect(items.required).toContain('age');
  });

  it('should handle anyOf/oneOf/allOf schemas', () => {
    const schema = {
      anyOf: [
        {
          type: 'object' as const,
          properties: {
            a: { type: 'string' as const },
            b: { type: ['string', 'null'] as const },
          },
          required: ['a'],
        },
      ],
    };

    const fixed = ensureAllPropertiesRequired(schema);
    const branch = (fixed.anyOf as any)[0];
    expect(branch.required).toContain('a');
    expect(branch.required).toContain('b');
  });

  it('zodToJsonSchema puts all fields in required for OpenAI strict mode', () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const result = zodToJsonSchema(schema);
    expect(result.required).toContain('required');
    expect(result.required).toContain('optional');
  });
});

it('reproduce issue #16383 - optional fields must appear in required for OpenAI strict mode', () => {
  // Zod optional fields normally disappear from `required`
  // OpenAI strict mode requires all fields in `required`
  // and optionals widened to nullable.

  const schema = z.object({
    name: z.string(),
    nickname: z.string().optional().describe('The nickname'),
  });

  const result = zodToJsonSchema(schema) as any;

  expect(result.required).toBeDefined();

  expect(result.required).toEqual(expect.arrayContaining(['name', 'nickname']));

  const nicknameProp = result.properties?.nickname;

  expect(nicknameProp).toBeDefined();

  if (nicknameProp.anyOf) {
    expect(nicknameProp.anyOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'string',
        }),
        expect.objectContaining({
          type: 'null',
        }),
      ]),
    );
  } else {
    expect(nicknameProp.type).toEqual(expect.arrayContaining(['string', 'null']));

    expect(nicknameProp.type).not.toContain('number');

    expect(nicknameProp.type).not.toContain('boolean');
  }

  expect(nicknameProp.description).toBe('The nickname');
});

it('should handle optional fields inside array items (nested strict-mode)', () => {
  const schema = z.object({
    list: z
      .array(
        z.object({
          keep: z.string(),
          omit: z.string().optional(),
        }),
      )
      .optional(),
  });

  const result = zodToJsonSchema(schema) as any;

  expect(result.properties.list.items.type).toBe('object');
  expect(result.required).toContain('list');
  expect(result.properties.list.type).toEqual(['array', 'null']);
  expect(result.properties.list.items.required).toContain('keep');
  expect(result.properties.list.items.required).toContain('omit');
  expect(result.properties.list.items.properties.omit.type).toEqual(['string', 'null']);
});

describe('strict-mode widening for anyOf, oneOf, enum, and const', () => {
  // GAP #1: ensureAllPropertiesRequired widens only fields that have a `type` string/array.
  // A pure anyOf schema (z.union) has no `type` field, so it gets added to `required` but
  // is NOT widened with a `null` branch. OpenAI strict mode then sees a required field
  // that cannot be null, even though the source was .optional().
  it('GAP #1a: optional z.union field gets a null branch', () => {
    const schema = z.object({
      id: z.union([z.string(), z.number()]).optional(),
    });

    const result = zodToJsonSchema(schema) as any;

    expect(result.required).toContain('id');

    const idProp = result.properties.id;

    if (idProp.anyOf) {
      const hasNull = idProp.anyOf.some(
        (v: any) => v && (v.type === 'null' || (Array.isArray(v.type) && v.type.includes('null'))),
      );
      expect(hasNull).toBe(true);
    } else if (idProp.oneOf) {
      const hasNull = idProp.oneOf.some(
        (v: any) => v && (v.type === 'null' || (Array.isArray(v.type) && v.type.includes('null'))),
      );
      expect(hasNull).toBe(true);
    } else if (Array.isArray(idProp.type)) {
      expect(idProp.type).toContain('null');
    } else {
      // Field is required but has no way to express null — strict mode would reject.
      throw new Error(`optional union field has no null branch. Got: ${JSON.stringify(idProp)}`);
    }
  });

  it('GAP #1b: optional z.discriminatedUnion field gets a null branch', () => {
    const schema = z.object({
      event: z
        .discriminatedUnion('kind', [
          z.object({ kind: z.literal('a'), value: z.string() }),
          z.object({ kind: z.literal('b'), count: z.number() }),
        ])
        .optional(),
    });

    const result = zodToJsonSchema(schema) as any;

    expect(result.required).toContain('event');

    const eventProp = result.properties.event;

    if (eventProp.anyOf) {
      const hasNull = eventProp.anyOf.some(
        (v: any) => v && (v.type === 'null' || (Array.isArray(v.type) && v.type.includes('null'))),
      );
      expect(hasNull).toBe(true);
    } else if (eventProp.oneOf) {
      const hasNull = eventProp.oneOf.some(
        (v: any) => v && (v.type === 'null' || (Array.isArray(v.type) && v.type.includes('null'))),
      );
      expect(hasNull).toBe(true);
    } else if (Array.isArray(eventProp.type)) {
      expect(eventProp.type).toContain('null');
    } else {
      throw new Error(`optional discriminated union has no null branch. Got: ${JSON.stringify(eventProp)}`);
    }
  });

  // GAP #2: the v4 override's typeMap only handles string/number/boolean/integer.
  // For things like z.enum() and z.literal(), the override bails and the schema
  // ends up with type 'string' + an enum/const constraint that doesn't include null.
  // After ensureAllPropertiesRequired widens type to ['string','null'], the enum
  // constraint still lacks 'null', so a null value would fail the enum/const check.
  it('GAP #2a: optional z.enum produces a schema where null satisfies the type but not the enum', () => {
    const schema = z.object({
      status: z.enum(['a', 'b']).optional(),
    });

    const result = zodToJsonSchema(schema) as any;

    expect(result.required).toContain('status');

    const statusProp = result.properties.status;

    // If the field has an enum constraint, null must be a valid enum value for strict mode.
    if (statusProp.enum) {
      expect(statusProp.enum).toContain(null);
    }
  });

  it('GAP #2b: optional z.literal produces a schema where null satisfies the type but not the const', () => {
    const schema = z.object({
      kind: z.literal('only').optional(),
    });

    const result = zodToJsonSchema(schema) as any;

    expect(result.required).toContain('kind');

    const kindProp = result.properties.kind;

    // If the field has a const constraint, anyOf-with-null or const-allowing-null is required.
    // A widened type alone is insufficient because the const still pins the value.
    if ('const' in kindProp) {
      // Either the const is gone (replaced with enum that includes null) or there's an anyOf
      if (kindProp.anyOf) {
        const hasNull = kindProp.anyOf.some((v: any) => v && v.type === 'null');
        expect(hasNull).toBe(true);
      } else {
        throw new Error(`optional literal still has const without null escape. Got: ${JSON.stringify(kindProp)}`);
      }
    }
  });

  // GAP #3: zodToJsonSchema never calls ensureAdditionalPropertiesFalse / prepareJsonSchemaForOpenAIStrictMode.
  // For v4 the override sets additionalProperties: false on ZodObject nodes, but not on
  // ZodRecord. For v3 the library default does. But what about a JSON schema with a nested
  // object inside additionalProperties that doesn't have additionalProperties: false set?
  // The cleanest way to demonstrate: an inner object inside a record value should be strict.
  it('GAP #3: object inside record additionalProperties has additionalProperties: false', () => {
    const schema = z.object({
      bag: createRecord(
        z.object({
          inner: z.string(),
        }),
      ),
    });

    const result = zodToJsonSchema(schema) as any;

    const bagProp = result.properties.bag;
    const innerObjectSchema = bagProp.additionalProperties;

    expect(innerObjectSchema).toBeDefined();
    expect(innerObjectSchema.type).toBe('object');
    expect(innerObjectSchema.additionalProperties).toBe(false);
  });

  describe.runIf(isZodV4)('transforms (io: input)', () => {
    it('describes the pre-transform input shape for transformed fields', () => {
      const schema = z.object({
        additionalData: z.string().transform(val => JSON.parse(val)),
      });

      const result = zodToJsonSchema(schema);
      const additionalData = (result.properties as any).additionalData;

      expect(additionalData.type).toBe('string');
    });
  });
});
