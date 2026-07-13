import type { DurableToolCallInput, SerializableToolMetadata } from '@mastra/core/agent/durable';
import { describe, expect, it } from 'vitest';

import { resolveIterationToolCallConcurrency } from './create-inngest-agentic-workflow';

const tool = (name: string, extra: Partial<SerializableToolMetadata> = {}): SerializableToolMetadata => ({
  id: name,
  name,
  inputSchema: { type: 'object' },
  ...extra,
});

const call = (toolName: string, activeTools?: string[] | null): DurableToolCallInput => ({
  toolCallId: `${toolName}-1`,
  toolName,
  args: {},
  ...(activeTools !== undefined ? { activeTools } : {}),
});

describe('resolveIterationToolCallConcurrency', () => {
  const plain = [tool('a'), tool('b')];

  it('defaults to 10 for a plain tool set', () => {
    expect(resolveIterationToolCallConcurrency(undefined, plain, [call('a'), call('b')])).toBe(10);
  });

  it('honors a configured toolCallConcurrency', () => {
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 3 }, plain, [call('a')])).toBe(3);
  });

  it('ignores a non-positive toolCallConcurrency', () => {
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 0 }, plain, [call('a')])).toBe(10);
  });

  it('forces sequential when the run requires tool approval', () => {
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 5, requireToolApproval: true }, plain, [])).toBe(
      1,
    );
  });

  // The regression this fix exists for: a registered suspending/approval tool the model did NOT
  // call this step must still force sequential — a concurrent sibling would race the suspension.
  it.each([{ hasSuspendSchema: true }, { requireApproval: true }])(
    'forces sequential for a registered %o tool even when it is not called',
    flag => {
      const tools = [tool('a'), tool('danger', flag)];
      expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 5 }, tools, [call('a')])).toBe(1);
    },
  );

  it('stays concurrent when the suspending tool is outside the step active tool set', () => {
    const tools = [tool('a'), tool('b'), tool('danger', { hasSuspendSchema: true })];
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 5 }, tools, [call('a', ['a', 'b'])])).toBe(5);
  });

  it('forces sequential when the suspending tool is inside the step active tool set', () => {
    const tools = [tool('a'), tool('danger', { requireApproval: true })];
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 5 }, tools, [call('a', ['a', 'danger'])])).toBe(
      1,
    );
  });

  it('treats a null activeTools (restriction cleared by a processor) as unrestricted', () => {
    const tools = [tool('a'), tool('danger', { hasSuspendSchema: true })];
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 5 }, tools, [call('a', null)])).toBe(1);
  });

  it('falls back to the configured concurrency when no tool metadata is available', () => {
    expect(resolveIterationToolCallConcurrency({ toolCallConcurrency: 4 }, undefined, [call('a')])).toBe(4);
  });
});
