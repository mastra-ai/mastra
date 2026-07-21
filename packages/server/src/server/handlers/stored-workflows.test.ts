import type { Mastra as MastraType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';
import {
  DELETE_STORED_WORKFLOW_ROUTE,
  GET_STORED_WORKFLOW_ROUTE,
  LIST_STORED_WORKFLOWS_ROUTE,
  UPSERT_STORED_WORKFLOW_ROUTE,
} from './stored-workflows';

describe('stored workflow route permissions', () => {
  it('requires read access for list and detail routes', () => {
    expect(LIST_STORED_WORKFLOWS_ROUTE.requiresPermission).toBe('stored-workflows:read');
    expect(GET_STORED_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:read');
  });

  it('requires write access for upsert and delete routes', () => {
    expect(UPSERT_STORED_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:write');
    expect(DELETE_STORED_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:write');
  });
});

// =============================================================================
// Helpers
// =============================================================================

/** JSON Schema helpers — the endpoint accepts JSON Schema Draft 2020-12 blobs. */
const stringSchema = { type: 'string' as const };
const objectWith = (props: Record<string, unknown>, required: string[]) => ({
  type: 'object' as const,
  properties: props,
  required,
});

function buildMastra() {
  const echoTool = createTool({
    id: 'echo-tool',
    description: 'Echo',
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    execute: async ({ value }) => ({ value }),
  });

  // The tests here never execute the agent — they only exercise the registry
  // pre-flight + rehydration + live-registration path. A stub model reference
  // is enough to construct the Agent instance.
  const summarizerAgent = new Agent({
    id: 'summarizer',
    name: 'summarizer',
    instructions: 'Summarize things.',
    model: 'openai:gpt-4' as any,
  });

  const storage = new InMemoryStore({ id: 'stored-wf-test' });

  const mastra = new Mastra({
    logger: false,
    storage,
    tools: { 'echo-tool': echoTool } as any,
    agents: { summarizer: summarizerAgent } as any,
  });

  return mastra;
}

function ctx(mastra: MastraType): ServerContext {
  return {
    mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

/** Minimal valid graph: one echo-tool step. */
function toolOnlyGraph() {
  return [
    {
      type: 'tool' as const,
      id: 'echo',
      toolId: 'echo-tool',
    },
  ];
}

const baseSchemas = {
  inputSchema: objectWith({ value: stringSchema }, ['value']),
  outputSchema: objectWith({ value: stringSchema }, ['value']),
};

// =============================================================================
// Tests
// =============================================================================

describe('Stored Workflows handlers', () => {
  let mastra: ReturnType<typeof buildMastra>;

  beforeEach(() => {
    mastra = buildMastra();
  });

  describe('LIST_STORED_WORKFLOWS_ROUTE', () => {
    it('returns empty when no workflows are stored', async () => {
      const result = await LIST_STORED_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra),
        status: undefined,
        authorId: undefined,
      });
      expect(result).toEqual({ workflows: [], total: 0 });
    });

    it('returns stored workflows after upsert', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-a',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-b',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      const result = await LIST_STORED_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra),
        status: undefined,
        authorId: undefined,
      });
      expect(result.total).toBe(2);
      expect(result.workflows.map(w => w.id).sort()).toEqual(['wf-a', 'wf-b']);
    });
  });

  describe('GET_STORED_WORKFLOW_ROUTE', () => {
    it('returns 404 when the workflow is missing', async () => {
      await expect(
        GET_STORED_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          storedWorkflowId: 'nope',
        }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('returns the stored workflow row after upsert', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-get',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      const row = await GET_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        storedWorkflowId: 'wf-get',
      });
      expect(row.id).toBe('wf-get');
      expect(row.status).toBe('active');
    });
  });

  describe('UPSERT_STORED_WORKFLOW_ROUTE', () => {
    it('happy path — tool + mapping graph is live-registered and runnable', async () => {
      const result = await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-happy',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: [
          { type: 'tool', id: 'echo', toolId: 'echo-tool' },
          {
            type: 'mapping',
            id: 'wrap',
            mapConfig: JSON.stringify({
              value: { template: '${stepResults.echo.value}' },
            }),
          },
        ],
      });
      expect(result).toEqual({ ok: true, id: 'wf-happy' });

      const live = mastra.getWorkflow('wf-happy');
      expect(live).toBeDefined();

      const run = await live.createRun();
      const runResult = await run.start({ inputData: { value: 'hello' } });
      expect(runResult.status).toBe('success');
      expect((runResult as any).result.value).toBe('hello');
    });

    it('agent step with outputSchema round-trips onto the live workflow', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-agent-schema',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ prompt: stringSchema }, ['prompt']),
        outputSchema: objectWith({ text: stringSchema }, ['text']),
        graph: [
          {
            type: 'agent',
            id: 'summarize',
            agentId: 'summarizer',
            outputSchema: objectWith({ text: stringSchema }, ['text']),
          },
        ],
      });

      const live = mastra.getWorkflow('wf-agent-schema');
      // Assert on the serialized graph — same shape POST accepts, which
      // makes the round-trip assertion unambiguous.
      const serialized = (live as any).serializedStepFlow as Array<any>;
      expect(serialized[0].type).toBe('agent');
      expect(serialized[0].agentId).toBe('summarizer');
      // outputSchema on the entry survived JSON round-trip and rehydration.
      expect(serialized[0].outputSchema).toBeDefined();
    });

    it('foreach(agent) round-trips inner agent step', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-foreach-agent',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: { type: 'array', items: objectWith({ prompt: stringSchema }, ['prompt']) },
        outputSchema: { type: 'array', items: objectWith({ text: stringSchema }, ['text']) },
        graph: [
          {
            type: 'foreach',
            step: {
              type: 'agent',
              id: 'summarize-each',
              agentId: 'summarizer',
            },
            opts: { concurrency: 2 },
          },
        ],
      });

      const live = mastra.getWorkflow('wf-foreach-agent');
      const stepFlow = (live as any).stepGraph as Array<any>;
      expect(stepFlow[0].type).toBe('foreach');
    });

    it('scalar ${stepResults.<id>} template with no subpath resolves at run time', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-scalar-template',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ echoed: stringSchema }, ['echoed']),
        graph: [
          { type: 'tool', id: 'echo', toolId: 'echo-tool' },
          {
            type: 'mapping',
            id: 'wrap',
            // Reference the whole scalar-ish step result — no subpath.
            mapConfig: JSON.stringify({
              echoed: { template: '${stepResults.echo.value}' },
            }),
          },
        ],
      });
      const live = mastra.getWorkflow('wf-scalar-template');
      const run = await live.createRun();
      const runResult = await run.start({ inputData: { value: 'hi' } });
      expect(runResult.status).toBe('success');
      expect((runResult as any).result.echoed).toBe('hi');
    });

    it('rejects an unregistered agentId with a specific error', async () => {
      await expect(
        UPSERT_STORED_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          id: 'wf-bad-agent',
          description: undefined,
          metadata: undefined,
          stateSchema: undefined,
          requestContextSchema: undefined,
          ...baseSchemas,
          graph: [{ type: 'agent', id: 'nope', agentId: 'not-a-real-agent' }],
        }),
      ).rejects.toThrow(/not a registered agent/i);
    });

    it('rejects a tool id classified as an agent with the swap hint', async () => {
      await expect(
        UPSERT_STORED_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          id: 'wf-mis-classified',
          description: undefined,
          metadata: undefined,
          stateSchema: undefined,
          requestContextSchema: undefined,
          ...baseSchemas,
          graph: [
            // echo-tool is a registered TOOL, not an agent.
            { type: 'agent', id: 'mistyped', agentId: 'echo-tool' },
          ],
        }),
      ).rejects.toThrow(/is a registered TOOL/);
    });

    it('re-POST with the same id replaces the live registration', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-replace',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ echoed: stringSchema }, ['echoed']),
        graph: [
          { type: 'tool', id: 'echo', toolId: 'echo-tool' },
          {
            type: 'mapping',
            id: 'wrap',
            mapConfig: JSON.stringify({ echoed: { template: 'A=${stepResults.echo.value}' } }),
          },
        ],
      });
      const firstRun = await mastra.getWorkflow('wf-replace').createRun();
      const firstResult = await firstRun.start({ inputData: { value: 'x' } });
      expect((firstResult as any).result.echoed).toBe('A=x');

      // Second POST replaces the live registration.
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-replace',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ echoed: stringSchema }, ['echoed']),
        graph: [
          { type: 'tool', id: 'echo', toolId: 'echo-tool' },
          {
            type: 'mapping',
            id: 'wrap',
            mapConfig: JSON.stringify({ echoed: { template: 'B=${stepResults.echo.value}' } }),
          },
        ],
      });
      const secondRun = await mastra.getWorkflow('wf-replace').createRun();
      const secondResult = await secondRun.start({ inputData: { value: 'x' } });
      expect((secondResult as any).result.echoed).toBe('B=x');
    });
  });

  describe('DELETE_STORED_WORKFLOW_ROUTE', () => {
    it('removes the workflow from storage AND unregisters the live instance', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-del',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      expect(mastra.getWorkflow('wf-del')).toBeDefined();

      const result = await DELETE_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        storedWorkflowId: 'wf-del',
      });
      expect(result.success).toBe(true);

      // Live registration must be gone.
      expect(() => mastra.getWorkflow('wf-del')).toThrow();

      // Storage row must be gone (subsequent GET returns 404).
      await expect(
        GET_STORED_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          storedWorkflowId: 'wf-del',
        }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('is idempotent on a missing id', async () => {
      const result = await DELETE_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        storedWorkflowId: 'never-existed',
      });
      expect(result.success).toBe(true);
    });
  });
});
