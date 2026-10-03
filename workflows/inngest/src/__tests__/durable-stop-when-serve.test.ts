/**
 * Regression test for #25851: the Inngest agentic loop never evaluated `stopWhen`.
 *
 * The mock model calls a tool on every turn, so without `stopWhen` the loop would
 * run until `maxSteps`. The predicate stops after the second step, so the first (false) evaluation is replayed on later requests. The predicate is
 * evaluated inside a memoized Inngest step, so serve-mode replays must not call it
 * again — it should run exactly once per evaluated iteration.
 */
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { simulateReadableStream } from 'ai';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { createInngestAgent } from '../durable-agent';
import {
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

vi.setConfig({ testTimeout: 150_000, hookTimeout: 90_000 });

const STREAM_TIMEOUT_MS = 60_000;

function alwaysToolCallingModel(onCall: () => void): any {
  let callIndex = 0;
  return {
    specificationVersion: 'v2',
    provider: 'mock',
    modelId: 'stop-when-model',
    supportedUrls: {},
    async doGenerate() {
      throw new Error('doGenerate not used');
    },
    async doStream() {
      onCall();
      const toolCallId = `call-${callIndex++}`;
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `resp-${toolCallId}`, modelId: 'stop-when-model', timestamp: new Date(0) },
            { type: 'tool-call', toolCallId, toolName: 'ping', input: '{}' },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
            },
          ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  };
}

describe('Inngest agent stopWhen (#25851)', () => {
  beforeAll(async () => {
    await setupSharedTestInfrastructure();
  });

  afterAll(async () => {
    await teardownSharedTestInfrastructure();
  });

  it('stops the loop when stopWhen returns true and evaluates the predicate once per iteration', async () => {
    let modelCalls = 0;
    const agent = new Agent({
      id: `stop-when-agent-${Date.now()}`,
      name: 'Stop When Agent',
      instructions: 'Call ping.',
      model: alwaysToolCallingModel(() => modelCalls++),
      tools: {
        ping: createTool({
          id: 'ping',
          description: 'ping',
          inputSchema: z.object({}),
          execute: async () => ({ ok: true }),
        }),
      },
    });

    const inngestAgent = createInngestAgent({ agent, inngest: getSharedInngest() });
    getSharedMastra().addAgent(inngestAgent);

    const predicateStepCounts: number[] = [];
    const result = await inngestAgent.stream([{ role: 'user', content: 'Go.' }], {
      maxSteps: 5,
      stopWhen: ({ steps }) => {
        predicateStepCounts.push(steps.length);
        return steps.length >= 2;
      },
    });

    let finishReceived = false;
    let timedOut = false;
    try {
      await Promise.race([
        (async () => {
          for await (const chunk of result.output.fullStream) {
            if ((chunk as any)?.type === 'finish') finishReceived = true;
          }
        })(),
        new Promise<void>(resolve =>
          setTimeout(() => {
            timedOut = true;
            resolve();
          }, STREAM_TIMEOUT_MS),
        ),
      ]);
    } finally {
      result.cleanup();
    }

    expect(timedOut).toBe(false);
    expect(finishReceived).toBe(true);
    expect(modelCalls).toBe(2);
    expect(predicateStepCounts).toEqual([1, 2]);
  });
});
