import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../request-context';
import {
  effectiveToolSetRequiresSequentialExecution,
  normalizeToolCallConcurrency,
  resolveEmittedToolCallConcurrency,
  resolveConfiguredToolCallConcurrency,
  resolveToolCallConcurrency,
} from './tool-call-concurrency';

describe('tool call concurrency resolution', () => {
  const safeTool = {};
  const approvalTool = { requireApproval: true };
  const fnPolicyTool = () => ({ needsApprovalFn: vi.fn(async () => true) });
  const suspendTool = { hasSuspendSchema: true };

  it('does not require sequential execution for approval tools (#30152)', () => {
    const fnPolicy = fnPolicyTool();
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: { safe: safeTool, approval: approvalTool, fnPolicy },
        activeTools: undefined,
      }),
    ).toBe(false);
    expect(fnPolicy.needsApprovalFn).not.toHaveBeenCalled();
  });

  it('scans all current tools for suspend schemas when activeTools is undefined', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: { safe: safeTool, suspend: suspendTool },
        activeTools: undefined,
      }),
    ).toBe(true);
  });

  it('scans no tools when activeTools is empty', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: { suspend: suspendTool },
        activeTools: [],
      }),
    ).toBe(false);
  });

  it('ignores inactive suspension tools', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: { safe: safeTool, suspend: suspendTool },
        activeTools: ['safe'],
      }),
    ).toBe(false);
  });

  it('keeps parallel tool calls concurrent when unrelated available tools can suspend', () => {
    expect(
      resolveToolCallConcurrency({
        tools: { subagent: safeTool, ask_user: suspendTool, submit_plan: suspendTool },
        activeTools: ['subagent'],
        configuredConcurrency: 4,
      }),
    ).toBe(4);
  });

  it('ignores unknown active tool names', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: { safe: safeTool },
        activeTools: ['missing'],
      }),
    ).toBe(false);
  });

  it('uses the configured concurrency when active tools need approval (#30152)', () => {
    expect(
      resolveToolCallConcurrency({
        tools: { safe: safeTool, approval: approvalTool },
        activeTools: ['safe', 'approval'],
        configuredConcurrency: 4,
      }),
    ).toBe(4);
  });

  it('honors configured concurrency of one for safe tools', () => {
    expect(
      resolveToolCallConcurrency({
        tools: { safe: safeTool },
        activeTools: ['safe'],
        configuredConcurrency: 1,
      }),
    ).toBe(1);
  });

  it('normalizes invalid configured concurrency to the default', () => {
    expect(resolveConfiguredToolCallConcurrency(undefined)).toBe(10);
    expect(resolveConfiguredToolCallConcurrency(0)).toBe(10);
    expect(resolveConfiguredToolCallConcurrency(-1)).toBe(10);
    expect(resolveConfiguredToolCallConcurrency(3)).toBe(3);
  });

  it('normalizes the object form and defaults the strategy to available', () => {
    expect(normalizeToolCallConcurrency(5)).toEqual({ limit: 5, strategy: 'available' });
    expect(normalizeToolCallConcurrency(undefined)).toEqual({ limit: 10, strategy: 'available' });
    expect(normalizeToolCallConcurrency({ limit: 8 })).toEqual({ limit: 8, strategy: 'available' });
    expect(normalizeToolCallConcurrency({ limit: 8, strategy: 'called' })).toEqual({ limit: 8, strategy: 'called' });
    expect(normalizeToolCallConcurrency({ limit: 0, strategy: 'called' })).toEqual({ limit: 10, strategy: 'called' });
  });

  describe("strategy: 'called'", () => {
    it('parallelizes a pure-safe batch even when a suspend tool is available', () => {
      expect(
        resolveToolCallConcurrency({
          tools: { safe: safeTool, suspend: suspendTool },
          activeTools: ['safe', 'suspend'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe'],
        }),
      ).toBe(4);
    });

    it('serializes a batch that actually called a suspend tool', () => {
      expect(
        resolveToolCallConcurrency({
          tools: { safe: safeTool, suspend: suspendTool },
          activeTools: ['safe', 'suspend'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe', 'suspend'],
        }),
      ).toBe(1);
    });

    it('serializes a called suspend tool emitted by its id rather than its registry key', () => {
      expect(
        resolveToolCallConcurrency({
          tools: { safe: safeTool, renamedSuspend: { ...suspendTool, id: 'suspend-by-id' } },
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe', 'suspend-by-id'],
        }),
      ).toBe(1);
    });

    it('parallelizes a batch that called approval tools (#30152)', () => {
      const fnPolicy = fnPolicyTool();
      expect(
        resolveToolCallConcurrency({
          tools: { safe: safeTool, approval: approvalTool, fnPolicy },
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe', 'approval', 'fnPolicy'],
        }),
      ).toBe(4);
      expect(fnPolicy.needsApprovalFn).not.toHaveBeenCalled();
    });

    it('does not force sequential when no called tool names are provided', () => {
      expect(
        effectiveToolSetRequiresSequentialExecution({
          tools: { safe: safeTool, suspend: suspendTool },
          activeTools: ['safe', 'suspend'],
          strategy: 'called',
        }),
      ).toBe(false);
    });
  });
});

