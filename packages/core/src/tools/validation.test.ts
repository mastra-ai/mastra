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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('- name: Required');
      expect(result.message).toContain('- email: Required');
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('- count: Expected number, received string');
      expect(result.message).toContain('- active: Expected boolean, received string');
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('- user.age');
      expect(result.message).toContain('- metadata.createdAt');
      expect(result.message).toContain('- metadata.tags');
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
      expect(result.message).toContain('Tool output validation failed for user-service');
      expect(result.message).toContain('Invalid uuid');
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
      expect(invalidInputResult.message).toContain('Tool validation failed');
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('- count: Required');
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain("Invalid enum value. Expected 'pending' | 'approved' | 'rejected'");
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('... (truncated)');
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
      expect(result.message).toContain('Tool output validation failed');
      expect(result.message).toContain('[Unable to serialize data]');
    } else {
      throw new Error('Result is not a validation error');
    }
  });
});
