import type { Schema } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { Targets } from 'zod-to-json-schema';
import type { MastraLanguageModel } from '../../agent/types';
import { MastraBase } from '../../base';
import type { ToolAction } from '../types';

// Mock the types we need
type SchemaConstraints = {
  [path: string]: {
    stringMin?: number;
    stringMax?: number;
    defaultValue?: unknown;
    minLength?: number;
    maxLength?: number;
    email?: boolean;
    regex?: {
      pattern: string;
      flags?: string;
    };
  };
};

// Create a base class for testing
abstract class TestToolCompatibilityBase extends MastraBase {
  constructor() {
    super({ name: 'SchemaCompatibility' });
  }

  abstract shouldApply(input: { model: MastraLanguageModel }): boolean;
  abstract getSchemaTarget(): Targets | undefined;
  abstract processZodType(value: z.ZodTypeAny, path: string, constraints: SchemaConstraints): z.ZodTypeAny;

  process(tool: ToolAction<any, any, any> | { id: string; description: string; parameters: z.ZodObject<any> }): {
    description?: string;
    parameters: Schema;
  } {
    if ('parameters' in tool) {
      return {
        description: tool.description,
        parameters: { jsonSchema: { type: 'object' } } as Schema,
      };
    }

    const constraints: SchemaConstraints = {};
    const schema = tool.inputSchema;

    if (schema instanceof z.ZodObject) {
      Object.entries(schema.shape).forEach(([key, value]) => {
        if (value instanceof z.ZodType) {
          this.processZodType(value, key, constraints);
        }
      });
    }

    return {
      description:
        (tool.description || '') + (Object.keys(constraints).length > 0 ? ' ' + JSON.stringify(constraints) : ''),
      parameters: { jsonSchema: { type: 'object' } } as Schema,
    };
  }
}

// Create a concrete implementation for testing
class TestToolCompat extends TestToolCompatibilityBase {
  shouldApply({ model }: { model: MastraLanguageModel }): boolean {
    return model.provider === 'test';
  }

  getSchemaTarget(): Targets {
    return 'jsonSchema7';
  }

  processZodType(value: z.ZodTypeAny, path: string, constraints: SchemaConstraints): z.ZodTypeAny {
    if (value instanceof z.ZodString) {
      if (value._def.checks) {
        const stringConstraints: Record<string, unknown> = {};

        for (const check of value._def.checks) {
          if (check.kind === 'min') {
            stringConstraints.stringMin = check.value;
          }
          if (check.kind === 'max') {
            stringConstraints.stringMax = check.value;
          }
        }

        if (Object.keys(stringConstraints).length > 0) {
          constraints[path] = stringConstraints;
        }
      }
    } else if (value instanceof z.ZodObject) {
      // Process each property of the object recursively
      Object.entries(value.shape).forEach(([key, propValue]) => {
        if (propValue instanceof z.ZodType) {
          this.processZodType(propValue, `${path}.${key}`, constraints);
        }
      });
    } else if (value instanceof z.ZodArray) {
      // Process array element type
      const elementType = value._def.type;
      if (elementType instanceof z.ZodType) {
        this.processZodType(elementType, `${path}.*`, constraints);
      }
    }

    return value;
  }
}

describe('ToolCompatibility', () => {
  describe('shouldApply', () => {
    it('should apply for matching model provider', () => {
      const compat = new TestToolCompat();
      expect(compat.shouldApply({ model: { provider: 'test' } as MastraLanguageModel })).toBe(true);
      expect(compat.shouldApply({ model: { provider: 'other' } as MastraLanguageModel })).toBe(false);
    });
  });

  describe('process', () => {
    const compat = new TestToolCompat();

    describe('with regular tool', () => {
      it('should process tool with simple schema', () => {
        const tool = {
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({
            name: z.string().min(2).max(10),
          }),
        } as ToolAction<any, any, any>;

        const result = compat.process(tool);

        // Check description contains constraints
        expect(result.description).toContain('A test tool');
        expect(result.description).toContain('"name":{"stringMin":2,"stringMax":10}');

        // Check schema structure
        expect(result.parameters).toBeDefined();
        expect(result.parameters.jsonSchema).toMatchObject({
          type: 'object',
        });
      });

      it('should process tool with nested schema', () => {
        const tool = {
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({
            user: z.object({
              name: z.string().min(2),
              age: z.number(),
            }),
          }),
        } as ToolAction<any, any, any>;

        const result = compat.process(tool);

        // Check description contains nested constraints
        expect(result.description).toContain('"user.name":{"stringMin":2}');

        // Check nested schema structure
        expect(result.parameters.jsonSchema).toMatchObject({
          type: 'object',
        });
      });

      it('should handle array schemas', () => {
        const tool = {
          id: 'test-tool',
          description: 'A test tool',
          inputSchema: z.object({
            tags: z.array(z.string().min(2)),
          }),
        } as ToolAction<any, any, any>;

        const result = compat.process(tool);

        // Check array constraints
        expect(result.description).toContain('"tags.*":{"stringMin":2}');

        // Check array schema structure
        expect(result.parameters.jsonSchema).toMatchObject({
          type: 'object',
        });
      });
    });

    describe('with Vercel tool', () => {
      it('should process Vercel tool parameters', () => {
        const tool = {
          id: 'vercel-tool',
          description: 'A Vercel tool',
          parameters: z.object({
            query: z.string().min(3),
          }),
        };

        const result = compat.process(tool);

        // Vercel tools should preserve original description
        expect(result.description).toBe('A Vercel tool');

        // Check schema conversion
        expect(result.parameters).toBeDefined();
        expect(result.parameters.jsonSchema).toBeDefined();
      });
    });
  });
});
