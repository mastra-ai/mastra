/**
 * Coverage for the predicate DSL support on the `save-workflow` sub-agent tool.
 *
 * Two layers:
 * 1. Input schema — the discriminated-union graph must accept `conditional`
 *    and `loop` entries with a valid `predicate` payload and reject invalid
 *    ones (unknown operator, legacy `serializedConditions` payload).
 * 2. `execute` — must call `mastra.addDynamicWorkflow` with the normalized
 *    canonical shape, so the SDK and Core schemas agree end-to-end.
 */
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, vi } from 'vitest';
import { createSaveWorkflowTool, saveWorkflowTool } from '../save-workflow.js';

function invoke(input: unknown, mastra: unknown) {
  // Call the raw execute; callers of the tool are responsible for schema
  // validation, but we assert the shape gets handed to `addDynamicWorkflow`
  // unmodified so the server schema receives the same payload the SDK schema
  // accepted.
  return (saveWorkflowTool as any).execute(input, { mastra, requestContext: undefined });
}

const conditionalGraphWithPredicates = {
  id: 'wf-cond',
  inputSchema: { type: 'object', properties: { value: { type: 'number' } } },
  outputSchema: { type: 'object', properties: { msg: { type: 'string' } } },
  graph: [
    {
      type: 'conditional',
      steps: [
        { type: 'tool', id: 'shout', toolId: 'shout-tool' },
        { type: 'tool', id: 'whisper', toolId: 'whisper-tool' },
      ],
      predicates: [
        { op: 'gt', left: { path: 'inputData.value' }, right: { literal: 10 } },
        { op: 'lte', left: { path: 'inputData.value' }, right: { literal: 10 } },
      ],
    },
  ],
};

const loopGraphWithPredicate = {
  id: 'wf-loop',
  inputSchema: { type: 'object', properties: { count: { type: 'number' } } },
  outputSchema: { type: 'object', properties: { count: { type: 'number' } } },
  graph: [
    {
      type: 'loop',
      step: { type: 'tool', id: 'inc', toolId: 'inc-tool' },
      loopType: 'dountil',
      predicate: { op: 'gte', left: { path: 'inputData.count' }, right: { literal: 3 } },
    },
  ],
};

