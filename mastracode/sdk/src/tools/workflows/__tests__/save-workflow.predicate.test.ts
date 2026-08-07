/**
 * Coverage for the predicate DSL support on the `save-workflow` sub-agent tool.
 *
 * Two layers:
 * 1. Input schema — the discriminated-union graph must accept `conditional`
 *    and `loop` entries with a valid `predicate` payload and reject invalid
 *    ones (unknown operator, legacy `serializedConditions` payload).
 * 2. `execute` — must call `mastra.addStoredWorkflow` with the same shape it
 *    received, so the SDK schema and the server-side schema agree end-to-end.
 */
import { describe, it, expect, vi } from 'vitest';
import { saveWorkflowTool } from '../save-workflow';

function invoke(input: unknown, mastra: unknown) {
  // Call the raw execute; callers of the tool are responsible for schema
  // validation, but we assert the shape gets handed to `addStoredWorkflow`
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
    it('forwards the whole definition to mastra.addStoredWorkflow', async () => {
      const addStoredWorkflow = vi.fn().mockResolvedValue(undefined);
      const mastra = { addStoredWorkflow } as unknown;
      const result = await invoke(conditionalGraphWithPredicates, mastra);
      expect(result).toEqual({ ok: true, id: 'wf-cond' });
      expect(addStoredWorkflow).toHaveBeenCalledTimes(1);
      expect(addStoredWorkflow.mock.calls[0][0]).toStrictEqual(conditionalGraphWithPredicates);
    });
  });

  describe('when given a loop graph with a predicate', () => {
    it('forwards the whole definition to mastra.addStoredWorkflow', async () => {
      const addStoredWorkflow = vi.fn().mockResolvedValue(undefined);
      const mastra = { addStoredWorkflow } as unknown;
      const result = await invoke(loopGraphWithPredicate, mastra);
      expect(result).toEqual({ ok: true, id: 'wf-loop' });
      expect(addStoredWorkflow).toHaveBeenCalledTimes(1);
      expect(addStoredWorkflow.mock.calls[0][0]).toStrictEqual(loopGraphWithPredicate);
    });
  });

  describe('when mastra.addStoredWorkflow rejects (registry pre-flight failure)', () => {
    it('propagates the underlying error unchanged', async () => {
      const addStoredWorkflow = vi.fn().mockRejectedValue(new Error('unresolved reference to tool "inc-tool"'));
      const mastra = { addStoredWorkflow } as unknown;
      await expect(invoke(loopGraphWithPredicate, mastra)).rejects.toThrow(/unresolved reference to tool "inc-tool"/);
    });
  });
});
