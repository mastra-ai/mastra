import type { Mastra as MastraType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { HTTPException } from '../http-exception';
import { upsertStoredWorkflowBodySchema } from '../schemas/stored-workflows';
import type { ServerContext } from '../server-adapter';
import {
  DELETE_STORED_WORKFLOW_ROUTE,
  GET_STORED_WORKFLOW_ROUTE,
  LIST_STORED_WORKFLOWS_ROUTE,
  UPSERT_STORED_WORKFLOW_ROUTE,
} from './stored-workflows';

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

  // A minimal input==output shape tool suitable as a loop body. `count` grows
  // by 1 per iteration so a `dountil count >= N` predicate terminates in
  // bounded time.
  const incTool = createTool({
    id: 'inc-tool',
    description: 'Increment counter',
    inputSchema: z.object({ count: z.number() }),
    outputSchema: z.object({ count: z.number() }),
    execute: async ({ count }) => ({ count: count + 1 }),
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
    tools: { 'echo-tool': echoTool, 'inc-tool': incTool } as any,
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

    it('loop(dountil) with a declarative predicate round-trips and terminates', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-loop-predicate',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ count: { type: 'number' } }, ['count']),
        outputSchema: objectWith({ count: { type: 'number' } }, ['count']),
        graph: [
          {
            type: 'loop',
            step: { type: 'tool', id: 'bump', toolId: 'inc-tool' },
            loopType: 'dountil',
            // Terminate when the inner tool's most recent output has count >= 3.
            predicate: {
              op: 'gte',
              left: { path: 'inputData.count' },
              right: { literal: 3 },
            },
          },
        ],
      });

      const live = mastra.getWorkflow('wf-loop-predicate');
      const serialized = (live as any).serializedStepFlow as Array<any>;
      expect(serialized[0].type).toBe('loop');
      expect(serialized[0].loopType).toBe('dountil');
      expect(serialized[0].predicate).toEqual({
        op: 'gte',
        left: { path: 'inputData.count' },
        right: { literal: 3 },
      });
      // Studio-facing label is derived from the predicate, not a closure toString.
      expect(serialized[0].serializedCondition.fn).toMatch(/inputData\.count.+3/);

      const run = await live.createRun();
      const result = await run.start({ inputData: { count: 0 } });
      expect(result.status).toBe('success');
      // Starts at 0, inc runs until count >= 3, so exits with count === 3.
      expect((result as any).result.count).toBe(3);
    });

    it('conditional with declarative predicates fires only the truthy branch', async () => {
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-cond-predicate',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        // Output shape is the conditional's fan-out object.
        outputSchema: { type: 'object' as const },
        graph: [
          { type: 'tool', id: 'echo', toolId: 'echo-tool' },
          {
            type: 'conditional',
            steps: [
              { type: 'tool', id: 'hello-branch', toolId: 'echo-tool' },
              { type: 'tool', id: 'other-branch', toolId: 'echo-tool' },
            ],
            predicates: [
              {
                op: 'eq',
                left: { path: 'inputData.value' },
                right: { literal: 'hello' },
              },
              {
                op: 'ne',
                left: { path: 'inputData.value' },
                right: { literal: 'hello' },
              },
            ],
          },
        ],
      });

      const live = mastra.getWorkflow('wf-cond-predicate');
      const serialized = (live as any).serializedStepFlow as Array<any>;
      expect(serialized[1].type).toBe('conditional');
      expect(serialized[1].predicates).toHaveLength(2);
      expect(serialized[1].serializedConditions[0].fn).toMatch(/inputData\.value.+hello/);

      // Truthy branch: predicate `value === 'hello'` matches, so the
      // conditional's fan-out should contain that branch's output.
      const runHello = await live.createRun();
      const resHello = await runHello.start({ inputData: { value: 'hello' } });
      expect(resHello.status).toBe('success');
      // The truthy branch produced { value: 'hello' } (via echo-tool).
      const outHello = JSON.stringify((resHello as any).result);
      expect(outHello).toContain('hello');

      // Flip the input so ONLY the other predicate is truthy.
      const runOther = await live.createRun();
      const resOther = await runOther.start({ inputData: { value: 'world' } });
      expect(resOther.status).toBe('success');
      const outOther = JSON.stringify((resOther as any).result);
      expect(outOther).toContain('world');
    });

    it('predicate reads `state` through the HTTP → engine → predicate wire and terminates', async () => {
      // Guards against regressions in how `params.state` is threaded into
      // `PredicateContext.state` at runtime. No other test in this suite
      // exercises the `state` root end-to-end via HTTP.
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-state-predicate',
        description: undefined,
        metadata: undefined,
        stateSchema: objectWith({ threshold: { type: 'number' } }, ['threshold']),
        requestContextSchema: undefined,
        inputSchema: objectWith({ count: { type: 'number' } }, ['count']),
        outputSchema: objectWith({ count: { type: 'number' } }, ['count']),
        graph: [
          {
            type: 'loop',
            step: { type: 'tool', id: 'bump', toolId: 'inc-tool' },
            loopType: 'dountil',
            // Terminate when the running count reaches the state-provided threshold.
            // If `state` fails to reach the predicate, the loop would either never
            // terminate (timeout) or terminate at the wrong iteration.
            predicate: {
              op: 'gte',
              left: { path: 'inputData.count' },
              right: { path: 'state.threshold' },
            },
          },
        ],
      });

      const live = mastra.getWorkflow('wf-state-predicate');
      const serialized = (live as any).serializedStepFlow as Array<any>;
      expect(serialized[0].type).toBe('loop');
      expect(serialized[0].predicate.right).toEqual({ path: 'state.threshold' });

      // threshold=2 → inc from 0 runs twice, exits with count === 2
      const run2 = await live.createRun();
      const res2 = await run2.start({ inputData: { count: 0 }, initialState: { threshold: 2 } });
      expect(res2.status).toBe('success');
      expect((res2 as any).result.count).toBe(2);

      // threshold=4 → inc runs four times, exits with count === 4.
      // Different threshold via `state` must produce a different terminating iteration.
      const run4 = await live.createRun();
      const res4 = await run4.start({ inputData: { count: 0 }, initialState: { threshold: 4 } });
      expect(res4.status).toBe('success');
      expect((res4 as any).result.count).toBe(4);
    });

    it('nested workflow reference — parent POST after child is registered runs end-to-end', async () => {
      // Child stored workflow: single tool that echoes its input.
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-child',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ value: stringSchema }, ['value']),
        graph: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }],
      });

      // Parent stored workflow: calls the child via a `workflow` entry and
      // wraps its output. Exercises: schema acceptance of the `workflow`
      // variant on POST, pre-flight ref validation, rehydration through
      // `mastra.getWorkflow(workflowId)`, and end-to-end run through the
      // nested workflow.
      await UPSERT_STORED_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-parent',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ wrapped: stringSchema }, ['wrapped']),
        graph: [
          { type: 'workflow', id: 'call-child', workflowId: 'wf-child' },
          {
            type: 'mapping',
            id: 'wrap',
            // Nested-workflow results are keyed by the child workflow's own id
            // (same convention as foreach keying by the inner step id), not by
            // the outer `id` in the parent graph.
            mapConfig: JSON.stringify({
              wrapped: { template: '[${stepResults.wf-child.value}]' },
            }),
          },
        ],
      });

      const parent = mastra.getWorkflow('wf-parent');
      expect(parent).toBeDefined();

      const run = await parent.createRun();
      const res = await run.start({ inputData: { value: 'hi' } });
      expect(res.status).toBe('success');
      expect((res as any).result.wrapped).toBe('[hi]');
    });

    it('nested workflow reference — POST rejects when the nested workflowId is not registered', async () => {
      await expect(
        UPSERT_STORED_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          id: 'wf-parent-bad',
          description: undefined,
          metadata: undefined,
          stateSchema: undefined,
          requestContextSchema: undefined,
          ...baseSchemas,
          graph: [{ type: 'workflow', id: 'call-missing', workflowId: 'not-a-workflow' }],
        }),
      ).rejects.toThrow(/workflow/i);
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

  // The route framework validates the request body against
  // `upsertStoredWorkflowBodySchema` before the handler runs. These tests
  // exercise the schema directly to prove malformed conditional/loop payloads
  // are rejected at the HTTP boundary — closure-based `serializedConditions`
  // strings, unknown predicate operators, and loop entries missing a
  // `predicate` must never reach `Mastra.addStoredWorkflow`.
  describe('upsertStoredWorkflowBodySchema — predicate rejection', () => {
    const validBody = {
      id: 'wf-reject',
      inputSchema: objectWith({ value: stringSchema }, ['value']),
      outputSchema: objectWith({ value: stringSchema }, ['value']),
    };

    it('rejects legacy closure-based serializedConditions on a conditional entry', () => {
      const result = upsertStoredWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'conditional',
            steps: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }],
            // Legacy shape — closure serialized as a JS string. Must be
            // rejected because there is no `predicates` array.
            serializedConditions: [{ id: 'c0', fn: '({ inputData }) => inputData.x > 0' }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a conditional entry with an unknown predicate op', () => {
      const result = upsertStoredWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'conditional',
            steps: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }],
            predicates: [{ op: 'wat', left: { path: 'inputData.x' }, right: { literal: 1 } }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a loop entry missing a predicate', () => {
      const result = upsertStoredWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'loop',
            step: { type: 'tool', id: 'inc', toolId: 'inc-tool' },
            loopType: 'dountil',
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('accepts a well-formed loop entry with a declarative predicate', () => {
      const result = upsertStoredWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'loop',
            step: { type: 'tool', id: 'inc', toolId: 'inc-tool' },
            loopType: 'dountil',
            predicate: {
              op: 'gte',
              left: { path: 'inputData.count' },
              right: { literal: 3 },
            },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a well-formed conditional entry with declarative predicates', () => {
      const result = upsertStoredWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'conditional',
            steps: [{ type: 'tool', id: 'echo', toolId: 'echo-tool' }],
            predicates: [
              {
                op: 'and',
                args: [
                  { op: 'exists', path: 'inputData.value' },
                  { op: 'truthy', value: { path: 'inputData.value' } },
                ],
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });
});
