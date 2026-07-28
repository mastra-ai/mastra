import { jsonSchema as vercelJsonSchema } from '@mastra/schema-compat';
import { describe, expect, it, vi } from 'vitest';
import { z as z3 } from 'zod/v3';
import { z as z4 } from 'zod/v4';
import { RequestContext } from '../../request-context';
import { isStandardSchemaWithJSON, standardSchemaToJSONSchema } from '../../schema';
import { createTool } from '../../tools';
import { CoreToolBuilder } from './builder';

// Regression coverage for the bug where `backgroundTaskEnabled: true` would
// mutate a Zod v3 user input schema by `.extend()`ing it with a Zod v4
// optional, then crash downstream in `ZodObject._parse` with
// `keyValidator._parse is not a function`. The fix normalizes the user's
// schema into a JSON Schema, splices in the override fields, and re-wraps
// — so all supported input-schema kinds (Zod v3, Zod v4, JSON Schema)
// flow through the same code path.

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

describe('CoreToolBuilder background override injection', () => {
  describe('Zod v3 input schema', () => {
    it('does not crash when backgroundTaskEnabled is true (regression for keyValidator._parse)', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true });
      const tool = createTool({
        id: 'v3-tool',
        description: 'Zod v3 tool',
        inputSchema: z3.object({ query: z3.string() }),
        execute,
      });

      // Constructing the builder is where the schema is mutated. With the
      // pre-fix code, this would silently produce a broken schema and the
      // crash would surface during execute(). We assert both happen cleanly.
      const builder = new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const built = builder.build();
      await expect(built.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] })).resolves.toEqual({
        ok: true,
      });
      expect(execute).toHaveBeenCalledWith(
        { query: 'docs' },
        expect.objectContaining({ requestContext: expect.any(RequestContext) }),
      );
    });

    it('injects _background into the resulting JSON Schema properties', () => {
      const tool = createTool({
        id: 'v3-tool',
        description: 'Zod v3 tool',
        inputSchema: z3.object({ query: z3.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties).toHaveProperty('_background');
      expect(properties._background.properties.disposition.enum).toEqual(['foreground', 'deferred', 'awaited']);
    });

    // The JSON Schema fallback used to replace the original Zod v3 schema with
    // an Ajv-only wrapper, silently dropping `.transform()` / `.default()` /
    // `.refine()` parsing before `execute()` saw the args. Lock that behavior
    // in: the inner execute() must still receive the *parsed* value.
    // https://github.com/mastra-ai/mastra/pull/16915#discussion_r3282520408
    it('preserves Zod v3 transforms and defaults through to execute()', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true });
      const tool = createTool({
        id: 'v3-transform-tool',
        description: 'Zod v3 tool with transform + default',
        inputSchema: z3.object({
          query: z3.string().transform(s => s.toUpperCase()),
          mode: z3.string().default('fast'),
        }) as any,
        execute,
      });

      const builder = new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const built = builder.build();
      await built.execute!({ query: 'docs', _background: { enabled: true } } as any, {
        toolCallId: 'call-1',
        messages: [],
      });

      // Transform ran ("docs" -> "DOCS"), default filled ("mode" -> "fast"),
      // and the injected `_background` key was preserved on the parsed value.
      expect(execute).toHaveBeenCalledTimes(1);
      const [parsed] = execute.mock.calls[0]!;
      expect(parsed).toMatchObject({ query: 'DOCS', mode: 'fast', _background: { enabled: true } });
    });

    // The JSON-fallback validate wrapper used to strip injected fields, run the
    // original validator on the rest, then merge injected back untouched —
    // letting malformed `_background` payloads (e.g. `enabled: "yes"`) reach
    // `execute()`. Lock in that the injected subset is now validated against
    // the override JSON Schema, matching the Zod v4 `.extend()` path.
    // https://github.com/mastra-ai/mastra/pull/16915#discussion_r3282600679
    it('rejects malformed _background payload on the JSON fallback path', async () => {
      const execute = vi.fn();
      const tool = createTool({
        id: 'v3-bad-bg-tool',
        description: 'Zod v3 tool with malformed _background guard',
        inputSchema: z3.object({ query: z3.string() }),
        execute,
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const schema = tool.inputSchema as any;
      const result = schema['~standard'].validate({ query: 'ok', _background: { enabled: 'yes' } });
      const resolved = result && typeof result.then === 'function' ? await result : result;
      expect(resolved).toHaveProperty('issues');
      expect((resolved as { issues: readonly unknown[] }).issues.length).toBeGreaterThan(0);
    });
  });

  describe('Zod v4 input schema', () => {
    it('still injects _background and accepts valid input', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true });
      const tool = createTool({
        id: 'v4-tool',
        description: 'Zod v4 tool',
        inputSchema: z4.object({ query: z4.string() }),
        execute,
      });

      const builder = new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const built = builder.build();
      await expect(built.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] })).resolves.toEqual({
        ok: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties).toHaveProperty('_background');
      expect(properties._background.properties.disposition.enum).toEqual(['foreground', 'deferred', 'awaited']);
    });
  });

  describe('Raw JSON Schema (Vercel jsonSchema wrapper) input', () => {
    it('injects _background without crashing on a non-Zod schema', async () => {
      const execute = vi.fn().mockResolvedValue({ ok: true });
      const tool = createTool({
        id: 'json-tool',
        description: 'JSON Schema tool',
        inputSchema: vercelJsonSchema({
          type: 'object',
          properties: { query: { type: 'string' } },
          required: ['query'],
        }) as any,
        execute,
      });

      const builder = new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const built = builder.build();
      await expect(built.execute!({ query: 'docs' }, { toolCallId: 'call-1', messages: [] })).resolves.toEqual({
        ok: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('query');
      expect(properties).toHaveProperty('_background');
      expect(properties._background.properties.disposition.enum).toEqual(['foreground', 'deferred', 'awaited']);
    });
  });

  describe('Resumable tools (agent-/workflow- prefixed ids)', () => {
    it('injects suspendedToolRunId and resumeData for agent- tools', () => {
      const tool = createTool({
        id: 'agent-foo',
        description: 'Agent-as-tool',
        inputSchema: z3.object({ message: z3.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('message');
      expect(properties).toHaveProperty('suspendedToolRunId');
      expect(properties).toHaveProperty('resumeData');

      // The injected JSON Schema must match the pre-PR shape so existing
      // provider-compat layers and LLM-recording hashes stay stable.
      expect(properties.suspendedToolRunId).toEqual({
        type: ['string', 'null'],
        description: 'The runId of the suspended tool',
      });
      expect(properties.resumeData).toEqual({
        description: 'The resumeData object created from the resumeSchema of suspended tool',
      });
    });

    it('injects resume fields for workflow- tools as well', () => {
      const tool = createTool({
        id: 'workflow-bar',
        description: 'Workflow-as-tool',
        inputSchema: z4.object({ message: z4.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('suspendedToolRunId');
      expect(properties).toHaveProperty('resumeData');
    });

    // Both gates can fire at once: a resumable id AND backgroundTaskEnabled.
    // Ensure all three injected fields end up in the same schema.
    // https://github.com/mastra-ai/mastra/pull/16915#pullrequestreview
    it('merges _background and resume fields when both gates apply', () => {
      const tool = createTool({
        id: 'agent-combo',
        description: 'Agent-as-tool with background tasks',
        inputSchema: z4.object({ message: z4.string() }),
        execute: vi.fn(),
      });

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
        backgroundTaskEnabled: true,
      });

      const properties = extractJsonProperties(tool);
      expect(properties).toHaveProperty('message');
      expect(properties).toHaveProperty('_background');
      expect(properties).toHaveProperty('suspendedToolRunId');
      expect(properties).toHaveProperty('resumeData');
    });
  });

  describe('Schema is left untouched when neither flag applies', () => {
    it('does not inject override fields when backgroundTaskEnabled is false and id is not resumable', () => {
      const tool = createTool({
        id: 'plain-tool',
        description: 'A plain tool',
        inputSchema: z3.object({ query: z3.string() }),
        execute: vi.fn(),
      });
      const originalSchema = tool.inputSchema;

      new CoreToolBuilder({
        originalTool: tool,
        options: baseOptions(),
      });

      // No injection => the builder should not have replaced inputSchema.
      expect(tool.inputSchema).toBe(originalSchema);
    });
  });
});