describe('resolveEmittedToolCallConcurrency', () => {
  const base = { configuredConcurrency: 5 };
  const dynamicTool = (result: boolean | (() => never)) => ({
    // Mirrors an MCP tool built from a function policy: static flag plus the real policy.
    requireApproval: true,
    needsApprovalFn: vi.fn(async () => (typeof result === 'function' ? result() : result)),
  });

  for (const strategy of ['called', 'available'] as const) {
    describe(`strategy: '${strategy}'`, () => {
      it('runs gated and ungated calls in parallel and caches each verdict (#30152)', async () => {
        const gated = dynamicTool(true);
        const ungated = dynamicTool(false);
        const verdicts = new Map<string, boolean>();
        const concurrency = await resolveEmittedToolCallConcurrency({
          ...base,
          strategy,
          tools: { gated, ungated, approval: { requireApproval: true }, safe: {} } as any,
          toolCalls: [
            { toolCallId: 'c1', toolName: 'gated', args: { value: 1, resumeData: { approved: true } } },
            { toolCallId: 'c2', toolName: 'ungated', args: {} },
            { toolCallId: 'c3', toolName: 'approval', args: {} },
            { toolCallId: 'c4', toolName: 'safe', args: {} },
          ],
          approvalVerdicts: verdicts,
        });
        expect(concurrency).toBe(5);
        // resumeData is stripped so a resumed call is judged on the args the model sent.
        expect(gated.needsApprovalFn).toHaveBeenCalledWith({ value: 1 }, expect.anything());
        expect(ungated.needsApprovalFn).toHaveBeenCalledTimes(1);
        expect(verdicts).toEqual(
          new Map([
            ['c1', true],
            ['c2', false],
            ['c3', true],
            ['c4', false],
          ]),
        );
      });

      it('runs in parallel under a run-wide approval policy and evaluates it per call', async () => {
        const requestContext = new RequestContext();
        requestContext.set('tenant', 'acme');
        const policy = vi.fn(({ toolName }: { toolName: string }) => toolName === 'danger');
        const verdicts = new Map<string, boolean>();
        await expect(
          resolveEmittedToolCallConcurrency({
            ...base,
            strategy,
            requireToolApproval: policy,
            tools: { a: {}, danger: {} } as any,
            toolCalls: [
              { toolCallId: 'a1', toolName: 'a', args: { x: 1 } },
              { toolCallId: 'd1', toolName: 'danger', args: {} },
            ],
            approvalVerdicts: verdicts,
            requestContext,
          }),
        ).resolves.toBe(5);
        expect(policy).toHaveBeenCalledWith(
          expect.objectContaining({ toolName: 'a', args: { x: 1 }, requestContext: { tenant: 'acme' } }),
        );
        expect(verdicts).toEqual(
          new Map([
            ['a1', false],
            ['d1', true],
          ]),
        );
      });

      it('runs in parallel under run-wide requireToolApproval: true', async () => {
        await expect(
          resolveEmittedToolCallConcurrency({
            ...base,
            strategy,
            requireToolApproval: true,
            tools: { a: {}, b: {} } as any,
            toolCalls: [
              { toolName: 'a', args: {} },
              { toolName: 'b', args: {} },
            ],
          }),
        ).resolves.toBe(5);
      });

      it('treats a throwing policy as requiring approval without forcing sequential', async () => {
        const verdicts = new Map<string, boolean>();
        const concurrency = await resolveEmittedToolCallConcurrency({
          ...base,
          strategy,
          tools: {
            dyn: dynamicTool(() => {
              throw new Error('boom');
            }),
          } as any,
          toolCalls: [{ toolCallId: 'c1', toolName: 'dyn', args: {} }],
          approvalVerdicts: verdicts,
        });
        expect(concurrency).toBe(5);
        expect(verdicts.get('c1')).toBe(true);
      });

      it('resolves called tools by id like the tool-call step', async () => {
        const concurrency = await resolveEmittedToolCallConcurrency({
          ...base,
          strategy,
          tools: { key: { id: 'aliased', hasSuspendSchema: true } } as any,
          toolCalls: [{ toolName: 'aliased', args: {} }],
        });
        expect(concurrency).toBe(1);
      });

      it('forces sequential when a called tool cannot be resolved', async () => {
        const concurrency = await resolveEmittedToolCallConcurrency({
          ...base,
          strategy,
          tools: { safe: {} } as any,
          toolCalls: [{ toolName: 'unknown', args: {} }],
        });
        expect(concurrency).toBe(1);
      });

      it('forces sequential for a called suspend tool', async () => {
        const concurrency = await resolveEmittedToolCallConcurrency({
          ...base,
          strategy,
          tools: { suspend: { hasSuspendSchema: true }, safe: {} } as any,
          toolCalls: [
            { toolName: 'suspend', args: {} },
            { toolName: 'safe', args: {} },
          ],
        });
        expect(concurrency).toBe(1);
      });
    });
  }

  it("'available' still forces sequential for an uncalled active suspend tool", async () => {
    const concurrency = await resolveEmittedToolCallConcurrency({
      ...base,
      tools: { suspend: { hasSuspendSchema: true }, safe: {} } as any,
      toolCalls: [{ toolName: 'safe', args: {} }],
    });
    expect(concurrency).toBe(1);
  });

  it("'available' ignores an inactive suspend tool", async () => {
    const concurrency = await resolveEmittedToolCallConcurrency({
      ...base,
      tools: { suspend: { hasSuspendSchema: true }, safe: {} } as any,
      activeTools: ['safe'],
      toolCalls: [{ toolName: 'safe', args: {} }],
    });
    expect(concurrency).toBe(5);
  });

  it("'called' ignores an uncalled active suspend tool", async () => {
    const concurrency = await resolveEmittedToolCallConcurrency({
      ...base,
      strategy: 'called',
      tools: { suspend: { hasSuspendSchema: true }, safe: {} } as any,
      toolCalls: [{ toolName: 'safe', args: {} }],
    });
    expect(concurrency).toBe(5);
  });
});
