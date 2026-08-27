import { describe, expect, it } from 'vitest';

import { formatClock, spanKind } from '../span-kind';

describe('spanKind', () => {
  it.each([
    ['model_generation', 'MODEL'],
    ['tool_call', 'TOOL'],
    ['client_tool_call', 'TOOL'],
    ['provider_tool_call', 'TOOL'],
    ['mcp_tool_call', 'TOOL'],
    ['processor_run', 'PROCESSOR'],
    ['workflow_run', 'WORKFLOW'],
    ['workflow_step', 'STEP'],
    ['workspace_action', 'WORKSPACE'],
  ])('maps %s to %s', (spanType, expected) => {
    expect(spanKind({ spanId: 's', spanType })).toBe(expected);
  });

  it('reads a workflow-as-tool call as a workflow, which is what it is', () => {
    // Core exposes workflows to agents as tools named `workflow-<id>`, and reads that prefix back
    // the same way. A row saying TOOL for one only hides the workflow it actually ran.
    expect(spanKind({ spanId: 's', spanType: 'tool_call', entityId: 'workflow-myWorkflow' })).toBe('WORKFLOW');
    expect(spanKind({ spanId: 's', spanType: 'tool_call', entityId: 'weatherInfo' })).toBe('TOOL');
  });

  it('surfaces the raw span type for anything unmapped, so nothing hides as a generic step', () => {
    expect(spanKind({ spanId: 's', spanType: 'something_new' })).toBe('SOMETHING NEW');
    expect(spanKind({ spanId: 's', spanType: 'agent_run' })).toBe('AGENT RUN');
    expect(spanKind({ spanId: 's', spanType: undefined })).toBe('STEP');
  });
});

describe('formatClock', () => {
  it('renders the wall clock of the step, so the gutter reads as a log', () => {
    const at = new Date(2026, 0, 1, 20, 41, 2);
    expect(formatClock(at)).toBe('20:41:02');
    expect(formatClock(at.toISOString())).toBe('20:41:02');
  });

  it('returns undefined rather than an unusable timestamp', () => {
    expect(formatClock('not a date')).toBeUndefined();
    expect(formatClock(undefined)).toBeUndefined();
  });
});
