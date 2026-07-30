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
  return { toolName, ...(activeTools !== undefined ? { activeTools } : {}) };
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

  it('extracts the limit from the object config form', () => {
    expect(
      resolveDurableToolCallConcurrency({
        options: { toolCallConcurrency: { limit: 6 } },
        toolsMetadata: [tool({ name: 'plain' })],
      }),
    ).toBe(6);
  });

  describe("'called' strategy", () => {
    const meta = [
      tool({ name: 'generate_video' }),
      tool({ name: 'request_approval', hasSuspendSchema: true }),
      tool({ name: 'delete_record', requireApproval: true }),
    ];

    it('stays concurrent when the batch calls only safe tools, even with an approval tool available', () => {
      // activeTools undefined ⇒ whole set available; request_approval/delete_record
      // are available but uncalled ⇒ cannot suspend this step.
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 8, strategy: 'called' } },
          toolsMetadata: meta,
          toolCalls: [call('generate_video'), call('generate_video')],
        }),
      ).toBe(8);
    });

    it('forces sequential when the batch actually calls a suspending tool', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 8, strategy: 'called' } },
          toolsMetadata: meta,
          toolCalls: [call('generate_video'), call('request_approval')],
        }),
      ).toBe(1);
    });

    it('forces sequential when the batch actually calls an approval tool', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 8, strategy: 'called' } },
          toolsMetadata: meta,
          toolCalls: [call('delete_record')],
        }),
      ).toBe(1);
    });

    it('still forces sequential under a global approval policy', () => {
      expect(
        resolveDurableToolCallConcurrency({
          options: { requireToolApproval: true, toolCallConcurrency: { limit: 8, strategy: 'called' } },
          toolsMetadata: meta,
          toolCalls: [call('generate_video')],
        }),
      ).toBe(1);
    });
  });
});
