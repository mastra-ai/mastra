import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../agent';
import { prepareForDurableExecution } from '../preparation';

const model = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    content: [],
    warnings: [],
  }),
});

const blockingGuardrails = {
  privacy: {
    secrets: { action: 'block' as const, applyTo: 'input' as const },
  },
};

describe('DurableAgent guardrails', () => {
  it('compiles per-call guardrails into durable input processors', async () => {
    const agent = new Agent({
      id: 'durable-guardrails-agent',
      name: 'Durable Guardrails Agent',
      instructions: 'test',
      model,
    });

    const result = await prepareForDurableExecution({
      agent,
      messages: 'api_key = abcdefghijklmnopqrstuvwxyz',
      options: { guardrails: blockingGuardrails },
    });

    expect(result.registryEntry.tripwire).toEqual(
      expect.objectContaining({
        reason: expect.stringContaining('Regex filter: blocked content matching patterns: api-key'),
      }),
    );
  });

  it('lets per-call guardrails replace agent-level guardrails', async () => {
    const agent = new Agent({
      id: 'durable-guardrails-override-agent',
      name: 'Durable Guardrails Override Agent',
      instructions: 'test',
      model,
      guardrails: blockingGuardrails,
    });

    const result = await prepareForDurableExecution({
      agent,
      messages: 'api_key = abcdefghijklmnopqrstuvwxyz',
      options: { guardrails: false },
    });

    expect(result.registryEntry.tripwire).toBeUndefined();
  });

  it('fails preparation when per-call guardrail compilation fails', async () => {
    const agent = new Agent({
      id: 'durable-invalid-guardrails-agent',
      name: 'Durable Invalid Guardrails Agent',
      instructions: 'test',
      model,
    });

    await expect(
      prepareForDurableExecution({
        agent,
        messages: 'hello',
        options: {
          guardrails: {
            content: { moderation: { action: 'redact' as any } },
          },
        },
      }),
    ).rejects.toThrow(/content\.moderation does not support action "redact"/);
  });
});
