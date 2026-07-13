import { describe, expect, it } from 'vitest';
import { DurableAgentDefaults } from '../../constants';
import type { SerializableToolMetadata } from '../../types';
import { resolveDurableToolCallConcurrency } from './tool-call-concurrency';

function tool(overrides: Partial<SerializableToolMetadata> & { name: string }): SerializableToolMetadata {
  return {
    id: overrides.name,
    inputSchema: { type: 'object' },
    ...overrides,
  };
}

describe('resolveDurableToolCallConcurrency', () => {
  it('returns the default concurrency when nothing is configured', () => {
    expect(resolveDurableToolCallConcurrency({})).toBe(DurableAgentDefaults.TOOL_CALL_CONCURRENCY);
  });

  it('returns the configured toolCallConcurrency', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [tool({ name: 'plain' })],
      }),
    ).toBe(5);
  });

  it('falls back to the default for non-positive configured values', () => {
    expect(resolveDurableToolCallConcurrency({ options: { toolCallConcurrency: 0 } })).toBe(
      DurableAgentDefaults.TOOL_CALL_CONCURRENCY,
    );
    expect(resolveDurableToolCallConcurrency({ options: { toolCallConcurrency: -3 } })).toBe(
      DurableAgentDefaults.TOOL_CALL_CONCURRENCY,
    );
  });

  it('forces sequential execution when requireToolApproval is set globally', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { requireToolApproval: true, toolCallConcurrency: 10 },
        toolsMetadata: [tool({ name: 'plain' })],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a tool requires approval', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'gated', requireApproval: true })],
      }),
    ).toBe(1);
  });

  it('forces sequential execution when a tool has a suspend schema', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [tool({ name: 'suspending', hasSuspendSchema: true })],
      }),
    ).toBe(1);
  });

  it('ignores approval/suspend flags on tools excluded by activeTools', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 4, activeTools: ['plain'] },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'gated', requireApproval: true })],
      }),
    ).toBe(4);
  });

  it('still forces sequential execution when an active tool requires approval', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 4, activeTools: ['gated'] },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'gated', requireApproval: true })],
      }),
    ).toBe(1);
  });
});
