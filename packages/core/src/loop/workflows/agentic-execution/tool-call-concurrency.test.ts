import { describe, expect, it } from 'vitest';
import {
  effectiveToolSetRequiresSequentialExecution,
  normalizeToolCallConcurrency,
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
