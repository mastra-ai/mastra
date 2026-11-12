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
 * suspension capability from its effective tool set (issue #24377).
 */
function stampedCall(
  toolName: string,
  flags: Pick<DurableToolCallInput, 'hasSuspendSchema'> = {},
): Pick<DurableToolCallInput, 'toolName' | 'hasSuspendSchema'> {
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

  // Approval never serializes: gated calls park at their gates together and are
  // resumed one toolCallId at a time (#30152). The serialized options carry a
  // `true` shadow for function-form policies, so both forms are covered here.
  it('does not force sequential execution for run-wide requireToolApproval', () => {
    const options = { requireToolApproval: true, toolCallConcurrency: 10 };
    expect(
      resolveDurableToolCallConcurrency({
        options,
        toolsMetadata: [tool({ name: 'plain' })],
      }),
    ).toBe(10);
  });

  it('does not force sequential execution when a tool requires approval', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'gated', requireApproval: true })],
      }),
    ).toBe(10);
  });

  it('forces sequential execution when a tool has a suspend schema', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 10 },
        toolsMetadata: [tool({ name: 'suspending', hasSuspendSchema: true })],
      }),
    ).toBe(1);
  });

  it('ignores suspend flags on tools excluded by activeTools', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 4, activeTools: ['plain'] },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'suspending', hasSuspendSchema: true })],
      }),
    ).toBe(4);
  });

  it('keeps the configured concurrency when an active tool requires approval', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 4, activeTools: ['gated'] },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'gated', requireApproval: true })],
      }),
    ).toBe(4);
  });

  // The check is against the step's effective active tool set, NOT the tools the model actually
  // called: a registered suspending tool the model skipped this step must still force
  // sequential — a concurrently-running sibling tool would race the suspension.
  it('forces sequential for a registered suspending tool even when it is not called', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: 5 },
        toolsMetadata: [tool({ name: 'plain' }), tool({ name: 'danger', hasSuspendSchema: true })],
        toolCalls: [call('plain')],
      }),
    ).toBe(1);
  });

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
        toolsMetadata: [tool({ name: 'a' }), tool({ name: 'danger', hasSuspendSchema: true })],
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

  describe('step-stamped suspension flags (issue #24377)', () => {
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

    it('overrides the called strategy when a called tool is stamped suspend-capable', () => {
      // `strategy: 'called'` only narrows which tools are considered; a suspend-capable
      // tool that WAS called still has to serialize.
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [],
          toolCalls: [stampedCall('a'), stampedCall('suspending', { hasSuspendSchema: true })],
        }),
      ).toBe(1);
    });

    it('keeps the configured limit when no called tool is stamped', () => {
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

    it('parallelizes a pure-safe batch even when a suspend tool is registered', () => {
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

    it('parallelizes a batch that called an approval tool (#30152)', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 5, strategy: 'called' } },
          toolsMetadata: [tool({ name: 'a' }), tool({ name: 'gated', requireApproval: true })],
          toolCalls: [calledCall('a'), calledCall('gated')],
        }),
      ).toBe(5);
    });
  });
});