describe('save-workflow — input schema', () => {
  describe('when the graph carries a conditional entry with a valid predicate payload', () => {
    it('accepts it', () => {
      const result = (saveWorkflowTool as any).inputSchema.safeParse(conditionalGraphWithPredicates);
      expect(result.success).toBe(true);
    });
  });

  describe('when the graph carries a loop entry with a valid predicate payload', () => {
    it('accepts it', () => {
      const result = (saveWorkflowTool as any).inputSchema.safeParse(loopGraphWithPredicate);
      expect(result.success).toBe(true);
    });
  });

  describe('when a conditional predicate has an unknown operator', () => {
    it('rejects the payload', () => {
      const bad = structuredClone(conditionalGraphWithPredicates) as any;
      bad.graph[0].predicates[0].op = 'sometimes';
      const result = (saveWorkflowTool as any).inputSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });

  describe('when a conditional entry supplies legacy `serializedConditions` instead of `predicates`', () => {
    it('rejects the payload — no closure-based fallback in the SDK schema', () => {
      const legacy = {
        id: 'wf-legacy',
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
        graph: [
          {
            type: 'conditional',
            steps: [{ type: 'tool', id: 'shout', toolId: 'shout-tool' }],
            // Old shape from the pre-predicate era. Must not be accepted.
            serializedConditions: [{ id: 'shout-condition', fn: 'async ({ inputData }) => inputData.value > 10' }],
          },
        ],
      };
      const result = (saveWorkflowTool as any).inputSchema.safeParse(legacy);
      expect(result.success).toBe(false);
    });
  });

  describe('when a loop entry omits the predicate', () => {
    it('rejects the payload', () => {
      const bad = structuredClone(loopGraphWithPredicate) as any;
      delete bad.graph[0].predicate;
      const result = (saveWorkflowTool as any).inputSchema.safeParse(bad);
      expect(result.success).toBe(false);
    });
  });
});

describe('save-workflow — execute', () => {
  describe('when given a conditional graph with predicates', () => {
    it('forwards the whole definition to mastra.addDynamicWorkflow', async () => {
      const addDynamicWorkflow = vi.fn().mockResolvedValue(undefined);
      const mastra = { addDynamicWorkflow } as unknown;
      const result = await invoke(conditionalGraphWithPredicates, mastra);
      expect(result).toEqual({ ok: true, id: 'wf-cond' });
      expect(addDynamicWorkflow).toHaveBeenCalledTimes(1);
      expect(addDynamicWorkflow.mock.calls[0][0]).toStrictEqual(conditionalGraphWithPredicates);
    });
  });

  describe('when given a loop graph with a predicate', () => {
    it('forwards the whole definition to mastra.addDynamicWorkflow', async () => {
      const addDynamicWorkflow = vi.fn().mockResolvedValue(undefined);
      const mastra = { addDynamicWorkflow } as unknown;
      const result = await invoke(loopGraphWithPredicate, mastra);
      expect(result).toEqual({ ok: true, id: 'wf-loop' });
      expect(addDynamicWorkflow).toHaveBeenCalledTimes(1);
      expect(addDynamicWorkflow.mock.calls[0][0]).toStrictEqual(loopGraphWithPredicate);
    });
  });

  describe('when mastra.addDynamicWorkflow rejects (registry pre-flight failure)', () => {
    it('propagates the underlying error unchanged', async () => {
      const addDynamicWorkflow = vi.fn().mockRejectedValue(new Error('unresolved reference to tool "inc-tool"'));
      const mastra = { addDynamicWorkflow } as unknown;
      await expect(invoke(loopGraphWithPredicate, mastra)).rejects.toThrow(/unresolved reference to tool "inc-tool"/);
    });
  });

  describe('when mastra.addDynamicWorkflow rejects (storage failure)', () => {
    it('propagates the underlying error unchanged', async () => {
      const addDynamicWorkflow = vi.fn().mockRejectedValue(new Error('workflow storage unavailable'));
      const mastra = { addDynamicWorkflow } as unknown;
      await expect(invoke(loopGraphWithPredicate, mastra)).rejects.toThrow(/workflow storage unavailable/);
    });
  });
});

describe('createSaveWorkflowTool — authorization', () => {
  it('passes the native request context and a detached definition to the policy', async () => {
    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-1');
    const addDynamicWorkflow = vi.fn().mockResolvedValue(undefined);
    let receivedRequestContext: RequestContext | undefined;
    let receivedDefinition: unknown;
    const authorize = vi.fn(({ definition, requestContext: context }) => {
      receivedRequestContext = context;
      receivedDefinition = structuredClone(definition);
      (definition as { id: string }).id = 'attempted-rewrite';
    });
    const tool = createSaveWorkflowTool({ authorize });

    const result = await (tool as any).execute(loopGraphWithPredicate, {
      mastra: { addDynamicWorkflow },
      requestContext,
    });

    expect(result).toEqual({ ok: true, id: 'wf-loop' });
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(receivedRequestContext).toBe(requestContext);
    expect(receivedDefinition).toStrictEqual(loopGraphWithPredicate);
    expect(addDynamicWorkflow).toHaveBeenCalledWith(loopGraphWithPredicate);
  });

  it('does not call Mastra when the policy denies by throwing', async () => {
    const addDynamicWorkflow = vi.fn().mockResolvedValue(undefined);
    const tool = createSaveWorkflowTool({
      authorize: async () => {
        throw new Error('workflow save not authorized');
      },
    });

    await expect(
      (tool as any).execute(loopGraphWithPredicate, {
        mastra: { addDynamicWorkflow },
        requestContext: new RequestContext(),
      }),
    ).rejects.toThrow(/workflow save not authorized/);
    expect(addDynamicWorkflow).not.toHaveBeenCalled();
  });
});
