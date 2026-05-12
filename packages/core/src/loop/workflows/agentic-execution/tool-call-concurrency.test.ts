import { describe, expect, it } from 'vitest';
import {
  effectiveToolCallsRequireSequentialExecution,
  effectiveToolSetRequiresSequentialExecution,
  resolveConfiguredToolCallConcurrency,
  resolveToolCallConcurrency,
} from './tool-call-concurrency';
import { setInternalToolExecutionHints } from '../../../tools/internal-execution-hints';

describe('tool call concurrency resolution', () => {
  const safeTool = {};
  const approvalBypassSafeTool = setInternalToolExecutionHints(
    {},
    {
      bypassGlobalToolApproval: true,
      safeForConcurrentExecution: true,
    },
  );
  const conditionalApprovalBypassSafeTool = setInternalToolExecutionHints(
    {},
    {
      bypassGlobalToolApproval: args => !(args as { forked?: boolean }).forked,
      safeForConcurrentExecution: args => !(args as { forked?: boolean }).forked,
    },
  );
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

  it('keeps configured concurrency in approval mode when actual tool calls are approval-bypass safe', () => {
    expect(
      resolveToolCallConcurrency({
        requireToolApproval: true,
        tools: {
          safe: approvalBypassSafeTool,
          approval: approvalTool,
        },
        toolCalls: [{ toolName: 'safe', args: {} }],
        configuredConcurrency: 4,
      }),
    ).toBe(4);
  });

  it('uses call args when resolving conditional approval-bypass safe tools', () => {
    expect(
      effectiveToolCallsRequireSequentialExecution({
        requireToolApproval: true,
        tools: {
          subagent: conditionalApprovalBypassSafeTool,
        },
        toolCalls: [{ toolName: 'subagent', args: { forked: false } }],
      }),
    ).toBe(false);

    expect(
      effectiveToolCallsRequireSequentialExecution({
        requireToolApproval: true,
        tools: {
          subagent: conditionalApprovalBypassSafeTool,
        },
        toolCalls: [{ toolName: 'subagent', args: { forked: true } }],
      }),
    ).toBe(true);
  });

  it('forces sequential execution in approval mode when any actual tool call is unsafe', () => {
    expect(
      resolveToolCallConcurrency({
        requireToolApproval: true,
        tools: {
          safe: approvalBypassSafeTool,
          approval: approvalTool,
        },
        toolCalls: [
          { toolName: 'safe', args: {} },
          { toolName: 'approval', args: {} },
        ],
        configuredConcurrency: 4,
      }),
    ).toBe(1);
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
});
