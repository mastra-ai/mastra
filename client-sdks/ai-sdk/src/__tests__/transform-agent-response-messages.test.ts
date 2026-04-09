import { describe, expect, it } from 'vitest';

import { transformAgent } from '../transformers';

/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/15051
 *
 * In nested agent setups, the `data-tool-agent` event had empty
 * `response.messages` (and per-step `steps[i].response.messages`).
 *
 * Root cause: the `finish` and `step-finish` payloads originate from
 * `LLMIterationData`, which has no `response` field. `transformAgent` tried
 * to read `payload.payload.response?.messages` — always `undefined` — and
 * fell back to the initial `[]` set in the `start` case.
 *
 * Fix: fall back to `payload.payload.messages?.nonUser`, which IS present in
 * `LLMIterationData` and carries the accumulated model-format response
 * messages from the sub-agent run.
 */
describe('transformAgent response.messages (issue #15051)', () => {
  function makePayload(type: string, runId: string, payload: any) {
    return { type, runId, payload } as any;
  }

  const mockAssistantMessage = {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Hello from sub-agent' },
      { type: 'tool-call', toolCallId: 'call-1', toolName: 'search', args: { q: 'test' } },
    ],
  };

  it('finish event should populate response.messages from messages.nonUser when response field is absent', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run';

    transformAgent(makePayload('start', runId, { id: 'sub-agent' }), bufferedSteps);

    // Simulate a finish payload from LLMIterationData (no `response` field,
    // but has `messages.nonUser` with accumulated model-format messages).
    const finishResult = transformAgent(
      makePayload('finish', runId, {
        stepResult: { reason: 'stop', warnings: [] },
        output: { usage: { inputTokens: 50, outputTokens: 20, totalTokens: 70 } },
        metadata: { modelId: 'gpt-4o', timestamp: new Date() },
        messages: {
          all: [{ role: 'user', content: 'hi' }, mockAssistantMessage],
          user: [{ role: 'user', content: 'hi' }],
          nonUser: [mockAssistantMessage],
        },
        // No `response` field — mirrors the actual LLMIterationData structure
      }),
      bufferedSteps,
    );

    expect(finishResult).not.toBeNull();
    expect(finishResult!.data.response.messages).toHaveLength(1);
    expect(finishResult!.data.response.messages[0]).toEqual(mockAssistantMessage);
  });

  it('finish event with explicit response.messages should use those over messages.nonUser', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run-2';

    transformAgent(makePayload('start', runId, { id: 'sub-agent' }), bufferedSteps);

    const explicitMessage = { role: 'assistant', content: [{ type: 'text', text: 'Explicit' }] };

    const finishResult = transformAgent(
      makePayload('finish', runId, {
        stepResult: { reason: 'stop', warnings: [] },
        output: { usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        metadata: {},
        // Both `response.messages` and `messages.nonUser` present — `response.messages` wins
        response: { messages: [explicitMessage] },
        messages: {
          all: [mockAssistantMessage],
          user: [],
          nonUser: [mockAssistantMessage],
        },
      }),
      bufferedSteps,
    );

    expect(finishResult!.data.response.messages).toHaveLength(1);
    expect(finishResult!.data.response.messages[0]).toEqual(explicitMessage);
  });

  it('step-finish event should populate response.messages from messages.nonUser when response field is absent', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run-3';

    transformAgent(makePayload('start', runId, { id: 'sub-agent' }), bufferedSteps);
    transformAgent(makePayload('text-delta', runId, { text: 'thinking...' }), bufferedSteps);

    const stepFinishResult = transformAgent(
      makePayload('step-finish', runId, {
        id: 'step-0',
        stepResult: { reason: 'stop', warnings: [] },
        output: { usage: { inputTokens: 30, outputTokens: 10, totalTokens: 40 } },
        metadata: { timestamp: new Date(), modelId: 'gpt-4o' },
        // `messages.nonUser` present but no `response` field (LLMIterationData shape)
        messages: {
          all: [{ role: 'user', content: 'q' }, mockAssistantMessage],
          user: [{ role: 'user', content: 'q' }],
          nonUser: [mockAssistantMessage],
        },
      }),
      bufferedSteps,
    );

    expect(stepFinishResult).not.toBeNull();
    const step = stepFinishResult!.data.steps[0];
    expect(step.response.messages).toHaveLength(1);
    expect(step.response.messages[0]).toEqual(mockAssistantMessage);
  });

  it('finish event should have empty response.messages when neither response nor messages.nonUser is present', () => {
    const bufferedSteps = new Map<string, any>();
    const runId = 'sub-agent-run-4';

    transformAgent(makePayload('start', runId, { id: 'sub-agent' }), bufferedSteps);

    const finishResult = transformAgent(
      makePayload('finish', runId, {
        stepResult: { reason: 'stop', warnings: [] },
        output: { usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 } },
        metadata: {},
      }),
      bufferedSteps,
    );

    expect(finishResult!.data.response.messages).toEqual([]);
  });
});
