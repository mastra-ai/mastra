import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createTool } from './tool';
import { validateToolInput } from './validation';

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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for test-tool. Please fix the following errors and try again:
        - name: Invalid input: expected string, received undefined
        - age: Invalid input: expected number, received undefined

        Provided arguments: {}"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for type-test. Please fix the following errors and try again:
        - count: Invalid input: expected number, received string
        - active: Invalid input: expected boolean, received string

        Provided arguments: {
          "count": "not a number",
          "active": "not a boolean"
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for string-test. Please fix the following errors and try again:
        - email: Invalid email format
        - username: Too small: expected string to have >=3 characters
        - password: Password must be at least 8 characters with letters and numbers

        Provided arguments: {
          "email": "not-an-email",
          "username": "ab",
          "password": "weak"
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for complex-test. Please fix the following errors and try again:
        - tags: At least one tag required
        - metadata.priority: Invalid option: expected one of "low"|"medium"|"high"

        Provided arguments: {
          "tags": [],
          "metadata": {
            "priority": "urgent"
          }
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for validate-user. Please fix the following errors and try again:
        - email: Invalid email address
        - age: Must be 18 or older

        Provided arguments: {
          "email": "invalid-email",
          "age": 16
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for user-registration. Please fix the following errors and try again:
        - username: Too small: expected string to have >=3 characters

        Provided arguments: {
          "username": "ab"
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for context-validation-fail. Please fix the following errors and try again:
        - context: Invalid input: expected string, received number

        Provided arguments: {
          "context": 123,
          "other": 456
        }"
      `);
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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for inputdata-validation-fail. Please fix the following errors and try again:
        - inputData: Invalid input: expected object, received string

        Provided arguments: {
          "inputData": "should-be-object",
          "metadata": "valid-string"
        }"
      `);
    });
  });

  describe('All-optional parameters', () => {
    it('should accept undefined input when all parameters are optional', async () => {
      const tool = createTool({
        id: 'all-optional-tool',
        description: 'Tool with all optional parameters',
        inputSchema: z.object({
          startTime: z.string().optional(),
          endTime: z.string().optional(),
          limit: z.number().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Simulate LLM sending undefined (as Claude Sonnet 4.5, Gemini 2.4 do)
      const result = await tool.execute!(undefined);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual({});
    });

    it('should accept null input when all parameters are optional', async () => {
      const tool = createTool({
        id: 'all-optional-null',
        description: 'Tool with all optional parameters',
        inputSchema: z.object({
          filter: z.string().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Some LLMs might send null instead of undefined
      const result = await tool.execute!(null as any);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual({});
    });

    it('should accept empty object input when all parameters are optional', async () => {
      const tool = createTool({
        id: 'all-optional-empty',
        description: 'Tool with all optional parameters',
        inputSchema: z.object({
          startTime: z.string().optional(),
          endTime: z.string().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Empty object should work (this already works, but good to verify)
      const result = await tool.execute!({});

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual({});
    });

    it('should still validate when partial args are provided with all-optional schema', async () => {
      const tool = createTool({
        id: 'partial-optional',
        description: 'Tool with all optional parameters',
        inputSchema: z.object({
          startTime: z.string().optional(),
          limit: z.number().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Providing some args should still work
      const result = await tool.execute!({ limit: 10 });

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual({ limit: 10 });
    });

    it('should still reject invalid types even with undefined-to-empty normalization', async () => {
      const tool = createTool({
        id: 'optional-type-check',
        description: 'Tool with all optional parameters',
        inputSchema: z.object({
          limit: z.number().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Invalid type should still fail
      const result = await tool.execute!({ limit: 'not-a-number' } as any);

      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for optional-type-check. Please fix the following errors and try again:
        - limit: Invalid input: expected number, received string

        Provided arguments: {
          "limit": "not-a-number"
        }"
      `);
    });

    it('should reject array input when object schema is expected', async () => {
      const tool = createTool({
        id: 'object-not-array',
        description: 'Tool expecting object, not array',
        inputSchema: z.object({
          items: z.array(z.string()).optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Array should NOT be normalized to {} - it should fail validation
      const result = await tool.execute!(['item1', 'item2'] as any);

      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for object-not-array. Please fix the following errors and try again:
        - root: Invalid input: expected object, received array

        Provided arguments: [
          "item1",
          "item2"
        ]"
      `);
    });

    it('should reject string input when object schema is expected', async () => {
      const tool = createTool({
        id: 'object-not-string',
        description: 'Tool expecting object, not string',
        inputSchema: z.object({
          name: z.string().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // String should NOT be normalized to {} - it should fail validation
      const result = await tool.execute!('some string' as any);

      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for object-not-string. Please fix the following errors and try again:
        - root: Invalid input: expected object, received string

        Provided arguments: "some string""
      `);
    });

    it('should reject number input when object schema is expected', async () => {
      const tool = createTool({
        id: 'object-not-number',
        description: 'Tool expecting object, not number',
        inputSchema: z.object({
          count: z.number().optional(),
        }),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // Number should NOT be normalized to {} - it should fail validation
      const result = await tool.execute!(42 as any);

      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for object-not-number. Please fix the following errors and try again:
        - root: Invalid input: expected object, received number

        Provided arguments: 42"
      `);
    });

    it('should accept undefined input when schema is an array', async () => {
      const tool = createTool({
        id: 'array-schema',
        description: 'Tool with array schema',
        inputSchema: z.array(
          z.object({
            id: z.string().optional(),
          }),
        ),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // LLM might send undefined for an array schema too
      const result = await tool.execute!(undefined as any);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual([]);
    });

    it('should accept null input when schema is an array', async () => {
      const tool = createTool({
        id: 'array-schema-null',
        description: 'Tool with array schema',
        inputSchema: z.array(z.string()),
        execute: async inputData => {
          return { success: true, receivedArgs: inputData };
        },
      });

      // LLM might send null for an array schema
      const result = await tool.execute!(null as any);

      expect(result.error).toBeUndefined();
      expect(result.success).toBe(true);
      expect(result.receivedArgs).toEqual([]);
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

      const result = await tool.execute!({ anything: 'goes' } as any);

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
      expect(result.message).toMatchInlineSnapshot(`
        "Tool input validation failed for empty-context. Please fix the following errors and try again:
        - required: Invalid input: expected string, received undefined

        Provided arguments: {}"
      `);
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

describe('Tool Output Validation Tests', () => {
  it('should validate output against schema', async () => {
    const tool = createTool({
      id: 'output-validation',
      description: 'Test output validation',
      inputSchema: z.object({
        name: z.string(),
      }),
      outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }),
      execute: async inputData => {
        return { id: '123', name: inputData.name, email: 'test@example.com' };
      },
    });

    const result = await tool.execute({ name: 'John' });

    expect(result && 'error' in result ? result.error : undefined).toBeUndefined();
    expect(result).toEqual({
      id: '123',
      name: 'John',
      email: 'test@example.com',
    });
  });

  it('should fail validation when output does not match schema', async () => {
    const tool = createTool({
      id: 'invalid-output',
      description: 'Test invalid output',
      inputSchema: z.object({
        name: z.string(),
      }),
      outputSchema: z.object({
        id: z.string(),
        name: z.string(),
        email: z.string().email(),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        // Return invalid output - missing required fields
        return { id: '123' };
      },
    });

    const result = await tool.execute({ name: 'John' });

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for invalid-output. The tool returned invalid output:
        - name: Invalid input: expected string, received undefined
        - email: Invalid input: expected string, received undefined

        Returned output: {
          "id": "123"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should validate output types correctly', async () => {
    const tool = createTool({
      id: 'type-mismatch',
      description: 'Test type validation',
      outputSchema: z.object({
        count: z.number(),
        active: z.boolean(),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        return { count: 'not-a-number', active: 'not-a-boolean' };
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for type-mismatch. The tool returned invalid output:
        - count: Invalid input: expected number, received string
        - active: Invalid input: expected boolean, received string

        Returned output: {
          "count": "not-a-number",
          "active": "not-a-boolean"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should validate complex nested output', async () => {
    const tool = createTool({
      id: 'nested-output',
      description: 'Test nested output validation',
      outputSchema: z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          age: z.number().min(0),
        }),
        metadata: z.object({
          createdAt: z.string().datetime(),
          tags: z.array(z.string()).min(1),
        }),
      }),
      execute: async () => {
        return {
          user: { id: '123', name: 'John', age: -5 }, // Invalid: age is negative
          metadata: { createdAt: 'invalid-date', tags: [] }, // Invalid: not datetime, empty array
        };
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for nested-output. The tool returned invalid output:
        - user.age: Too small: expected number to be >=0
        - metadata.createdAt: Invalid ISO datetime
        - metadata.tags: Too small: expected array to have >=1 items

        Returned output: {
          "user": {
            "id": "123",
            "name": "John",
            "age": -5
          },
          "metadata": {
            "createdAt": "invalid-date",
            "tags": []
          }
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should transform output data after validation', async () => {
    const tool = createTool({
      id: 'transform-output',
      description: 'Test output transformation',
      outputSchema: z.object({
        name: z.string().trim().toUpperCase(),
        count: z.string().transform(val => parseInt(val, 10)),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        return { name: '  john doe  ', count: '42' };
      },
    });

    const result = await tool.execute({});

    expect(result && 'error' in result ? result.error : undefined).toBeUndefined();
    expect(result).toEqual({
      name: 'JOHN DOE',
      count: 42,
    });
  });

  it('should allow tools without output schema', async () => {
    const tool = createTool({
      id: 'no-output-schema',
      description: 'Tool without output schema',
      inputSchema: z.object({
        name: z.string(),
      }),
      execute: async inputData => {
        // Return anything - no validation
        return { anything: 'goes', name: inputData.name, extra: 123 };
      },
    });

    const result = await tool.execute({ name: 'John' });

    expect(result.error).toBeUndefined();
    expect(result).toEqual({ anything: 'goes', name: 'John', extra: 123 });
  });

  it('should include tool ID in output validation error messages', async () => {
    const tool = createTool({
      id: 'user-service',
      description: 'User service tool',
      outputSchema: z.object({
        userId: z.string().uuid(),
      }),
      execute: async () => {
        return { userId: 'not-a-uuid' };
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for user-service. The tool returned invalid output:
        - userId: Invalid UUID

        Returned output: {
          "userId": "not-a-uuid"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should handle both input and output validation together', async () => {
    const tool = createTool({
      id: 'full-validation',
      description: 'Tool with both input and output validation',
      inputSchema: z.object({
        email: z.string().email(),
      }),
      outputSchema: z.object({
        verified: z.boolean(),
        email: z.string().email(),
      }),
      execute: async inputData => {
        return { verified: true, email: inputData.email };
      },
    });

    // Test valid input and output
    const validResult = await tool.execute({ email: 'test@example.com' });
    expect(validResult && 'error' in validResult ? validResult.error : undefined).toBeUndefined();
    expect(validResult).toEqual({ verified: true, email: 'test@example.com' });

    // Test invalid input
    const invalidInputResult = await tool.execute({ email: 'not-an-email' });
    if ('error' in invalidInputResult) {
      expect(invalidInputResult.error).toBe(true);
      expect(invalidInputResult.message).toMatchInlineSnapshot(`
        "Tool input validation failed for full-validation. Please fix the following errors and try again:
        - email: Invalid email address

        Provided arguments: {
          "email": "not-an-email"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should validate output even when input validation passes', async () => {
    const tool = createTool({
      id: 'input-pass-output-fail',
      description: 'Valid input but invalid output',
      inputSchema: z.object({
        name: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
        count: z.number(),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        // Return invalid output even though input was valid
        return { result: 'success' }; // Missing count
      },
    });

    const result = await tool.execute({ name: 'John' });

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for input-pass-output-fail. The tool returned invalid output:
        - count: Invalid input: expected number, received undefined

        Returned output: {
          "result": "success"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should validate output with optional fields', async () => {
    const tool = createTool({
      id: 'optional-output',
      description: 'Test optional output fields',
      outputSchema: z.object({
        id: z.string(),
        name: z.string().optional(),
        metadata: z.object({ created: z.string() }).optional(),
      }),
      execute: async () => {
        return { id: '123' }; // Optional fields are not present
      },
    });

    const result = await tool.execute({});

    expect(result && 'error' in result ? result.error : undefined).toBeUndefined();
    expect(result).toEqual({ id: '123' });
  });

  it('should validate enums in output', async () => {
    const tool = createTool({
      id: 'enum-output',
      description: 'Test enum validation in output',
      outputSchema: z.object({
        status: z.enum(['pending', 'approved', 'rejected']),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        return { status: 'unknown' }; // Invalid enum value
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for enum-output. The tool returned invalid output:
        - status: Invalid option: expected one of "pending"|"approved"|"rejected"

        Returned output: {
          "status": "unknown"
        }"
      `);
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should truncate large output in error messages to prevent PII exposure', async () => {
    // Create a large object that would exceed 200 characters when stringified
    const largeData = {
      users: Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        sensitiveData: 'This could contain PII',
      })),
    };

    const tool = createTool({
      id: 'large-output',
      description: 'Test output truncation',
      outputSchema: z.object({
        status: z.literal('success'),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        return largeData; // Return large invalid output
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for large-output. The tool returned invalid output:
        - status: Invalid input: expected "success"

        Returned output: {
          "users": [
            {
              "id": 0,
              "name": "User 0",
              "email": "user0@example.com",
              "sensitiveData": "This could contain PII"
            },
            {
              "id": 1,
              "name": "User 1",
            ... (truncated)"
      `);
      // Ensure the full large data is NOT in the error message
      expect(result.message.length).toBeLessThan(500); // Should be much smaller than full output
      // Ensure sensitive data is not exposed
      expect(result.message).not.toContain('user49@example.com');
    } else {
      throw new Error('Result is not a validation error');
    }
  });

  it('should handle non-serializable output gracefully', async () => {
    const tool = createTool({
      id: 'non-serializable',
      description: 'Test non-serializable output',
      outputSchema: z.object({
        value: z.string(),
      }),
      // @ts-expect-error intentionally incorrect output
      execute: async () => {
        // Create circular reference
        const obj: any = { name: 'test' };
        obj.self = obj;
        return obj;
      },
    });

    const result = await tool.execute({});

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toMatchInlineSnapshot(`
        "Tool output validation failed for non-serializable. The tool returned invalid output:
        - value: Invalid input: expected string, received undefined

        Returned output: [Unable to serialize data]"
      `);
      expect(result.message).toContain('[Unable to serialize data]');
    } else {
      throw new Error('Result is not a validation error');
    }
  });
});

describe('validateToolInput - Null Stripping for Optional Fields (GitHub #12362)', () => {
  // These tests verify the fix for https://github.com/mastra-ai/mastra/issues/12362
  // LLMs like Gemini send null for optional fields, but Zod's .optional() only accepts
  // undefined, not null. The validateToolInput function retries with null values stripped
  // when initial validation fails.

  it('should accept null for optional fields (the original bug scenario)', () => {
    const schema = z.object({
      category: z.string(),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional(),
    });

    // LLM sends null for optional fields
    const input = { category: 'electronics', minPrice: null, maxPrice: null };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ category: 'electronics' });
  });

  it('should handle nested objects with null values in optional fields', () => {
    const schema = z.object({
      query: z.string(),
      filters: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().optional(),
      }),
    });

    const input = {
      query: 'search term',
      filters: {
        startDate: null,
        endDate: null,
        limit: 10,
      },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      query: 'search term',
      filters: { limit: 10 },
    });
  });

  it('should preserve null for .nullable() fields (null is a valid value)', () => {
    const schema = z.object({
      name: z.string(),
      status: z.string().nullable(),
    });

    // null is valid for .nullable() fields
    const input = { name: 'test', status: null };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: 'test', status: null });
  });

  it('should preserve null for required .nullable() fields without .optional()', () => {
    const schema = z.object({
      id: z.string(),
      deletedAt: z.string().nullable(), // Required field that accepts null
    });

    // null is valid - the field is required but nullable
    const input = { id: '123', deletedAt: null };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ id: '123', deletedAt: null });
  });

  it('should handle mix of .optional() and .nullable() fields', () => {
    const schema = z.object({
      name: z.string(),
      bio: z.string().optional(), // null should be stripped
      status: z.string().nullable(), // null should be preserved
    });

    const input = { name: 'test', bio: null, status: null };

    const result = validateToolInput(schema, input);

    // First try: { name: 'test', bio: null, status: null }
    //   bio fails (.optional() doesn't accept null), status passes (.nullable() accepts null)
    // Retry with stripped: { name: 'test' }
    //   bio passes (absent = undefined for .optional()), status fails (required field missing)
    // Neither attempt fully succeeds, so this should fail
    // ...unless the schema allows status to be absent too

    // Actually, status is required (not optional), so stripping null from it makes it missing.
    // The first attempt fails because bio: null is invalid for .optional().
    // The retry fails because status is missing (it's required).
    // This IS the expected behavior - the schema design is contradictory with null input for bio.
    // The user should use .nullable().optional() for bio or .nullable() for both.
    expect(result.error).toBeDefined();
  });

  it('should handle .nullable().optional() fields receiving null', () => {
    const schema = z.object({
      name: z.string(),
      nickname: z.string().nullable().optional(), // Accepts: string | null | undefined
    });

    // null is valid for .nullable().optional()
    const input = { name: 'test', nickname: null };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({ name: 'test', nickname: null });
  });

  it('should still reject invalid types after null stripping', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number().optional(),
    });

    // Invalid type should still fail even after null stripping
    const input = { name: 123, count: null };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain('Invalid input: expected string, received number');
  });

  it('should handle deeply nested null values', () => {
    const schema = z.object({
      level1: z.object({
        level2: z.object({
          value: z.string().optional(),
          required: z.string(),
        }),
      }),
    });

    const input = {
      level1: {
        level2: {
          value: null,
          required: 'present',
        },
      },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      level1: { level2: { required: 'present' } },
    });
  });
});

describe('validateToolInput - Undefined to Null Conversion (GitHub #11457)', () => {
  // These tests verify the fix for https://github.com/mastra-ai/mastra/issues/11457
  // When schemas are processed through OpenAI compat layers, .optional() is converted
  // to .nullable() for strict mode compliance. This means the schema expects null,
  // not undefined. The validateToolInput function now converts undefined → null
  // before validation so that omitted fields work correctly.

  it('should convert undefined to null in nested objects', () => {
    // Create a schema that expects nullable fields (like after OpenAI compat processing)
    const schema = z.object({
      name: z.string(),
      age: z
        .number()
        .nullable()
        .transform((val: number | null) => (val === null ? undefined : val)),
      nested: z.object({
        city: z
          .string()
          .nullable()
          .transform((val: string | null) => (val === null ? undefined : val)),
        country: z.string(),
      }),
    });

    // Input with undefined values (as if fields were omitted)
    const input = {
      name: 'John',
      age: undefined,
      nested: {
        city: undefined,
        country: 'USA',
      },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      name: 'John',
      age: undefined, // null was transformed to undefined
      nested: {
        city: undefined, // null was transformed to undefined
        country: 'USA',
      },
    });
  });

  it('should handle partial nested objects with undefined fields', () => {
    // This mimics the exact schema from GitHub issue #11457
    // After OpenAI compat processing, .partial() fields become nullable
    const schema = z.object({
      eventId: z.string(),
      request: z.object({
        City: z
          .string()
          .nullable()
          .transform((val: string | null) => (val === null ? undefined : val)),
        Name: z
          .string()
          .nullable()
          .transform((val: string | null) => (val === null ? undefined : val)),
        Slug: z
          .string()
          .nullable()
          .transform((val: string | null) => (val === null ? undefined : val)),
      }),
      eventImageFile: z
        .any()
        .nullable()
        .transform((val: any) => (val === null ? undefined : val)),
    });

    // Input with some fields omitted (undefined)
    const input = {
      eventId: '123',
      request: {
        Name: 'Test',
        City: undefined,
        Slug: undefined,
      },
      eventImageFile: undefined,
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      eventId: '123',
      request: {
        Name: 'Test',
        City: undefined,
        Slug: undefined,
      },
      eventImageFile: undefined,
    });
  });

  it('should convert undefined to null in arrays', () => {
    const schema = z.object({
      items: z.array(
        z.object({
          id: z.string(),
          value: z
            .string()
            .nullable()
            .transform((val: string | null) => (val === null ? undefined : val)),
        }),
      ),
    });

    const input = {
      items: [
        { id: '1', value: 'test' },
        { id: '2', value: undefined },
      ],
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      items: [
        { id: '1', value: 'test' },
        { id: '2', value: undefined },
      ],
    });
  });
});

describe('validateToolInput - Built-in Object Preservation (GitHub #11502)', () => {
  it('should preserve Date objects when validating z.coerce.date() schemas', () => {
    const schema = z.object({
      startDate: z.coerce.date(),
    });

    const input = {
      startDate: new Date('2024-01-01T00:00:00Z'),
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).startDate).toBeInstanceOf(Date);
    expect((result.data as any).startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should handle ISO string dates with z.coerce.date()', () => {
    const schema = z.object({
      startDate: z.coerce.date(),
    });

    const input = {
      startDate: '2024-01-01T00:00:00Z',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).startDate).toBeInstanceOf(Date);
    expect((result.data as any).startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('should preserve Date objects in nested structures', () => {
    const schema = z.object({
      params: z.object({
        startDate: z.coerce.date(),
        endDate: z.coerce.date(),
      }),
    });

    const input = {
      params: {
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-12-31T23:59:59Z'),
      },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).params.startDate).toBeInstanceOf(Date);
    expect((result.data as any).params.endDate).toBeInstanceOf(Date);
  });

  it('should preserve Date objects with nullable optional fields', () => {
    // This test verifies that Date objects are preserved even in schemas with
    // optional/nullable fields. The undefined-to-null conversion (GitHub #11457)
    // happens before validation, so we use nullable() with a transform.
    const schema = z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce
        .date()
        .nullable()
        .transform((val: Date | null) => val ?? undefined),
    });

    const input = {
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-12-31T23:59:59Z'),
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).startDate).toBeInstanceOf(Date);
    expect((result.data as any).endDate).toBeInstanceOf(Date);
  });

  it('should preserve RegExp objects', () => {
    const schema = z.object({
      pattern: z.any(),
    });

    const input = { pattern: /abc/i };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).pattern).toBeInstanceOf(RegExp);
    expect((result.data as any).pattern).toEqual(/abc/i);
  });

  it('should preserve Error objects', () => {
    const schema = z.object({
      error: z.any(),
    });

    const input = { error: new Error('Test error') };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).error).toBeInstanceOf(Error);
    expect((result.data as any).error.message).toBe('Test error');
  });

  it('should handle Date objects in arrays', () => {
    const schema = z.object({
      dates: z.array(z.coerce.date()),
    });

    const input = {
      dates: [new Date('2024-01-01T00:00:00Z'), new Date('2024-12-31T23:59:59Z')],
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).dates).toHaveLength(2);
    expect((result.data as any).dates[0]).toBeInstanceOf(Date);
    expect((result.data as any).dates[1]).toBeInstanceOf(Date);
  });

  it('should handle mixed Date objects and ISO strings', () => {
    const schema = z.object({
      date1: z.coerce.date(),
      date2: z.coerce.date(),
      date3: z.coerce.date(),
    });

    const input = {
      date1: new Date('2024-01-01T00:00:00Z'),
      date2: '2024-06-15T12:00:00.000Z',
      date3: new Date('2024-12-31T23:59:59Z'),
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).date1).toBeInstanceOf(Date);
    expect((result.data as any).date2).toBeInstanceOf(Date);
    expect((result.data as any).date3).toBeInstanceOf(Date);
  });

  it('should preserve Map objects', () => {
    const schema = z.object({
      data: z.any(),
    });

    const map = new Map([
      ['key1', 'value1'],
      ['key2', 'value2'],
    ]);
    const input = { data: map };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).data).toBeInstanceOf(Map);
    expect((result.data as any).data.get('key1')).toBe('value1');
  });

  it('should preserve Set objects', () => {
    const schema = z.object({
      data: z.any(),
    });

    const set = new Set([1, 2, 3]);
    const input = { data: set };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).data).toBeInstanceOf(Set);
    expect((result.data as any).data.has(2)).toBe(true);
  });

  it('should preserve URL objects', () => {
    const schema = z.object({
      url: z.any(),
    });

    const url = new URL('https://example.com/path?query=value');
    const input = { url };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).url).toBeInstanceOf(URL);
    expect((result.data as any).url.hostname).toBe('example.com');
  });

  it('should preserve custom class instances', () => {
    class CustomClass {
      constructor(public value: string) {}
      getValue() {
        return this.value;
      }
    }

    const schema = z.object({
      instance: z.any(),
    });

    const instance = new CustomClass('test');
    const input = { instance };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).instance).toBeInstanceOf(CustomClass);
    expect((result.data as any).instance.getValue()).toBe('test');
  });

  it('should handle nested plain objects with non-plain objects inside', () => {
    const schema = z.object({
      nested: z.object({
        date: z.coerce.date(),
        map: z.any(),
        name: z.string(),
      }),
    });

    const input = {
      nested: {
        date: new Date('2024-01-01T00:00:00Z'),
        map: new Map([['key', 'value']]),
        name: 'test',
      },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect((result.data as any).nested.date).toBeInstanceOf(Date);
    expect((result.data as any).nested.map).toBeInstanceOf(Map);
    expect((result.data as any).nested.map.get('key')).toBe('value');
  });
});

describe('validateToolInput - Stringified JSON Coercion (GitHub #12757)', () => {
  // These tests verify the fix for https://github.com/mastra-ai/mastra/issues/12757
  // Some LLMs (e.g., GLM4.7) generate tool arguments where array or object
  // parameters are returned as stringified JSON strings instead of actual
  // arrays/objects, causing Zod validation to fail.

  it('should coerce a stringified JSON array to an actual array', () => {
    const schema = z.object({
      command: z.string(),
      args: z.array(z.string()).nullish().default([]),
      timeout: z.number().nullish().default(30000),
    });

    const input = {
      command: 'python3',
      args: '["parse_excel.py"]',
      timeout: 60000,
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      command: 'python3',
      args: ['parse_excel.py'],
      timeout: 60000,
    });
  });

  it('should coerce a stringified JSON array with multiple items', () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const input = {
      items: '["item1", "item2", "item3"]',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      items: ['item1', 'item2', 'item3'],
    });
  });

  it('should coerce a stringified numeric array', () => {
    const schema = z.object({
      values: z.array(z.number()),
    });

    const input = {
      values: '[1, 2, 3]',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      values: [1, 2, 3],
    });
  });

  it('should coerce a stringified empty array', () => {
    const schema = z.object({
      tags: z.array(z.string()).default([]),
    });

    const input = {
      tags: '[]',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      tags: [],
    });
  });

  it('should coerce a stringified JSON object to an actual object', () => {
    const schema = z.object({
      name: z.string(),
      metadata: z.object({
        key: z.string(),
        value: z.string(),
      }),
    });

    const input = {
      name: 'test',
      metadata: '{"key": "color", "value": "blue"}',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      name: 'test',
      metadata: { key: 'color', value: 'blue' },
    });
  });

  it('should handle the exact GLM4.7 output for mastra_workspace_execute_command', () => {
    const schema = z.object({
      command: z.string().describe('The command to execute (e.g., "ls", "npm", "python")'),
      args: z.array(z.string()).nullish().default([]).describe('Arguments to pass to the command'),
      timeout: z.number().nullish().default(30000).describe('Maximum execution time in milliseconds.'),
      cwd: z.string().nullish().describe('Working directory for the command'),
    });

    const input = {
      command: 'python3',
      args: '["parse_excel.py"]',
      timeout: 60000,
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      command: 'python3',
      args: ['parse_excel.py'],
      timeout: 60000,
    });
  });

  it('should work end-to-end with createTool when LLM sends stringified array', async () => {
    const tool = createTool({
      id: 'mastra_workspace_execute_command',
      description: 'Execute a command',
      inputSchema: z.object({
        command: z.string(),
        args: z.array(z.string()).nullish().default([]),
        timeout: z.number().nullish().default(30000),
      }),
      execute: async ({ command, args, timeout }) => {
        return { command, args: args ?? [], timeout: timeout ?? 30000 };
      },
    });

    const result = await tool.execute({
      command: 'python3',
      args: '["parse_excel.py"]' as any,
      timeout: 60000,
    });

    expect(result.error).toBeUndefined();
    expect(result).toEqual({
      command: 'python3',
      args: ['parse_excel.py'],
      timeout: 60000,
    });
  });

  it('should NOT coerce regular strings that are not valid JSON', () => {
    const schema = z.object({
      name: z.string(),
      tags: z.array(z.string()),
    });

    const input = {
      name: 'test',
      tags: 'not-json-at-all',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeDefined();
  });

  it('should NOT coerce a string that parses to wrong type', () => {
    const schema = z.object({
      items: z.array(z.string()),
    });

    const input = {
      items: '42',
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeDefined();
  });

  it('should still accept actual arrays (no regression)', () => {
    const schema = z.object({
      command: z.string(),
      args: z.array(z.string()).nullish().default([]),
    });

    const input = {
      command: 'python3',
      args: ['parse_excel.py'],
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      command: 'python3',
      args: ['parse_excel.py'],
    });
  });

  it('should still accept actual objects (no regression)', () => {
    const schema = z.object({
      name: z.string(),
      config: z.object({ key: z.string() }),
    });

    const input = {
      name: 'test',
      config: { key: 'value' },
    };

    const result = validateToolInput(schema, input);

    expect(result.error).toBeUndefined();
    expect(result.data).toEqual({
      name: 'test',
      config: { key: 'value' },
    });
  });
});
