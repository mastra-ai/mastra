import { describe, it, expect } from 'vitest';
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
        execute: async ({ context }) => {
          return { success: true, data: context };
        },
      });

      // Test missing required fields
      const result = await tool.execute({ context: {} });
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
        execute: async ({ context }) => {
          return { success: true, data: context };
        },
      });

      const result = await tool.execute({
        context: {
          count: 'not a number',
          active: 'not a boolean',
        },
      });

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
        execute: async ({ context }) => {
          return { success: true, data: context };
        },
      });

      const result = await tool.execute({
        context: {
          email: 'not-an-email',
          username: 'ab',
          password: 'weak',
        },
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
        execute: async ({ context }) => {
          return { success: true, data: context };
        },
      });

      const result = await tool.execute({
        context: {
          tags: [],
          metadata: {
            priority: 'urgent', // Not in enum
          },
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
        execute: async ({ context }) => {
          return { success: true, data: context };
        },
      });

      const result = await tool.execute({
        context: {
          name: 'John Doe',
          age: 30,
          email: 'john@example.com',
        },
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
        execute: async ({ context }) => {
          return { transformed: context };
        },
      });

      const result = await tool.execute({
        context: {
          name: '  JOHN DOE  ',
          age: '25',
        },
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
        execute: async ({ context }) => {
          return { validated: true, user: context };
        },
      });

      // Simulate tool execution with invalid data
      const result = await validateUser.execute({
        context: {
          email: 'invalid-email',
          age: 16,
        },
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

      const result = await tool.execute({
        context: { username: 'ab' },
      });

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
        execute: async ({ context }) => {
          // In workflow context, the data comes as inputData
          const data = context.inputData || context;
          return { result: data.name };
        },
      });

      const stepContext = {
        context: {
          inputData: {
            name: 'test',
          },
        },
        runId: 'test-run',
        runtimeContext: {},
      };

      const result = await tool.execute(stepContext as any);

      expect(result).toEqual({ result: 'test' });
    });
  });

  describe('Edge cases', () => {
    it('should handle tools without input schema', async () => {
      const tool = createTool({
        id: 'no-schema',
        description: 'Tool without schema',
        execute: async ({ context }) => {
          return { received: context };
        },
      });

      const result = await tool.execute({
        context: { anything: 'goes' },
      });

      expect(result.error).toBeUndefined();
      expect(result.received).toEqual({ anything: 'goes' });
    });

    it('should handle empty context when schema expects data', async () => {
      const tool = createTool({
        id: 'empty-context',
        description: 'Test empty context',
        inputSchema: z.object({
          required: z.string(),
        }),
        execute: async ({ context }) => {
          return { data: context };
        },
      });

      // Test with undefined context - this represents a case where context is missing
      const result = await tool.execute({ context: undefined as any });
      expect(result.error).toBe(true);
      expect(result.message).toContain('Tool validation failed');
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
        execute: async ({ context }) => {
          return { data: context };
        },
      });

      const result = await tool.execute({
        context: {
          required: 'value',
          extra: 'preserved',
        },
      });

      expect(result.error).toBeUndefined();
      expect(result.data).toEqual({
        required: 'value',
        extra: 'preserved',
      });
    });
  });
});
