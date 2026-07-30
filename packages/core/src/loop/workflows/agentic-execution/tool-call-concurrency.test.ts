import { describe, expect, it } from 'vitest';
import {
  effectiveToolSetRequiresSequentialExecution,
  resolveConfiguredToolCallConcurrency,
  resolveToolCallConcurrency,
  resolveToolCallConcurrencyStrategy,
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

  it('extracts the limit from the object config form', () => {
    expect(resolveConfiguredToolCallConcurrency({ limit: 4 })).toBe(4);
    expect(resolveConfiguredToolCallConcurrency({ limit: 4, strategy: 'called' })).toBe(4);
    expect(resolveConfiguredToolCallConcurrency({})).toBe(10);
    expect(resolveConfiguredToolCallConcurrency({ limit: 0 })).toBe(10);
    expect(resolveConfiguredToolCallConcurrency({ strategy: 'called' })).toBe(10);
  });

  it('resolves the concurrency strategy (default available)', () => {
    expect(resolveToolCallConcurrencyStrategy(undefined)).toBe('available');
    expect(resolveToolCallConcurrencyStrategy(4)).toBe('available');
    expect(resolveToolCallConcurrencyStrategy({ limit: 4 })).toBe('available');
    expect(resolveToolCallConcurrencyStrategy({ strategy: 'available' })).toBe('available');
    expect(resolveToolCallConcurrencyStrategy({ strategy: 'called' })).toBe('called');
  });

  describe("'called' strategy", () => {
    const tools = { generate_video: safeTool, request_approval: suspendTool, delete_record: approvalTool };

    it('stays parallel when the batch calls only safe tools, even with an approval tool available', () => {
      // The batch called only generate_video; request_approval/delete_record are
      // available (activeTools undefined ⇒ whole set) but uncalled ⇒ cannot suspend.
      expect(
        effectiveToolSetRequiresSequentialExecution({
          tools,
          activeTools: undefined,
          calledToolNames: ['generate_video', 'generate_video'],
        }),
      ).toBe(false);
      expect(
        resolveToolCallConcurrency({
          tools,
          activeTools: undefined,
          calledToolNames: ['generate_video', 'generate_video'],
          configuredConcurrency: 8,
        }),
      ).toBe(8);
    });

    it('serializes when the batch actually calls a suspending tool', () => {
      expect(
        effectiveToolSetRequiresSequentialExecution({
          tools,
          calledToolNames: ['generate_video', 'request_approval'],
        }),
      ).toBe(true);
      expect(
        resolveToolCallConcurrency({
          tools,
          calledToolNames: ['generate_video', 'request_approval'],
          configuredConcurrency: 8,
        }),
      ).toBe(1);
    });

    it('serializes when the batch actually calls an approval tool', () => {
      expect(
        effectiveToolSetRequiresSequentialExecution({
          tools,
          calledToolNames: ['delete_record'],
        }),
      ).toBe(true);
    });

    it('still forces sequential under a global approval policy regardless of called tools', () => {
      expect(
        effectiveToolSetRequiresSequentialExecution({
          requireToolApproval: true,
          tools,
          calledToolNames: ['generate_video'],
        }),
      ).toBe(true);
    });

    it('treats an empty batch as safe', () => {
      expect(effectiveToolSetRequiresSequentialExecution({ tools, calledToolNames: [] })).toBe(false);
    });
  });
});
