import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTool } from './tool';

describe('Tool Input Validation Integration Tests', () => {
  describe('createTool validation', () => {
    it('should validate required fields', async () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'Test tool with validation',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().min(0),
        }),
        execute: async (inputData, _context) => {
          return { success: true, data: inputData };
        },
      });

      // Test missing required fields - pass raw data as first arg
      const result = await tool.execute({} as any);
      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
      expect(result.message).toContain('- name: Required');
      expect(result.message).toContain('- age: Required');
    });

    it('should validate field types', async () => {
      const tool = createTool({
        id: 'type-test',
        description: 'Test type validation',
        inputSchema: z.object({
          count: z.number(),
          active: z.boolean(),
        }),
        execute: async inputData => {
          return { success: true, data: inputData };
        },
      });

      const result = await tool.execute({
        count: 'not a number',
        active: 'not a boolean',
      } as any);

      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
      expect(result.validationErrors).toBeDefined();
    });

    it('should validate string constraints', async () => {
      const tool = createTool({
        id: 'string-test',
        description: 'Test string validation',
        inputSchema: z.object({
          email: z.string().email('Invalid email format'),
          username: z.string().min(3).max(20),
          password: z
            .string()
            .regex(
              /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
              'Password must be at least 8 characters with letters and numbers',
            ),
        }),
        execute: async inputData => {
          return { success: true, data: inputData };
        },
      });

      const result = await tool.execute({
        email: 'not-an-email',
        username: 'ab',
        password: 'weak',
      });

      expect(result.error).toBe(true);
      expect(result.message).toContain('Invalid email format');
      expect(result.message).toContain('String must contain at least 3 character(s)');
      expect(result.message).toContain('Password must be at least 8 characters');
    });

    it('should validate arrays and objects', async () => {
      const tool = createTool({
        id: 'complex-test',
        description: 'Test complex validation',
        inputSchema: z.object({
          tags: z.array(z.string()).min(1, 'At least one tag required'),
          metadata: z.object({
            priority: z.enum(['low', 'medium', 'high']),
            deadline: z.string().datetime().optional(),
          }),
        }),
        execute: async inputData => {
          return { success: true, data: inputData };
        },
      });

      const result = await tool.execute({
        tags: [],
        metadata: {
          priority: 'urgent' as any, // Not in enum - force type error
        },
      });

      expect(result.error).toBe(true);
      expect(result.message).toContain('At least one tag required');
      expect(result.message).toContain("Invalid enum value. Expected 'low' | 'medium' | 'high'");
    });

    it('should pass validation with valid data', async () => {
      const tool = createTool({
        id: 'valid-test',
        description: 'Test valid data',
        inputSchema: z.object({
          name: z.string(),
          age: z.number().min(0),
          email: z.string().email(),
        }),
        execute: async inputData => {
          return { success: true, data: inputData };
        },
      });

      const result = await tool.execute({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
      });
    });

    it('should use transformed data after validation', async () => {
      const tool = createTool({
        id: 'transform-test',
        description: 'Test data transformation',
        inputSchema: z.object({
          name: z.string().trim().toLowerCase(),
          age: z.string().transform(val => parseInt(val, 10)),
        }),
        execute: async inputData => {
          return { transformed: inputData };
        },
      });

      const result = await tool.execute({
        name: '  JOHN DOE  ',
        age: '25' as any, // Will be transformed to number
      });

      expect(result.error).toBeUndefined();
      expect(result.transformed).toEqual({
        name: 'john doe',
        age: 25,
      });
    });
  });

  describe('Tool validation features', () => {
    it('should handle validation errors gracefully', async () => {
      const validateUser = createTool({
        id: 'validate-user',
        description: 'Validate user data',
        inputSchema: z.object({
          email: z.string().email(),
          age: z.number().min(18, 'Must be 18 or older'),
        }),
        execute: async inputData => {
          return { validated: true, user: inputData };
        },
      });

      const result = await validateUser.execute({
        email: 'invalid-email',
        age: 16,
      });

      expect(result.error).toBe(true);
      expect(result.message).toContain('Invalid email');
      expect(result.message).toContain('Must be 18 or older');
    });

    it('should include tool ID in validation error messages', async () => {
      const tool = createTool({
        id: 'user-registration',
        description: 'Register a new user',
        inputSchema: z.object({
          username: z.string().min(3),
        }),
        execute: async () => {
          return { registered: true };
        },
      });

      const result = await tool.execute({ username: 'ab' });

      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed for user-registration');
    });
  });

  describe('Workflow context', () => {
    it('should validate StepExecutionContext format', async () => {
      const tool = createTool({
        id: 'test-tool',
        description: 'Test tool',
        inputSchema: z.object({
          name: z.string(),
        }),
        execute: async inputData => {
          return { result: inputData.name };
        },
      });

      const result = await tool.execute({ name: 'test' });

      expect(result).toEqual({ result: 'test' });
    });
  });

  describe('Schema with context and inputData fields', () => {
    it('should handle schema with context field without unwrapping', async () => {
      const tool = createTool({
        id: 'context-field-tool',
        description: 'Tool with context field in schema',
        inputSchema: z.object({
          context: z.string(),
          otherField: z.number(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        context: 'my-context-value',
        otherField: 42,
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({
        context: 'my-context-value',
        otherField: 42,
      });
    });

    it('should handle schema with inputData field without unwrapping', async () => {
      const tool = createTool({
        id: 'inputdata-field-tool',
        description: 'Tool with inputData field in schema',
        inputSchema: z.object({
          inputData: z.string(),
          metadata: z.object({
            timestamp: z.number(),
          }),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        inputData: 'my-input-data',
        metadata: { timestamp: 123456 },
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({
        inputData: 'my-input-data',
        metadata: { timestamp: 123456 },
      });
    });

    it('should reproduce the original bug scenario and fix it', async () => {
      // This test reproduces the original bug scenario described by the user
      const tool = createTool({
        id: 'context-field-bug',
        description: 'Tool that demonstrates the original context field bug',
        inputSchema: z.object({
          context: z.string(), // Schema expects a 'context' field
          otherValue: z.number(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        context: 'my-context-string-value',
        otherValue: 42,
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({
        context: 'my-context-string-value',
        otherValue: 42,
      });
    });

    it('should handle schema with both context and inputData fields', async () => {
      const tool = createTool({
        id: 'both-fields-tool',
        description: 'Tool with both context and inputData fields in schema',
        inputSchema: z.object({
          context: z.string(),
          inputData: z.number(),
          regularField: z.boolean(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        context: 'context-value',
        inputData: 42,
        regularField: true,
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({
        context: 'context-value',
        inputData: 42,
        regularField: true,
      });
    });

    it('should NOT unwrap context in v1.0 - breaking change', async () => {
      const tool = createTool({
        id: 'no-context-field',
        description: 'Tool without context field in schema',
        inputSchema: z.object({
          name: z.string(),
          value: z.number(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        name: 'test',
        value: 123,
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({
        name: 'test',
        value: 123,
      });
    });

    it('should fail validation when schema expects context but input has wrong type', async () => {
      const tool = createTool({
        id: 'context-validation-fail',
        description: 'Tool with context validation',
        inputSchema: z.object({
          context: z.string(),
          other: z.number(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        context: 123 as any, // Wrong type - should be string
        other: 456,
      });

      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
      expect(result.message).toContain('Expected string, received number');
    });

    it('should fail validation when schema expects inputData but input has wrong structure', async () => {
      const tool = createTool({
        id: 'inputdata-validation-fail',
        description: 'Tool with inputData validation',
        inputSchema: z.object({
          inputData: z.object({
            nested: z.string(),
          }),
          metadata: z.string(),
        }),
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        inputData: 'should-be-object' as any, // Wrong type - should be object
        metadata: 'valid-string',
      });

      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
      expect(result.message).toContain('Expected object, received string');
    });
  });

  describe('Edge cases', () => {
    it('should handle tools without input schema', async () => {
      const tool = createTool({
        id: 'no-schema',
        description: 'Tool without schema',
        execute: async inputData => {
          return { received: inputData };
        },
      });

      const result = await tool.execute({ anything: 'goes' } as any);

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({ anything: 'goes' });
    });

    it('should handle missing required fields', async () => {
      const tool = createTool({
        id: 'empty-context',
        description: 'Test empty context',
        inputSchema: z.object({
          required: z.string(),
        }),
        execute: async inputData => {
          return { data: inputData };
        },
      });

      const result = await tool.execute({} as any);
      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
      expect(result.message).toContain('Required');
    });

    it('should preserve additional properties when using passthrough', async () => {
      const tool = createTool({
        id: 'passthrough-test',
        description: 'Test passthrough',
        inputSchema: z
          .object({
            required: z.string(),
          })
          .passthrough(),
        execute: async inputData => {
          return { data: inputData };
        },
      });

      const result = await tool.execute({
        required: 'value',
        extra: 'preserved',
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        required: 'value',
        extra: 'preserved',
      });
    });

    it('should handle complex nested schema with context field', async () => {
      const tool = createTool({
        id: 'complex-context-schema',
        description: 'Tool with complex nested context schema',
        inputSchema: z.object({
          context: z.object({
            user: z.object({
              id: z.string(),
              name: z.string(),
            }),
            settings: z.array(z.string()),
          }),
          action: z.enum(['create', 'update', 'delete']),
        }),
        execute: async inputData => {
          return { processed: inputData };
        },
      });

      const result: any = await tool?.execute?.({
        context: {
          user: { id: '123', name: 'John' },
          settings: ['dark-mode', 'notifications'],
        },
        action: 'create',
      });

      expect(result.error).toBeUndefined();
      expect(result.processed).toEqual({
        context: {
          user: { id: '123', name: 'John' },
          settings: ['dark-mode', 'notifications'],
        },
        action: 'create',
      });
    });
  });
});
