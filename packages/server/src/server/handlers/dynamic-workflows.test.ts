import type { Mastra as MastraType } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { upsertDynamicWorkflowBodySchema } from '../schemas/dynamic-workflows';
import type { ServerContext } from '../server-adapter';
import {
  DELETE_DYNAMIC_WORKFLOW_ROUTE,
  GET_DYNAMIC_WORKFLOW_ROUTE,
  LIST_DYNAMIC_WORKFLOWS_ROUTE,
  UPSERT_DYNAMIC_WORKFLOW_ROUTE,
} from './dynamic-workflows';

describe('dynamic workflow route permissions', () => {
  it('requires read access for list and detail routes', () => {
    expect(LIST_DYNAMIC_WORKFLOWS_ROUTE.requiresPermission).toBe('stored-workflows:read');
    expect(GET_DYNAMIC_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:read');
  });

  it('requires write access for upsert and delete routes', () => {
    expect(UPSERT_DYNAMIC_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:write');
    expect(DELETE_DYNAMIC_WORKFLOW_ROUTE.requiresPermission).toBe('stored-workflows:write');
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
    agents: { summarizerRegistration: summarizerAgent } as any,
  });

  return mastra;
}

function ctx(mastra: MastraType, options: { authorId?: string | null; admin?: boolean } = {}): ServerContext {
  const requestContext = new RequestContext();
  const authorId = options.authorId === undefined ? 'test-user' : options.authorId;
  if (authorId) requestContext.set(MASTRA_RESOURCE_ID_KEY, authorId);
  if (options.admin) requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['stored-workflows:admin']);

  return {
    mastra,
    requestContext,
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

function workflowDefinition(id: string, description?: string) {
  return {
    id,
    description,
    metadata: undefined,
    stateSchema: undefined,
    requestContextSchema: undefined,
    ...baseSchemas,
    graph: toolOnlyGraph(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Dynamic Workflows handlers', () => {
  let mastra: ReturnType<typeof buildMastra>;

  beforeEach(() => {
    mastra = buildMastra();
  });

  describe('LIST_DYNAMIC_WORKFLOWS_ROUTE', () => {
    it('returns empty when no workflows are stored', async () => {
      const result = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra),
        status: undefined,
        authorId: undefined,
      });
      expect(result).toEqual({ workflows: [], total: 0 });
    });

    it('returns dynamic workflows after upsert', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-a',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-b',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      const result = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra),
        status: undefined,
        authorId: undefined,
      });
      expect(result.total).toBe(2);
      expect(result.workflows.map(w => w.id).sort()).toEqual(['wf-a', 'wf-b']);
    });
  });

  describe('GET_DYNAMIC_WORKFLOW_ROUTE', () => {
    it('returns 404 when the workflow is missing', async () => {
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          dynamicWorkflowId: 'nope',
        }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('returns the dynamic workflow row after upsert', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-get',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      const row = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        dynamicWorkflowId: 'wf-get',
      });
      expect(row.id).toBe('wf-get');
      expect(row.status).toBe('active');
    });
  });

  describe('trusted author scoping', () => {
    it('scopes ordinary lists to the caller and reserves cross-author filters for admins', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        ...workflowDefinition('wf-a'),
      });
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-b'),
      });

      const userAList = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        status: undefined,
        authorId: undefined,
      });
      expect(userAList.workflows.map(workflow => workflow.id)).toEqual(['wf-a']);

      const userAExplicitList = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        status: undefined,
        authorId: 'user-a',
      });
      expect(userAExplicitList.workflows.map(workflow => workflow.id)).toEqual(['wf-a']);

      await expect(
        LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          status: undefined,
          authorId: 'user-b',
        }),
      ).rejects.toMatchObject({ status: 400 });

      const adminList = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        status: undefined,
        authorId: undefined,
      });
      expect(adminList.workflows.map(workflow => workflow.id).sort()).toEqual(['wf-a', 'wf-b']);

      const adminFiltered = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        status: undefined,
        authorId: 'user-b',
      });
      expect(adminFiltered.workflows.map(workflow => workflow.id)).toEqual(['wf-b']);
    });

    it('returns the same 404 for missing and cross-owner reads while allowing an admin read', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-private'),
      });

      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          dynamicWorkflowId: 'wf-private',
        }),
      ).rejects.toMatchObject({ status: 404, message: 'Not found' });
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          dynamicWorkflowId: 'missing',
        }),
      ).rejects.toMatchObject({ status: 404, message: 'Not found' });

      const adminRead = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        dynamicWorkflowId: 'wf-private',
      });
      expect(adminRead.authorId).toBe('user-b');
    });

    it('requires a stable caller for list, get, and upsert', async () => {
      await expect(
        LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
          ...ctx(mastra, { authorId: null }),
          status: undefined,
          authorId: undefined,
        }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: null }),
          dynamicWorkflowId: 'missing',
        }),
      ).rejects.toMatchObject({ status: 401 });
      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: null }),
          ...workflowDefinition('wf-missing-caller'),
        }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('derives the owner from RequestContext and strips a forged body author', async () => {
      const parsed = upsertDynamicWorkflowBodySchema.parse({
        ...workflowDefinition('wf-forged'),
        authorId: 'user-b',
      });
      expect(parsed).not.toHaveProperty('authorId');

      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        ...parsed,
      });

      const row = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        dynamicWorkflowId: 'wf-forged',
      });
      expect(row.authorId).toBe('user-a');
    });

    it('rejects a cross-owner update with a non-disclosing conflict', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-owned', 'original'),
      });

      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          ...workflowDefinition('wf-owned', 'takeover'),
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Dynamic workflow conflicts with an existing definition',
      });

      const row = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        dynamicWorkflowId: 'wf-owned',
      });
      expect(row).toMatchObject({ authorId: 'user-b', description: 'original' });
    });

    it('lets an admin update an owned bundle without transferring its owner', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-owned', 'original'),
      });

      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        ...workflowDefinition('wf-owned', 'admin edit'),
        dependencies: [workflowDefinition('wf-helper')],
      });

      const store = (await mastra.getStorage()!.getStore('workflowDefinitions'))!;
      await expect(store.get('wf-owned')).resolves.toMatchObject({ authorId: 'user-b', description: 'admin edit' });
      await expect(store.get('wf-helper')).resolves.toMatchObject({ authorId: 'user-b' });
    });

    it("doesn't let an existing helper choose the owner of a new admin-created root", async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-helper', 'original'),
      });

      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'admin', admin: true }),
          ...workflowDefinition('wf-new-root'),
          dependencies: [workflowDefinition('wf-helper', 'admin edit')],
        }),
      ).rejects.toMatchObject({
        status: 409,
        message: 'Dynamic workflow conflicts with an existing definition',
      });

      const store = (await mastra.getStorage()!.getStore('workflowDefinitions'))!;
      await expect(store.get('wf-new-root')).resolves.toBeNull();
      await expect(store.get('wf-helper')).resolves.toMatchObject({ authorId: 'user-b', description: 'original' });
    });

    it('keeps legacy unowned definitions hidden from users and read-only for admins', async () => {
      await mastra.addDynamicWorkflow(workflowDefinition('wf-legacy'));

      const userList = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-a' }),
        status: undefined,
        authorId: undefined,
      });
      expect(userList.workflows).toEqual([]);
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          dynamicWorkflowId: 'wf-legacy',
        }),
      ).rejects.toMatchObject({ status: 404, message: 'Not found' });

      const adminRead = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        dynamicWorkflowId: 'wf-legacy',
      });
      expect(adminRead.authorId).toBeUndefined();
      const adminList = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        status: undefined,
        authorId: undefined,
      });
      expect(adminList.workflows.map(workflow => workflow.id)).toEqual(['wf-legacy']);

      for (const caller of [{ authorId: 'user-a' }, { authorId: 'admin', admin: true }]) {
        await expect(
          UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
            ...ctx(mastra, caller),
            ...workflowDefinition('wf-legacy', 'claimed'),
          }),
        ).rejects.toMatchObject({ status: 409 });
      }
    });
  });

  describe('UPSERT_DYNAMIC_WORKFLOW_ROUTE', () => {
    it('happy path — tool + mapping graph is live-registered and runnable', async () => {
      const result = await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      // Child dynamic workflow: single tool that echoes its input.
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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

      // Parent dynamic workflow: calls the child via a `workflow` entry and
      // wraps its output. Exercises: schema acceptance of the `workflow`
      // variant on POST, pre-flight ref validation, rehydration through
      // `mastra.getWorkflow(workflowId)`, and end-to-end run through the
      // nested workflow.
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-parent',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        inputSchema: objectWith({ value: stringSchema }, ['value']),
        outputSchema: objectWith({ wrapped: stringSchema }, ['wrapped']),
        graph: [
          // Nested workflow entries must use the referenced workflowId as
          // their step id (enforced by preflight/ref validation).
          { type: 'workflow', id: 'wf-child', workflowId: 'wf-child' },
          {
            type: 'mapping',
            id: 'wrap',
            // Nested-workflow results are keyed by the child workflow's own id
            // (same convention as foreach keying by the inner step id).
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
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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

    it('rejects a schema-incompatible graph at save time (schema-flow runs on POST)', async () => {
      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          id: 'wf-schema-clash',
          description: undefined,
          metadata: undefined,
          stateSchema: undefined,
          requestContextSchema: undefined,
          // echo-tool requires { value: string }; the workflow only provides { count: number }.
          inputSchema: objectWith({ count: { type: 'number' } }, ['count']),
          outputSchema: objectWith({ value: stringSchema }, ['value']),
          graph: toolOnlyGraph(),
        }),
      ).rejects.toThrow(/incompatible/i);

      // Rejected before registration and persistence.
      expect(() => mastra.getWorkflow('wf-schema-clash')).toThrow();
    });

    it('re-POST with the same id replaces the live registration', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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

  describe('DELETE_DYNAMIC_WORKFLOW_ROUTE', () => {
    it('removes the workflow from storage AND unregisters the live instance', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
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

      const result = await DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        dynamicWorkflowId: 'wf-del',
      });
      expect(result.success).toBe(true);

      // Live registration must be gone.
      expect(() => mastra.getWorkflow('wf-del')).toThrow();

      // Storage row must be gone (subsequent GET returns 404).
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          dynamicWorkflowId: 'wf-del',
        }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('returns the same 404 for missing and cross-owner ids without deleting the owner', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-private'),
      });

      for (const dynamicWorkflowId of ['never-existed', 'wf-private']) {
        await expect(
          DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
            ...ctx(mastra, { authorId: 'user-a' }),
            dynamicWorkflowId,
          }),
        ).rejects.toMatchObject({ status: 404, message: 'Not found' });
      }

      const row = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'admin', admin: true }),
        dynamicWorkflowId: 'wf-private',
      });
      expect(row.authorId).toBe('user-b');
      expect(mastra.getWorkflow('wf-private')).toBeDefined();
    });

    it('lets an admin delete an owned definition without accepting a caller-supplied owner', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra, { authorId: 'user-b' }),
        ...workflowDefinition('wf-admin-delete'),
      });

      await expect(
        DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'admin', admin: true }),
          dynamicWorkflowId: 'wf-admin-delete',
        }),
      ).resolves.toMatchObject({ success: true });
      expect(() => mastra.getWorkflow('wf-admin-delete')).toThrow();
    });

    it('keeps legacy unowned definitions mutation-quarantined for users and admins', async () => {
      await mastra.addDynamicWorkflow(workflowDefinition('wf-legacy-delete'));

      await expect(
        DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'user-a' }),
          dynamicWorkflowId: 'wf-legacy-delete',
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: 'admin', admin: true }),
          dynamicWorkflowId: 'wf-legacy-delete',
        }),
      ).rejects.toMatchObject({ status: 409 });

      expect(mastra.getWorkflow('wf-legacy-delete')).toBeDefined();
    });

    it('requires a stable caller before delete', async () => {
      await expect(
        DELETE_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra, { authorId: null }),
          dynamicWorkflowId: 'missing',
        }),
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  // The route framework validates the request body against
  // `upsertDynamicWorkflowBodySchema` before the handler runs. These tests
  // exercise the schema directly to prove malformed conditional/loop payloads
  // are rejected at the HTTP boundary — closure-based `serializedConditions`
  // strings, unknown predicate operators, and loop entries missing a
  // `predicate` must never reach `Mastra.addDynamicWorkflow`.
  describe('upsertDynamicWorkflowBodySchema — predicate rejection', () => {
    const validBody = {
      id: 'wf-reject',
      inputSchema: objectWith({ value: stringSchema }, ['value']),
      outputSchema: objectWith({ value: stringSchema }, ['value']),
    };

    it('rejects legacy closure-based serializedConditions on a conditional entry', () => {
      const result = upsertDynamicWorkflowBodySchema.safeParse({
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

    it('rejects a conditional entry whose predicates/steps lengths differ', () => {
      const result = upsertDynamicWorkflowBodySchema.safeParse({
        ...validBody,
        graph: [
          {
            type: 'conditional',
            steps: [
              { type: 'tool', id: 'echo', toolId: 'echo-tool' },
              { type: 'tool', id: 'echo-2', toolId: 'echo-tool' },
            ],
            // One predicate for two branches — must be rejected at the HTTP
            // boundary (400) instead of surfacing as a 500 from the save path.
            predicates: [{ op: 'exists', path: 'inputData.value' }],
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it('rejects a conditional entry with an unknown predicate op', () => {
      const result = upsertDynamicWorkflowBodySchema.safeParse({
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
      const result = upsertDynamicWorkflowBodySchema.safeParse({
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
      const result = upsertDynamicWorkflowBodySchema.safeParse({
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
      const result = upsertDynamicWorkflowBodySchema.safeParse({
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

  // A workflow whose graph nests a helper that does not exist yet cannot be
  // saved on its own — the ref pre-flight rejects it. `dependencies` lets a
  // client send the helpers alongside the root so the whole set is validated,
  // hydrated in dependency order, and registered (or rejected) as one unit.
  describe('UPSERT_DYNAMIC_WORKFLOW_ROUTE — helper dependencies', () => {
    /** Root that nests two helpers and merges their outputs. */
    const fanoutRoot = {
      id: 'wf-fanout',
      description: undefined,
      metadata: undefined,
      stateSchema: undefined,
      requestContextSchema: undefined,
      inputSchema: objectWith({ first: stringSchema, second: stringSchema }, ['first', 'second']),
      outputSchema: objectWith({ merged: stringSchema }, ['merged']),
      graph: [
        {
          type: 'parallel' as const,
          steps: [
            { type: 'workflow' as const, id: 'echo-first', workflowId: 'echo-first' },
            { type: 'workflow' as const, id: 'echo-second', workflowId: 'echo-second' },
          ],
        },
        {
          type: 'mapping' as const,
          id: 'merge',
          mapConfig: JSON.stringify({
            merged: { template: '${stepResults.echo-first.value}+${stepResults.echo-second.value}' },
          }),
        },
      ],
    };

    /** Helper that reads one named field off the root input and echoes it. */
    const echoHelper = (id: string, field: string) => ({
      id,
      description: `Echo ${field}`,
      metadata: undefined,
      stateSchema: undefined,
      requestContextSchema: undefined,
      inputSchema: objectWith({ first: stringSchema, second: stringSchema }, ['first', 'second']),
      outputSchema: objectWith({ value: stringSchema }, ['value']),
      graph: [
        {
          type: 'mapping' as const,
          id: `pick-${field}`,
          mapConfig: JSON.stringify({ value: { template: '${inputData.' + field + '}' } }),
        },
        { type: 'tool' as const, id: 'echo', toolId: 'echo-tool' },
      ],
    });

    it('saves helpers with the root, registers all of them live, and reports their ids', async () => {
      const result = await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        ...fanoutRoot,
        dependencies: [echoHelper('echo-first', 'first'), echoHelper('echo-second', 'second')],
      });

      expect(result).toEqual({ ok: true, id: 'wf-fanout', dependencyIds: ['echo-first', 'echo-second'] });

      // Every member is live-registered and independently runnable.
      expect(mastra.getWorkflow('echo-first')).toBeDefined();
      expect(mastra.getWorkflow('echo-second')).toBeDefined();

      // And the root actually routes distinct branch inputs through them.
      const run = await mastra.getWorkflow('wf-fanout').createRun();
      const res = await run.start({ inputData: { first: 'ada', second: 'grace' } });
      expect(res.status).toBe('success');
      expect((res as any).result.merged).toBe('ada+grace');
    });

    it('persists each helper as an ordinary dynamic workflow, retrievable on its own', async () => {
      await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        ...fanoutRoot,
        dependencies: [echoHelper('echo-first', 'first'), echoHelper('echo-second', 'second')],
      });

      const helper = await GET_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        dynamicWorkflowId: 'echo-first',
      });
      expect(helper.id).toBe('echo-first');
      expect(helper.description).toBe('Echo first');

      const listed = await LIST_DYNAMIC_WORKFLOWS_ROUTE.handler({
        ...ctx(mastra),
        status: undefined,
        authorId: undefined,
      });
      expect(listed.workflows.map(w => w.id).sort()).toEqual(['echo-first', 'echo-second', 'wf-fanout']);
    });

    it('order the client sends helpers in does not matter — hydration order is derived', async () => {
      const result = await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        ...fanoutRoot,
        // Reversed relative to graph order.
        dependencies: [echoHelper('echo-second', 'second'), echoHelper('echo-first', 'first')],
      });
      expect(result.ok).toBe(true);

      const run = await mastra.getWorkflow('wf-fanout').createRun();
      const res = await run.start({ inputData: { first: 'ada', second: 'grace' } });
      expect((res as any).result.merged).toBe('ada+grace');
    });

    it('rejects the whole bundle when the root is invalid — no helper is left behind', async () => {
      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          ...fanoutRoot,
          graph: [
            // References a helper that is in neither the registry nor the bundle.
            { type: 'workflow' as const, id: 'echo-third', workflowId: 'echo-third' },
          ],
          dependencies: [echoHelper('echo-first', 'first')],
        }),
      ).rejects.toThrow();

      expect(() => mastra.getWorkflow('echo-first')).toThrow();
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({ ...ctx(mastra), dynamicWorkflowId: 'echo-first' }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('rejects the whole bundle when a helper is invalid — the root is not saved either', async () => {
      await expect(
        UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
          ...ctx(mastra),
          ...fanoutRoot,
          dependencies: [
            echoHelper('echo-first', 'first'),
            {
              ...echoHelper('echo-second', 'second'),
              graph: [{ type: 'tool' as const, id: 'echo', toolId: 'not-a-registered-tool' }],
            },
          ],
        }),
      ).rejects.toThrow();

      expect(() => mastra.getWorkflow('wf-fanout')).toThrow();
      expect(() => mastra.getWorkflow('echo-first')).toThrow();
      await expect(
        GET_DYNAMIC_WORKFLOW_ROUTE.handler({ ...ctx(mastra), dynamicWorkflowId: 'wf-fanout' }),
      ).rejects.toBeInstanceOf(HTTPException);
    });

    it('omitting dependencies leaves the single-workflow response shape untouched', async () => {
      const result = await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-solo',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
      });
      // No `dependencyIds` key at all — not `undefined`, absent.
      expect(result).toEqual({ ok: true, id: 'wf-solo' });
      expect('dependencyIds' in result).toBe(false);
    });

    it('an empty dependencies array behaves exactly like omitting it', async () => {
      const result = await UPSERT_DYNAMIC_WORKFLOW_ROUTE.handler({
        ...ctx(mastra),
        id: 'wf-solo-empty',
        description: undefined,
        metadata: undefined,
        stateSchema: undefined,
        requestContextSchema: undefined,
        ...baseSchemas,
        graph: toolOnlyGraph(),
        dependencies: [],
      });
      expect(result).toEqual({ ok: true, id: 'wf-solo-empty' });
      expect(mastra.getWorkflow('wf-solo-empty')).toBeDefined();
    });

    it('the body schema accepts a flat dependencies list of full definitions', () => {
      const parsed = upsertDynamicWorkflowBodySchema.safeParse({
        ...fanoutRoot,
        dependencies: [echoHelper('echo-first', 'first')],
      });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.dependencies?.[0]?.id).toBe('echo-first');
    });
  });
});
