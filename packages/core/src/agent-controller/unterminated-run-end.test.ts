import { APICallError } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

// Issue #26007: a run whose model stream stops mid-work (no `finish` chunk, no error)
// must not be reported as `agent_end { reason: 'complete' }` — Factory's dispatcher maps
// `complete` to a `succeeded` invokeSkill decision.
function createTruncatedStreamModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Writing the plan now' },
        // Stream closes here: no text-end, no finish, no error.
      ]),
    }),
  });
}

function createFinishedStreamModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'Done' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

function createOverloadedModel() {
  return new MockLanguageModelV2({
    doStream: async () => {
      throw new APICallError({
        message: 'Overloaded',
        url: 'https://example.invalid',
        requestBodyValues: {},
        statusCode: 529,
        isRetryable: false,
      });
    },
  });
}

async function runOnce(model: MockLanguageModelV2) {
  const agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'You are a test agent.', model });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage: new InMemoryStore(),
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 's', ownerId: 'o' });

  const endReasons: unknown[] = [];
  const errors: unknown[] = [];
  session.subscribe(event => {
    if (event.type === 'agent_end') endReasons.push(event.reason);
    if (event.type === 'error') errors.push(event.error);
  });

  const settled = await Promise.race([
    session
      .sendMessage({ content: 'plan it' })
      .catch(() => {})
      .then(() => true),
    new Promise<false>(r => setTimeout(() => r(false), 5_000)),
  ]);
  expect(settled).toBe(true);
  return { endReasons, errors };
}

describe('unterminated run end (#26007)', () => {
  it('does not report complete when the model stream ends without a finish chunk', async () => {
    const { endReasons, errors } = await runOnce(createTruncatedStreamModel());

    expect(endReasons).toEqual(['error']);
    expect(errors).toHaveLength(1);
    expect((errors[0] as Error).message).toBe(
      'The model stream ended without a finish reason before producing a final response.',
    );
  });

  it('still reports complete when the model finishes with stop', async () => {
    const { endReasons, errors } = await runOnce(createFinishedStreamModel());

    expect(endReasons).toEqual(['complete']);
    expect(errors).toEqual([]);
  });

  // Guard: a thrown provider error already took the error path before #26007 and must keep it.
  it('reports error when the provider throws', async () => {
    const { endReasons, errors } = await runOnce(createOverloadedModel());

    expect(endReasons).toEqual(['error']);
    expect(errors.length).toBeGreaterThan(0);
  });
});
