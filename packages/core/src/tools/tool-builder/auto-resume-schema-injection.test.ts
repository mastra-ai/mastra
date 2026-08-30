import { describe, expect, it, vi } from 'vitest';
import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';

// Regression coverage for https://github.com/mastra-ai/mastra/issues/20603.
//
// With `autoResumeSuspendedTools: true` the builder used to inject a
// `resumeData` property with no JSON Schema `type` (`z.any()` on the Zod path,
// a bare `{ description }` on the JSON Schema path) into *every* tool. Providers
// that enforce strict tool schemas — OpenAI in particular — reject that with
// "schema must have a 'type' key", which failed the whole request.

function baseOptions() {
  return {
    name: 'test-tool',
    logger: {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trackException: vi.fn(),
    } as any,
    requestContext: new RequestContext(),
  };
}

function extractJsonProperties(tool: { inputSchema?: unknown }) {
  const schema = tool.inputSchema;
  expect(schema).toBeDefined();
  expect(isStandardSchemaWithJSON(schema)).toBe(true);
  const json = standardSchemaToJSONSchema(schema as any, { io: 'input' });
  expect(json && typeof json === 'object' && (json as any).type === 'object').toBe(true);
  return (json as any).properties as Record<string, any>;
}

/**
 * Every property a provider sees must describe its type somehow. This is the
 * exact condition OpenAI's strict schema validation enforces.
 */
function expectEveryPropertyIsTyped(properties: Record<string, any>) {
  for (const [name, property] of Object.entries(properties)) {
    const isTyped =
      property &&
      typeof property === 'object' &&
      ('type' in property || 'anyOf' in property || 'oneOf' in property || 'allOf' in property || '$ref' in property);
    expect(isTyped, `property "${name}" has no type: ${JSON.stringify(property)}`).toBe(true);
  }
}

describe('CoreToolBuilder auto-resume schema injection', () => {
  describe('resumeData is always typed', () => {
    it('types resumeData from a Zod v4 tool resumeSchema', () => {
      const tool = createTool({
        id: 'v4-suspending-tool',
        description: 'Zod v4 tool that can suspend',
        inputSchema: z4.object({ query: z4.string() }),
        suspendSchema: z4.object({ question: z4.string() }),
        resumeSchema: z4.object({ approved: z4.boolean() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties.resumeData.type).toBe('object');
      expect(properties.resumeData.properties).toHaveProperty('approved');
      expectEveryPropertyIsTyped(properties);
    });

    it('types resumeData for a Zod v3 tool (JSON Schema splice path)', () => {
      const tool = createTool({
        id: 'v3-suspending-tool',
        description: 'Zod v3 tool that can suspend',
        inputSchema: z3.object({ query: z3.string() }) as any,
        suspendSchema: z3.object({ question: z3.string() }) as any,
        resumeSchema: z3.object({ approved: z3.boolean() }) as any,
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties.resumeData.type).toBe('object');
      expect(properties.resumeData.properties).toHaveProperty('approved');
      expectEveryPropertyIsTyped(properties);
    });

    it('falls back to a typed open object when the tool declares no resumeSchema', () => {
      const tool = createTool({
        id: 'agent-nested',
        description: 'Nested agent tool with a free-form resume payload',
        inputSchema: z4.object({ message: z4.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('resumeData');
      expect(properties.resumeData.type).toBe('object');
      expectEveryPropertyIsTyped(properties);
    });

    it('keeps suspendedToolRunId typed alongside resumeData', () => {
      const tool = createTool({
        id: 'suspending-tool',
        description: 'Tool that can suspend',
        inputSchema: z4.object({ query: z4.string() }),
        resumeSchema: z4.object({ approved: z4.boolean() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('suspendedToolRunId');
      expectEveryPropertyIsTyped(properties);
    });
  });

  describe('injection is scoped to tools that can suspend', () => {
    it('does not inject resume fields into a tool that cannot suspend', () => {
      const tool = createTool({
        id: 'plain-tool',
        description: 'A tool with no suspend or resume schema',
        inputSchema: z4.object({ query: z4.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties).not.toHaveProperty('resumeData');
      expect(properties).not.toHaveProperty('suspendedToolRunId');
    });

    it('injects resume fields into a tool that declares only a suspendSchema', () => {
      const tool = createTool({
        id: 'suspend-only-tool',
        description: 'Tool with a suspendSchema but no resumeSchema',
        inputSchema: z4.object({ query: z4.string() }),
        suspendSchema: z4.object({ question: z4.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('resumeData');
      expect(properties).toHaveProperty('suspendedToolRunId');
      expectEveryPropertyIsTyped(properties);
    });

    it('still injects resume fields into agent-* and workflow-* tools when the flag is off', () => {
      for (const id of ['agent-nested', 'workflow-nested']) {
        const tool = createTool({
          id,
          description: 'Nested run tool',
          inputSchema: z4.object({ message: z4.string() }),
          execute: vi.fn(),
        });

        new CoreToolBuilder({
          originalTool: tool,
          options: baseOptions(),
        });

        const properties = extractJsonProperties(tool);
        expect(properties, id).toHaveProperty('resumeData');
        expect(properties, id).toHaveProperty('suspendedToolRunId');
      }
    });
  });

  describe('runtime behavior is preserved', () => {
    it('passes resumeData through to execute()', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true });
      const tool = createTool({
        id: 'suspending-tool',
        description: 'Tool that can suspend',
        inputSchema: z4.object({ query: z4.string() }),
        resumeSchema: z4.object({ approved: z4.boolean() }),
        execute,
      });

      const built = new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        autoResumeSuspendedTools: true,
      }).build();

      await built.execute!({ query: 'docs', resumeData: { approved: true } } as any, {
        toolCallId: 'call-1',
        messages: [],
      });

      expect(execute).toHaveBeenCalledTimes(1);
      expect(execute.mock.calls[0][0]).toMatchObject({ query: 'docs', resumeData: { approved: true } });
    });
  });
});
