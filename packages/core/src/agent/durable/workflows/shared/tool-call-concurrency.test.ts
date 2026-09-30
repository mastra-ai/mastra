import { describe, expect, it } from 'vitest';
import { DurableAgentDefaults } from '../../constants';
import type { DurableToolCallInput, SerializableToolMetadata } from '../../types';
import { resolveDurableToolCallConcurrency } from './tool-call-concurrency';

function tool(overrides: Partial<SerializableToolMetadata> & { name: string }): SerializableToolMetadata {
  return {
    id: overrides.name,
    inputSchema: { type: 'object' },
    ...overrides,
  };
}

function call(toolName: string, activeTools?: string[] | null): Pick<DurableToolCallInput, 'activeTools' | 'toolName'> {
  return activeTools !== undefined ? { toolName, activeTools } : { toolName };
}

/**
 * A tool call emitted by the LLM step for a processor-injected tool. The step stamps
 * approval/suspension capability from its effective tool set (issue #24377).
 */
function stampedCall(
  toolName: string,
  flags: Pick<DurableToolCallInput, 'requireApproval' | 'hasSuspendSchema'> = {},
): Pick<DurableToolCallInput, 'toolName' | 'requireApproval' | 'hasSuspendSchema'> {
  return { toolName, ...flags };
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

  // The check is against the step's effective active tool set, NOT the tools the model actually
  // called: a registered suspending/approval tool the model skipped this step must still force
  // sequential — a concurrently-running sibling tool would race the suspension.
  it.each([{ hasSuspendSchema: true }, { requireApproval: true }])(
    'forces sequential for a registered %o tool even when it is not called',
    flag => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: 5 },
          toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'danger', ...flag })],
          toolCalls: [call('plain')],
        }),
      ).toBe(1);
    },
  );

  it('stays concurrent when the suspending tool is outside the step active tool set', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [tool({ name: 'a' }), tool({ name: 'b' }), tool({ name: 'danger', hasSuspendSchema: true })],
        toolCalls: [call('a', ['a', 'b'])],
      }),
    ).toBe(5);
  });

  it('forces sequential when the suspending tool is inside the step active tool set', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [tool({ name: 'a' }), tool({ name: 'danger', requireApproval: true })],
        toolCalls: [call('a', ['a', 'danger'])],
      }),
    ).toBe(1);
  });

  it('treats a null activeTools stamp (restriction cleared by a processor) as unrestricted', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5, activeTools: ['a'] },
        toolsMetadata: [tool({ name: 'a' }), tool({ name: 'danger', hasSuspendSchema: true })],
        toolCalls: [call('a', null)],
      }),
    ).toBe(1);
  });

  it('prefers the per-step activeTools stamp over the run-level activeTools option', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5, activeTools: ['danger'] },
        toolsMetadata: [tool({ name: 'a' }), tool({ name: 'danger', hasSuspendSchema: true })],
        toolCalls: [call('a', ['a'])],
      }),
    ).toBe(5);
  });

  it('falls back to the configured concurrency when no tool metadata is available', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 4 },
        toolCalls: [call('a')],
      }),
    ).toBe(4);
  });

  describe('step-stamped capability flags (issue #24377)', () => {
    it('forces sequential execution for a stamped approval tool absent from run metadata', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: 10 },
          toolsMetadata: [tool({ name: 'plain' })],
          toolCalls: [stampedCall('processor_injected', { requireApproval: true })],
        }),
      ).toBe(1);
    });

    it('forces sequential execution for a stamped suspend-capable tool', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: 10 },
          toolsMetadata: [],
          toolCalls: [stampedCall('processor_injected', { hasSuspendSchema: true })],
        }),
      ).toBe(1);
    });

    it('still parallelizes a batch with no stamped capability flags', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: 10 },
          toolsMetadata: [tool({ name: 'a' })],
          toolCalls: [stampedCall('a')],
        }),
      ).toBe(10);
    });

    it('overrides the called strategy when a called tool is stamped approval-capable', () => {
      // `strategy: 'called'` only narrows which tools are considered; an approval tool
      // that WAS called still has to serialize.
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [],
          toolCalls: [stampedCall('a'), stampedCall('approval', { requireApproval: true })],
        }),
      ).toBe(1);
    });

    it('ignores stamps on sibling calls the model did not make', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 4, strategy: 'called' } },
          toolsMetadata: [],
          toolCalls: [stampedCall('a'), stampedCall('b')],
        }),
      ).toBe(4);
    });
  });

  describe("strategy: 'called'", () => {
    function calledCall(toolName: string): Pick<DurableToolCallInput, 'toolName'> {
      return { toolName };
    }

    it('parallelizes a pure-safe batch even when a suspend/approval tool is registered', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [tool({ name: 'a' }), tool({ name: 'b' }), tool({ name: 'danger', hasSuspendSchema: true })],
          toolCalls: [calledCall('a'), calledCall('b')],
        }),
      ).toBe(5);
    });

    it('serializes a batch that actually called a suspend tool', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [tool({ name: 'a' }), tool({ name: 'danger', hasSuspendSchema: true })],
          toolCalls: [calledCall('a'), calledCall('danger')],
        }),
      ).toBe(1);
    });

    it('serializes a batch that actually called an approval tool', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [tool({ name: 'a' }), tool({ name: 'gated', requireApproval: true })],
          toolCalls: [calledCall('gated')],
        }),
      ).toBe(1);
    });

    it('still forces sequential when run-wide requireToolApproval is set', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { requireToolApproval: true, toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [tool({ name: 'a' })],
          toolCalls: [calledCall('a')],
        }),
      ).toBe(1);
    });
  });
});
