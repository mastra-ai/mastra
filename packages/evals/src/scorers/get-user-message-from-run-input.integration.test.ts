import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import type { ScorerRunInputForAgent } from '@mastra/core/evals';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach } from 'vitest';
import { getUserMessageFromRunInput } from './utils';

/**
 * Behaviour: a scorer attached to an agent must receive the original user
 * message regardless of how the run was started.
 *
 * Regression guard for the subscription / sendMessage path: messages sent via
 * `agent.subscribeToThread` + `agent.sendMessage` are persisted as `role: 'signal'`
 * (carrying the user role on `metadata.signal`), not `role: 'user'`. The earlier
 * helper filtered strictly on `role === 'user'`, so scorers on that path saw an
 * empty user message. This test drives the real subscription path end-to-end so
 * the regression is caught at the actual call site, not just against a hand-built
 * message shape.
 */

function createTextStreamModel(responseText: string) {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      content: [{ type: 'text' as const, text: responseText }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        },
      ]),
    }),
  });
}

/** Reads run parts off a subscription stream until the run finishes. */
async function drainRun(iterator: AsyncIterator<any>): Promise<void> {
  while (true) {
    const next = await iterator.next();
    if (next.done) return;
    const part = next.value;
    if (part.type === 'finish' || part.type === 'error' || part.type === 'abort') {
      return;
    }
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

describe('getUserMessageFromRunInput — scorer integration', () => {
  const USER_MESSAGE = 'What is the capital of France?';

  // Captures what the scorer extracts at its real call site.
  let capturedInput: ScorerRunInputForAgent | undefined;
  let extractedUserMessage: string | undefined;

  beforeEach(() => {
    capturedInput = undefined;
    extractedUserMessage = undefined;
  });

  // Registers an agent + scorer on a Mastra instance with in-memory storage.
  // The Mastra registration is required: it installs the ON_SCORER_RUN hook
  // handler that actually executes the scorer pipeline (and needs storage to
  // run), and lets the hook resolve the scorer back to this agent.
  function buildAgent(id: string) {
    const scorerId = `${id}-capture-scorer`;
    const captureScorer = createScorer({
      id: scorerId,
      name: scorerId,
      description: 'Captures the user message the scorer sees from run input',
    }).generateScore(({ run }) => {
      capturedInput = run.input;
      extractedUserMessage = getUserMessageFromRunInput(run.input);
      return 1;
    });

    const agent = new Agent({
      id,
      name: id,
      instructions: 'You are a helpful assistant.',
      model: createTextStreamModel('Paris.'),
      scorers: { capture: { scorer: captureScorer } },
    });

    new Mastra({
      logger: false,
      storage: new InMemoryStore(),
      agents: { [id]: agent },
      scorers: { [scorerId]: captureScorer },
    });

    return agent;
  }

  describe('when a run is started via agent.generate', () => {
    it('then the scorer receives the original user message', async () => {
      // Given an agent with a scorer that extracts the user message
      const agent = buildAgent('generate-agent');

      // When the agent answers a direct generate() call
      await agent.generate(USER_MESSAGE);

      // Then the scorer extracts the original user message
      await waitFor(() => extractedUserMessage !== undefined);
      expect(extractedUserMessage).toBe(USER_MESSAGE);
    });
  });

  describe('when a run is started via subscribeToThread + sendMessage', () => {
    it('then the scorer receives the original user message (not an empty string)', async () => {
      // Given an agent subscribed to an idle thread
      const agent = buildAgent('subscription-agent');
      const subscription = await agent.subscribeToThread({
        threadId: 'sub-thread',
        resourceId: 'sub-user',
      });
      const drained = drainRun(subscription.stream[Symbol.asyncIterator]());

      // When a user message is delivered through sendMessage (persisted as a signal)
      const result = agent.sendMessage(
        { contents: USER_MESSAGE },
        {
          resourceId: 'sub-user',
          threadId: 'sub-thread',
          ifIdle: { streamOptions: { memory: { resource: 'sub-user', thread: 'sub-thread' } } },
        },
      );
      await result.accepted;
      await drained;

      // Then, once the scorer has run on this subscription input...
      await waitFor(() => capturedInput !== undefined, 8000);
      subscription.unsubscribe();

      // ...the input is the signal-role shape produced by the subscription path...
      expect(capturedInput?.inputMessages?.some(m => (m as { role?: string }).role === 'signal')).toBe(true);
      // ...and the helper recovers the original user text from it (the regression
      // returned an empty / undefined value here).
      expect(extractedUserMessage).toBe(USER_MESSAGE);
    }, 15000);
  });
});
