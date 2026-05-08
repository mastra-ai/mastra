import { expectTypeOf, describe, it } from 'vitest';
import { createTool, Tool } from '@mastra/core/tools';
import type { ToolExecutionContext, ToolAction } from '@mastra/core/tools';
import { z as zv3 } from 'zod-v3';
import { z as zv4 } from 'zod-v4';

describe('createTool', () => {
  describe('basic tool creation', () => {
    it('should create a tool with id and description only', () => {
      const tool = createTool({
        id: 'simple-tool',
        description: 'A simple tool',
        execute: async () => ({ result: 'done' }),
      });

      expectTypeOf(tool).toExtend<Tool<unknown, unknown, unknown, unknown, any, 'simple-tool'>>();
      expectTypeOf(tool.id).toEqualTypeOf<'simple-tool'>();
      expectTypeOf(tool.description).toBeString();
    });

    it('should infer id type from literal', () => {
      const tool = createTool({
        id: 'my-specific-id',
        description: 'Test',
        execute: async () => ({}),
      });

      expectTypeOf(tool.id).toEqualTypeOf<'my-specific-id'>();
    });
  });

  describe('inputSchema typing (zod v3)', () => {
    it('should infer input type from inputSchema', () => {
      const inputSchema = zv3.object({
        name: zv3.string(),
        age: zv3.number(),
      });

      const tool = createTool({
        id: 'user-tool',
        description: 'Process user data',
        inputSchema,
        execute: async inputData => {
          expectTypeOf(inputData).toEqualTypeOf<{ name: string; age: number }>();
          return { processed: true };
        },
      });

      expectTypeOf(tool.inputSchema).toExtend<typeof inputSchema>();
    });

    it('should type execute inputData parameter correctly', () => {
      const tool = createTool({
        id: 'typed-input-tool',
        description: 'Tool with typed input',
        inputSchema: zv3.object({
          query: zv3.string(),
          limit: zv3.number().optional(),
        }),
        execute: async inputData => {
          expectTypeOf(inputData.query).toBeString();
          expectTypeOf(inputData.limit).toEqualTypeOf<number | undefined>();
          return { results: [] };
        },
      });
    });

    it('should handle complex nested schemas', () => {
      const complexSchema = zv3.object({
        user: zv3.object({
          id: zv3.string(),
          profile: zv3.object({
            name: zv3.string(),
            email: zv3.string().email(),
          }),
        }),
        options: zv3.array(zv3.enum(['a', 'b', 'c'])),
      });

      const tool = createTool({
        id: 'complex-tool',
        description: 'Complex input tool',
        inputSchema: complexSchema,
        execute: async inputData => {
          expectTypeOf(inputData.user.id).toBeString();
          expectTypeOf(inputData.user.profile.name).toBeString();
          expectTypeOf(inputData.options).toEqualTypeOf<('a' | 'b' | 'c')[]>();
          return {};
        },
      });
    });
  });

  describe('inputSchema typing (zod v4)', () => {
    it('should infer input type from zod v4 schema', () => {
      const inputSchema = zv4.object({
        query: zv4.string(),
        count: zv4.number(),
      });

      const tool = createTool({
        id: 'v4-input-tool',
        description: 'Tool with zod v4 input',
        inputSchema,
        execute: async inputData => {
          expectTypeOf(inputData).toEqualTypeOf<{ query: string; count: number }>();
          return { success: true };
        },
      });
    });
  });

  describe('outputSchema typing', () => {
    it('should infer output type from outputSchema (zod v3)', () => {
      const outputSchema = zv3.object({
        success: zv3.boolean(),
        data: zv3.string(),
      });

      const tool = createTool({
        id: 'output-tool',
        description: 'Tool with typed output',
        outputSchema,
        execute: async () => {
          return { success: true, data: 'result' };
        },
      });

      expectTypeOf(tool.outputSchema).toExtend<typeof outputSchema>();
    });

    it('should infer output type from outputSchema (zod v4)', () => {
      const outputSchema = zv4.object({
        items: zv4.array(zv4.string()),
        total: zv4.number(),
      });

      const tool = createTool({
        id: 'v4-output-tool',
        description: 'Tool with zod v4 output',
        outputSchema,
        execute: async () => {
          return { items: ['a', 'b'], total: 2 };
        },
      });
    });
  });

  describe('suspend and resume schemas', () => {
    it('should type suspendSchema correctly', () => {
      const suspendSchema = zv3.object({
        reason: zv3.string(),
        pendingAction: zv3.enum(['approve', 'reject']),
      });

      const tool = createTool({
        id: 'suspendable-tool',
        description: 'Tool that can suspend',
        suspendSchema,
        execute: async (_, context) => {
          // suspend should accept the typed payload
          if (context.agent?.suspend) {
            await context.agent.suspend({
              reason: 'Waiting for approval',
              pendingAction: 'approve',
            });
          }
          return {};
        },
      });

      expectTypeOf(tool.suspendSchema).toExtend<typeof suspendSchema>();
    });

    it('should type resumeSchema correctly', () => {
      const resumeSchema = zv3.object({
        approved: zv3.boolean(),
        comment: zv3.string().optional(),
      });

      const tool = createTool({
        id: 'resumable-tool',
        description: 'Tool that can resume',
        resumeSchema,
        execute: async (_, context) => {
          const resumeData = context.agent?.resumeData;
          if (resumeData) {
            expectTypeOf(resumeData.approved).toBeBoolean();
            expectTypeOf(resumeData.comment).toEqualTypeOf<string | undefined>();
          }
          return {};
        },
      });

      expectTypeOf(tool.resumeSchema).toExtend<typeof resumeSchema>();
    });
  });

  describe('execution context typing', () => {
    it('should provide typed execution context', () => {
      const tool = createTool({
        id: 'context-tool',
        description: 'Tool with context',
        execute: async (_, context) => {
          expectTypeOf(context).toExtend<ToolExecutionContext>();
          expectTypeOf(context.mastra).not.toBeAny();
          expectTypeOf(context.requestContext).not.toBeAny();
          return {};
        },
      });
    });

    it('should type agent context properties', () => {
      const tool = createTool({
        id: 'agent-context-tool',
        description: 'Tool used by agent',
        execute: async (_, context) => {
          if (context.agent) {
            expectTypeOf(context.agent.toolCallId).toBeString();
            expectTypeOf(context.agent.messages).toBeArray();
            expectTypeOf(context.agent.suspend).toBeFunction();
            expectTypeOf(context.agent.threadId).toEqualTypeOf<string | undefined>();
            expectTypeOf(context.agent.resourceId).toEqualTypeOf<string | undefined>();
          }
          return {};
        },
      });
    });

    it('should type workflow context properties', () => {
      const tool = createTool({
        id: 'workflow-context-tool',
        description: 'Tool used in workflow',
        execute: async (_, context) => {
          if (context.workflow) {
            expectTypeOf(context.workflow.runId).toBeString();
            expectTypeOf(context.workflow.workflowId).toBeString();
            expectTypeOf(context.workflow.state).toBeAny();
            expectTypeOf(context.workflow.setState).toBeFunction();
            expectTypeOf(context.workflow.suspend).toBeFunction();
          }
          return {};
        },
      });
    });

    it('should type MCP context properties', () => {
      const tool = createTool({
        id: 'mcp-context-tool',
        description: 'Tool used via MCP',
        execute: async (_, context) => {
          if (context.mcp) {
            expectTypeOf(context.mcp.extra).not.toBeAny();
            expectTypeOf(context.mcp.elicitation).not.toBeAny();
            expectTypeOf(context.mcp.elicitation.sendRequest).toBeFunction();
          }
          return {};
        },
      });
    });
  });

  describe('requireApproval and providerOptions', () => {
    it('should accept requireApproval option', () => {
      const tool = createTool({
        id: 'approval-tool',
        description: 'Tool requiring approval',
        requireApproval: true,
        execute: async () => ({ done: true }),
      });

      expectTypeOf(tool.requireApproval).toEqualTypeOf<boolean | undefined>();
    });

    it('should accept providerOptions', () => {
      const tool = createTool({
        id: 'provider-options-tool',
        description: 'Tool with provider options',
        providerOptions: {
          anthropic: {
            cacheControl: { type: 'ephemeral' },
          },
          openai: {
            strict: true,
          },
        },
        execute: async () => ({}),
      });

      expectTypeOf(tool.providerOptions).toExtend<Record<string, Record<string, unknown>> | undefined>();
    });
  });

  describe('MCP properties', () => {
    it('should accept mcp annotations', () => {
      const tool = createTool({
        id: 'mcp-annotated-tool',
        description: 'Tool with MCP annotations',
        mcp: {
          annotations: {
            title: 'My Tool',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: {
            version: '1.0.0',
          },
        },
        execute: async () => ({}),
      });

      expectTypeOf(tool.mcp).not.toBeUndefined();
    });
  });

  describe('Tool class direct instantiation', () => {
    it('should create Tool instance with new keyword', () => {
      const tool = new Tool({
        id: 'direct-tool',
        description: 'Directly instantiated tool',
        inputSchema: zv3.object({ value: zv3.number() }),
        execute: async inputData => {
          return { doubled: inputData.value * 2 };
        },
      });

      expectTypeOf(tool).toBeObject();
      expectTypeOf(tool.id).toEqualTypeOf<'direct-tool'>();
    });
  });

  describe('complete tool with all schemas', () => {
    it('should correctly type a fully specified tool', () => {
      const inputSchema = zv3.object({
        action: zv3.enum(['create', 'update', 'delete']),
        itemId: zv3.string(),
      });

      const outputSchema = zv3.object({
        success: zv3.boolean(),
        message: zv3.string(),
      });

      const suspendSchema = zv3.object({
        confirmationRequired: zv3.boolean(),
        actionDescription: zv3.string(),
      });

      const resumeSchema = zv3.object({
        confirmed: zv3.boolean(),
      });

      const tool = createTool({
        id: 'full-featured-tool',
        description: 'A fully featured tool',
        inputSchema,
        outputSchema,
        suspendSchema,
        resumeSchema,
        requireApproval: true,
        execute: async (inputData, context) => {
          expectTypeOf(inputData.action).toEqualTypeOf<'create' | 'update' | 'delete'>();
          expectTypeOf(inputData.itemId).toBeString();

          if (context.agent?.resumeData) {
            expectTypeOf(context.agent.resumeData.confirmed).toBeBoolean();
          }

          return { success: true, message: 'Done' };
        },
      });

      expectTypeOf(tool.inputSchema).toExtend<typeof inputSchema>();
      expectTypeOf(tool.outputSchema).toExtend<typeof outputSchema>();
      expectTypeOf(tool.suspendSchema).toExtend<typeof suspendSchema>();
      expectTypeOf(tool.resumeSchema).toExtend<typeof resumeSchema>();
    });
  });
});
