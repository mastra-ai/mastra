import { describe, expect, it } from 'vitest';

import { formatOffset, spanKind } from '../span-kind';

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

  it('surfaces the raw span type for anything unmapped, so nothing hides as a generic step', () => {
    expect(spanKind({ spanId: 's', spanType: 'something_new' })).toBe('SOMETHING NEW');
    expect(spanKind({ spanId: 's', spanType: 'agent_run' })).toBe('AGENT RUN');
    expect(spanKind({ spanId: 's', spanType: undefined })).toBe('STEP');
  });
});

describe('formatOffset', () => {
  const turnStart = Date.parse('2026-01-01T10:00:00.000Z');

  it('renders elapsed seconds with one decimal', () => {
    expect(formatOffset('2026-01-01T10:00:00.000Z', turnStart)).toBe('0.0s');
    expect(formatOffset('2026-01-01T10:00:03.200Z', turnStart)).toBe('3.2s');
    expect(formatOffset(new Date('2026-01-01T10:00:07.700Z'), turnStart)).toBe('7.7s');
  });

  it('returns undefined rather than a negative or unusable offset', () => {
    expect(formatOffset('2026-01-01T09:59:59.000Z', turnStart)).toBeUndefined();
    expect(formatOffset('not a date', turnStart)).toBeUndefined();
    expect(formatOffset(undefined, turnStart)).toBeUndefined();
    expect(formatOffset('2026-01-01T10:00:00.000Z', undefined)).toBeUndefined();
  });
});
