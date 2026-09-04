import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import { createWorkflow } from '../create';
import { createStep } from '../workflow';

describe('Workflow requestContextSchema', () => {
  const requestContextSchema = z.object({
    userId: z.string(),
    tenantId: z.string(),
  });

  describe('workflow-level validation', () => {
    it('should validate input-form values forwarded by a transformed tool context', async () => {
      const dateCodec = z.codec(z.string(), z.date(), {
        decode: value => new Date(value),
        encode: value => value.toISOString(),
      });
      const transformedSchema = z.object({ date: dateCodec });
      let capturedDate: unknown;
      const step = createStep({
        id: 'nested-context-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ dateIsDate: z.boolean() }),
        requestContextSchema: transformedSchema,
        execute: async ({ requestContext }) => {
          capturedDate = requestContext.get('date');
          return { dateIsDate: capturedDate instanceof Date };
        },
      });
      const workflow = createWorkflow({
        id: 'nested-context-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ dateIsDate: z.boolean() }),
        requestContextSchema: transformedSchema,
      }).then(step);
      workflow.commit();
      const outerTool = createTool({
        id: 'workflow-forwarding-tool',
        description: 'Forwards context to a workflow',
        requestContextSchema: transformedSchema,
        execute: async (_, { requestContext }) => {
          const run = await workflow.createRun();
          return run.start({ inputData: { input: 'test' }, requestContext });
        },
      });
      const requestContext = new RequestContext();
      requestContext.set('date', '2026-08-17T00:00:00.000Z');

      const result = await outerTool.execute!({}, { requestContext });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({ dateIsDate: true });
      }
      expect(capturedDate).toBeInstanceOf(Date);
      expect(requestContext.getRaw('date')).toBe('2026-08-17T00:00:00.000Z');
    });

    it('should pass validation when requestContext matches schema', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof requestContextSchema>>();
      requestContext.set('userId', 'user-123');
      requestContext.set('tenantId', 'tenant-456');

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.result).toEqual({ output: 'processed: test' });
      }
    });

    it('should throw validation error when requestContext is missing required fields', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof requestContextSchema>>();
      requestContext.set('userId', 'user-123');
      // Missing tenantId

      const run = await workflow.createRun();

      await expect(
        run.start({
          inputData: { input: 'test' },
          requestContext,
        }),
      ).rejects.toThrow(/Request context validation failed/);
    });

    it('should throw validation error when requestContext has invalid field types', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof requestContextSchema>>();
      //@ts-expect-error - intentionally testing validation with wrong type
      requestContext.set('userId', 123);
      requestContext.set('tenantId', 'tenant-456');

      const run = await workflow.createRun();

      await expect(
        run.start({
          inputData: { input: 'test' },
          requestContext,
        }),
      ).rejects.toThrow(/Request context validation failed/);
    });

    it('should include workflow ID in error message', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'my-special-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof requestContextSchema>>();
      // Empty context

      const run = await workflow.createRun();

      await expect(
        run.start({
          inputData: { input: 'test' },
          requestContext,
        }),
      ).rejects.toThrow(/my-special-workflow/);
    });
  });

  describe('step-level validation', () => {
    it('should pass validation when step requestContext matches schema', async () => {
      const stepContextSchema = z.object({
        apiKey: z.string(),
      });

      let capturedContext: any;
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
        execute: async ({ inputData, requestContext }) => {
          capturedContext = requestContext;
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof stepContextSchema>>();
      requestContext.set('apiKey', 'key-123');

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('success');
      expect(capturedContext.get('apiKey')).toBe('key-123');
    });

    it('should fail when step requestContext validation fails', async () => {
      const stepContextSchema = z.object({
        apiKey: z.string(),
      });

      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext();
      // Missing apiKey

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('failed');
      if (result.status === 'failed') {
        expect(result.error?.message).toContain('request context validation failed');
      }
    });
  });

  describe('backwards compatibility', () => {
    it('should work without requestContextSchema on workflow', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext();
      requestContext.set('anything', 'value');

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('success');
    });

    it('should work without requestContextSchema on step', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext();
      requestContext.set('anything', 'value');

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('success');
    });

    it('should work without requestContext parameter', async () => {
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
      }).then(step);

      workflow.commit();

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
      });

      expect(result.status).toBe('success');
    });
  });

  describe('combined workflow and step validation', () => {
    it('should validate both workflow and step requestContextSchema', async () => {
      const workflowContextSchema = z.object({
        userId: z.string(),
        apiKey: z.string(),
      });

      let stepExecuted = false;
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: workflowContextSchema,
        execute: async ({ inputData }) => {
          stepExecuted = true;
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: workflowContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof workflowContextSchema>>();
      requestContext.set('userId', 'user-123');
      requestContext.set('apiKey', 'key-456');

      const run = await workflow.createRun();
      const result = await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(result.status).toBe('success');
      expect(stepExecuted).toBe(true);
    });

    it('should fail on workflow validation before step validation', async () => {
      const workflowContextSchema = z.object({
        userId: z.string(),
        apiKey: z.string(),
      });

      const stepContextSchema = z.object({
        apiKey: z.string(),
      });

      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
        execute: async ({ inputData }) => {
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: workflowContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof workflowContextSchema>>();
      // Missing both userId and apiKey

      const run = await workflow.createRun();

      // Should fail on workflow-level validation first
      await expect(
        run.start({
          inputData: { input: 'test' },
          requestContext,
        }),
      ).rejects.toThrow(/Request context validation failed for workflow/);
    });
  });

  describe('typed requestContext access', () => {
    it('should provide typed requestContext.all in step execute', async () => {
      const stepContextSchema = z.object({
        tenantId: z.string(),
        permissions: z.array(z.string()),
      });

      let capturedAll: any;
      const step = createStep({
        id: 'test-step',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
        execute: async ({ inputData, requestContext }) => {
          capturedAll = requestContext.all;
          return { output: `processed: ${inputData.input}` };
        },
      });

      const workflow = createWorkflow({
        id: 'test-workflow',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ output: z.string() }),
        requestContextSchema: stepContextSchema,
      }).then(step);

      workflow.commit();

      const requestContext = new RequestContext<z.infer<typeof stepContextSchema>>();
      requestContext.set('tenantId', 'tenant-abc');
      requestContext.set('permissions', ['read', 'write']);

      const run = await workflow.createRun();
      await run.start({
        inputData: { input: 'test' },
        requestContext,
      });

      expect(capturedAll.tenantId).toBe('tenant-abc');
      expect(capturedAll.permissions).toEqual(['read', 'write']);
    });
  });
});
