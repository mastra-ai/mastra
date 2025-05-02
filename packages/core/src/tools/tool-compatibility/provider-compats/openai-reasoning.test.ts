import { describe, expect, it, beforeEach } from 'vitest';
import { z } from 'zod';
import type { MastraLanguageModel } from '../../../agent/types';
import type { ToolAction } from '../../types';
import type { SchemaConstraints } from '../index';
import { OpenAIReasoningToolCompat } from './openai-reasoning';

// Mock implementation of ToolAction for testing
interface TestTool extends ToolAction<any, any, any> {
  type: 'function';
}

// Mock implementation of Vercel tool for testing
interface VercelTool {
  id: string;
  description: string;
  type: 'function';
  parameters: z.ZodObject<any>;
}

describe('OpenAIReasoningToolCompat', () => {
  let compat: OpenAIReasoningToolCompat;

  beforeEach(() => {
    const model = {
      provider: 'openai',
      supportsStructuredOutputs: true,
    } as MastraLanguageModel;

    compat = new OpenAIReasoningToolCompat(model);
  });

  describe('shouldApply', () => {
    it('should return true for OpenAI models with structured outputs', () => {
      expect(compat.shouldApply()).toBe(true);
    });

    it('should return false for non-OpenAI models', () => {
      expect(compat.shouldApply()).toBe(false);
    });

    it('should return false for OpenAI models without structured outputs', () => {
      expect(compat.shouldApply()).toBe(false);
    });
  });

  describe('getSchemaTarget', () => {
    it('should return openApi3', () => {
      expect(compat.getSchemaTarget()).toBe('openApi3');
    });
  });

  describe('processZodType', () => {
    let constraints: SchemaConstraints;

    beforeEach(() => {
      constraints = {};
    });

    describe('ZodOptional', () => {
      it('should convert optional types to nullable', () => {
        const schema = z.string().optional();
        const result = compat.processZodType(schema, 'test', constraints);
        expect(result._def.typeName).toBe('ZodNullable');
      });
    });

    describe('ZodObject', () => {
      it('should process nested object properties', () => {
        const schema = z.object({
          user: z.object({
            name: z.string().min(2),
            age: z.number().gte(18),
          }),
        });

        const result = compat.processZodType(schema, 'test', constraints);
        expect(result._def.typeName).toBe('ZodObject');
        console.log(constraints);
        expect(constraints).toHaveProperty('test.user.name', { stringMin: 2 });
        expect(constraints).toHaveProperty('test.user.age', { gte: 18 });
      });
    });

    describe('ZodArray', () => {
      it('should handle array constraints', () => {
        const schema = z.array(z.string()).min(1).max(5);
        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodArray');
        expect(constraints).toHaveProperty('test', { minLength: 1, maxLength: 5 });
      });

      it('should process array element types', () => {
        const schema = z.array(
          z.object({
            name: z.string().min(2),
          }),
        );

        const result = compat.processZodType(schema, 'test', constraints);
        expect(result._def.typeName).toBe('ZodArray');
        expect(constraints).toHaveProperty('test.*.name', { stringMin: 2 });
      });
    });

    describe('ZodDefault', () => {
      it('should store default values in constraints', () => {
        const schema = z.string().default('test-default');
        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodString');
        expect(constraints).toHaveProperty('test', { defaultValue: 'test-default' });
      });
    });

    describe('ZodNumber', () => {
      it('should handle number constraints', () => {
        const schema = z.number().gte(0).lt(100).multipleOf(5).int();

        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodNumber');
        expect(constraints).toHaveProperty('test', {
          gte: 0,
          lt: 100,
          multipleOf: 5,
        });
        expect(result._def.checks).toContainEqual({ kind: 'int' });
      });
    });

    describe('ZodString', () => {
      it('should handle string constraints', () => {
        const schema = z
          .string()
          .min(3)
          .max(10)
          .email()
          .regex(/^test-/i);

        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodString');

        console.log(constraints);
        expect(constraints).toHaveProperty('test', {
          stringMin: 3,
          stringMax: 10,
          email: true,
          regex: { pattern: '^test-', flags: 'i' },
        });
      });
    });

    describe('ZodDate', () => {
      it('should handle date constraints', () => {
        const minDate = new Date('2024-01-01');
        const maxDate = new Date('2024-12-31');
        const schema = z.date().min(minDate).max(maxDate);

        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodString');
        expect(result._def.description).toBe('date-time');
        expect(constraints).toHaveProperty('test', {
          minDate: minDate.toISOString(),
          maxDate: maxDate.toISOString(),
          dateFormat: 'date-time',
        });
      });
    });

    describe('ZodUnion', () => {
      it('should process union types', () => {
        const schema = z.union([z.string().min(2), z.number().gte(0)]);

        const result = compat.processZodType(schema, 'test', constraints);

        expect(result._def.typeName).toBe('ZodUnion');
        expect(constraints).toHaveProperty('test', {
          stringMin: 2,
          gte: 0,
        });
      });
    });
  });

  describe('process', () => {
    it('should process tool schema and add constraints to description', () => {
      const tool: TestTool = {
        id: 'test-tool',
        description: 'Test tool',
        type: 'function',
        inputSchema: z.object({
          name: z.string().min(3).email(),
          age: z.number().gte(18),
        }),
      };

      const result = compat.process(tool);

      expect(result.description).toContain('Test tool');
      expect(result.description).toContain('"name"');
      expect(result.description).toContain('"stringMin":3');
      expect(result.description).toContain('"email":true');
      expect(result.description).toContain('"age"');
      expect(result.description).toContain('"gte":18');
    });

    it('should handle Vercel tools', () => {
      const tool: VercelTool = {
        id: 'test-tool',
        description: 'Vercel tool',
        type: 'function',
        parameters: z.object({
          name: z.string().min(3),
        }),
      };

      const result = compat.process(tool);

      expect(result.description).toBe('Vercel tool');
      expect(result.parameters).toBeDefined();
    });
  });
});
