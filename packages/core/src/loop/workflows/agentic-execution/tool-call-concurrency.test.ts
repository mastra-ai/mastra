import { describe, expect, it, vi } from 'vitest';
import { RequestContext } from '../../../request-context';
import {
  effectiveToolSetRequiresSequentialExecution,
  normalizeToolCallConcurrency,
  resolveCalledToolCallConcurrency,
  resolveConfiguredToolCallConcurrency,
  resolveToolCallConcurrency,
} from './tool-call-concurrency';

describe('tool call concurrency resolution', () => {
  const safeTool = {};
  const approvalTool = { requireApproval: true };
  const suspendTool = { hasSuspendSchema: true };

  it('requires sequential execution when global approval is enabled', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        requireToolApproval: true,
        tools: {
          safe: safeTool,
        },
        activeTools: ['safe'],
      }),
    ).toBe(true);
  });

  it('requires sequential execution when global approval is a function', () => {
    // A function policy can only be evaluated per call once args are known, so before
    // execution we conservatively force sequential to avoid approval suspensions racing.
    expect(
      effectiveToolSetRequiresSequentialExecution({
        requireToolApproval: () => false,
        tools: {
          safe: safeTool,
        },
        activeTools: ['safe'],
      }),
    ).toBe(true);
  });

  it('scans all current tools when activeTools is undefined', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: {
          safe: safeTool,
          approval: approvalTool,
        },
        activeTools: undefined,
      }),
    ).toBe(true);
  });

  it('scans no tools when activeTools is empty', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: {
          approval: approvalTool,
        },
        activeTools: [],
      }),
    ).toBe(false);
  });

  it('ignores inactive approval and suspension tools', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: {
          safe: safeTool,
          approval: approvalTool,
          suspend: suspendTool,
        },
        activeTools: ['safe'],
      }),
    ).toBe(false);
  });

  it('keeps parallel tool calls concurrent when unrelated available tools can suspend', () => {
    expect(
      resolveToolCallConcurrency({
        tools: {
          subagent: safeTool,
          ask_user: suspendTool,
          submit_plan: suspendTool,
        },
        activeTools: ['subagent'],
        configuredConcurrency: 4,
      }),
    ).toBe(4);
  });

  it('ignores unknown active tool names', () => {
    expect(
      effectiveToolSetRequiresSequentialExecution({
        tools: {
          safe: safeTool,
        },
        activeTools: ['missing'],
      }),
    ).toBe(false);
  });

  it('uses the configured concurrency when the effective tool set is safe', () => {
    expect(
      resolveToolCallConcurrency({
        tools: {
          safe: safeTool,
          approval: approvalTool,
        },
        activeTools: ['safe'],
        configuredConcurrency: 4,
      }),
    ).toBe(4);
  });

  it('honors configured concurrency of one for safe tools', () => {
    expect(
      resolveToolCallConcurrency({
        tools: {
          safe: safeTool,
        },
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
    it('parallelizes a pure-safe batch even when an approval tool is available', () => {
      expect(
        resolveToolCallConcurrency({
          tools: {
            safe: safeTool,
            approval: approvalTool,
          },
          activeTools: ['safe', 'approval'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe'],
        }),
      ).toBe(4);
    });

    it('serializes a batch that actually called a suspend tool', () => {
      expect(
        resolveToolCallConcurrency({
          tools: {
            safe: safeTool,
            suspend: suspendTool,
          },
          activeTools: ['safe', 'suspend'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe', 'suspend'],
        }),
      ).toBe(1);
    });

    it('serializes a batch that actually called an approval tool', () => {
      expect(
        resolveToolCallConcurrency({
          tools: {
            safe: safeTool,
            approval: approvalTool,
          },
          activeTools: ['safe', 'approval'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['approval'],
        }),
      ).toBe(1);
    });

    it('still forces sequential when run-wide requireToolApproval is set', () => {
      expect(
        resolveToolCallConcurrency({
          requireToolApproval: true,
          tools: {
            safe: safeTool,
          },
          activeTools: ['safe'],
          configuredConcurrency: 4,
          strategy: 'called',
          calledToolNames: ['safe'],
        }),
      ).toBe(1);
    });

    it('does not force sequential when no called tool names are provided', () => {
      expect(
        effectiveToolSetRequiresSequentialExecution({
          tools: {
            safe: safeTool,
            approval: approvalTool,
          },
          activeTools: ['safe', 'approval'],
          strategy: 'called',
        }),
      ).toBe(false);
    });
  });
});

describe('resolveCalledToolCallConcurrency', () => {
  const base = { configuredConcurrency: 5 };
  const dynamicTool = (result: boolean | (() => never)) => ({
    // Mirrors an MCP tool built from a function policy: static flag plus the real policy.
    requireApproval: true,
    needsApprovalFn: vi.fn(async () => (typeof result === 'function' ? result() : result)),
  });

  it('runs a batch in parallel when a function policy returns false (#24232)', async () => {
    const tool = dynamicTool(false);
    const concurrency = await resolveCalledToolCallConcurrency({
      ...base,
      strategy: 'called',
      tools: { dyn: tool, safe: {} } as any,
      toolCalls: [
        { toolName: 'dyn', args: { value: 1 } },
        { toolName: 'safe', args: {} },
      ],
    });
    expect(concurrency).toBe(5);
    expect(tool.needsApprovalFn).toHaveBeenCalledWith({ value: 1 }, expect.anything());
  });

  it('forces sequential when a function policy returns true', async () => {
    const concurrency = await resolveCalledToolCallConcurrency({
      ...base,
      strategy: 'called',
      tools: { dyn: dynamicTool(true), safe: {} } as any,
      toolCalls: [
        { toolName: 'dyn', args: {} },
        { toolName: 'safe', args: {} },
      ],
    });
    expect(concurrency).toBe(1);
  });

  it('forces sequential when a function policy throws', async () => {
    const concurrency = await resolveCalledToolCallConcurrency({
      ...base,
      strategy: 'called',
      tools: {
        dyn: dynamicTool(() => {
          throw new Error('boom');
        }),
      } as any,
      toolCalls: [{ toolName: 'dyn', args: {} }],
    });
    expect(concurrency).toBe(1);
  });

  it('forces sequential for static approval and suspend tools', async () => {
    for (const tool of [{ requireApproval: true }, { hasSuspendSchema: true }]) {
      const concurrency = await resolveCalledToolCallConcurrency({
        ...base,
        strategy: 'called',
        tools: { t: tool, safe: {} } as any,
        toolCalls: [
          { toolName: 't', args: {} },
          { toolName: 'safe', args: {} },
        ],
      });
      expect(concurrency).toBe(1);
    }
  });

  it('evaluates a run-wide function policy per call with args and request context', async () => {
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');
    const policy = vi.fn(({ toolName }: { toolName: string }) => toolName === 'danger');

    await expect(
      resolveCalledToolCallConcurrency({
        ...base,
        strategy: 'called',
        requireToolApproval: policy,
        tools: { a: {}, b: {}, danger: {} } as any,
        toolCalls: [
          { toolName: 'a', args: { x: 1 } },
          { toolName: 'b', args: {} },
        ],
        requestContext,
      }),
    ).resolves.toBe(5);
    expect(policy).toHaveBeenCalledWith(
      expect.objectContaining({ toolName: 'a', args: { x: 1 }, requestContext: { tenant: 'acme' } }),
    );

    await expect(
      resolveCalledToolCallConcurrency({
        ...base,
        strategy: 'called',
        requireToolApproval: policy,
        tools: { a: {}, danger: {} } as any,
        toolCalls: [
          { toolName: 'a', args: {} },
          { toolName: 'danger', args: {} },
        ],
      }),
    ).resolves.toBe(1);
  });

  it('keeps the available strategy conservative for function policies', async () => {
    const tool = dynamicTool(false);
    const concurrency = await resolveCalledToolCallConcurrency({
      ...base,
      tools: { dyn: tool, safe: {} } as any,
      toolCalls: [{ toolName: 'safe', args: {} }],
    });
    expect(concurrency).toBe(1);
    expect(tool.needsApprovalFn).not.toHaveBeenCalled();
  });
});
