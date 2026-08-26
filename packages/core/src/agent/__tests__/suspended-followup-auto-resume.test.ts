/**
 * Regression: follow-up messages sent over the signal transport while a run is
 * parked on a GENERIC (non-approval) tool suspension must start a follow-up run
 * instead of stranding in the parked run's pending queue.
 *
 * Studio's chat uses this exact path (enableThreadSignals is on by default):
 *   useChat -> POST /agents/:agentId/send-message -> agent.sendMessage()
 *
 * With `defaultOptions: { autoResumeSuspendedTools: true }` the follow-up
 * message IS the resume mechanism: the fresh run's auto-resume system message
 * instructs the model to re-call the suspended tool with `resumeData` from the
 * user's answer. Previously the message was queued onto the parked run
 * (`pendingSignalsByThread`), which never re-enters a loop iteration, so the
 * model was never called again and the thread stayed blocked until the
 * suspended-run TTL sweep.
 */
import { randomUUID } from 'node:crypto';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';

const nextTick = () => new Promise<void>(resolve => setImmediate(resolve));

async function waitForCondition(predicate: () => boolean, timeoutMs = 3000) {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) throw new Error('Timed out waiting for condition');
    await nextTick();
  }
}

describe('generic tool suspension + signal transport', () => {
  it('starts a follow-up run for a message sent while parked on a generic suspension', async () => {
    let modelCallCount = 0;
    const capturedPrompts: string[] = [];
    const model = new MockLanguageModelV2({
      doStream: async options => {
        modelCallCount++;
        capturedPrompts.push(JSON.stringify((options as any).prompt ?? ''));
        if (modelCallCount === 1) {
          // First call: model calls the tool, which suspends for data.
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'findUserTool',
                input: '{"query":"user by name"}',
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]),
          };
        }
        // Follow-up run (the auto-resume turn).
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'resumed' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });

    const findUserTool = createTool({
      id: 'findUserTool',
      description: 'Finds a user by name',
      inputSchema: z.object({ query: z.string() }),
      suspendSchema: z.object({ message: z.string() }),
      resumeSchema: z.object({ name: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return context?.agent?.suspend({ message: 'Which user should I find?' });
        }
        return { name: context.agent.resumeData.name };
      },
    });

    const memory = new MockMemory();
    const threadId = randomUUID();
    const resourceId = randomUUID();
    await memory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'strand-repro-agent',
      name: 'Strand Repro Agent',
      instructions: 'Test',
      model,
      tools: { findUserTool },
      memory,
      defaultOptions: { autoResumeSuspendedTools: true },
    });

    const subscription = await agent.subscribeToThread({ threadId, resourceId });
    const seenParts: any[] = [];
    const pump = (async () => {
      for await (const part of subscription.stream) seenParts.push(part);
    })().catch(() => {});

    try {
      // Turn 1 (Studio: user sends first message over the signal transport).
      const first = agent.sendMessage('Find the user named Dero Israel', {
        resourceId,
        threadId,
        ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
      });
      await expect(first.accepted).resolves.toMatchObject({ action: 'wake' });

      // Wait until the run parks on the generic suspension.
      await waitForCondition(() => seenParts.some(part => part.type === 'tool-call-suspended'));
      expect(seenParts.some(part => part.type === 'tool-call-approval')).toBe(false);
      const suspendedRunId = agentThreadStreamRuntime.getActiveThreadRunId({ resourceId, threadId });
      expect(suspendedRunId).toBeTruthy();
      // Let the run reach terminal 'suspended' status and the completion watcher
      // settle. Not timing-critical: if the run has not fully parked yet, the
      // follow-up below queues and the watcher's suspended branch hands it over.
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(modelCallCount).toBe(1);

      // Turn 2 (Studio: user answers the tool's question — this must start the
      // auto-resume run instead of stranding in the parked run's queue).
      const followUp = agent.sendMessage('The user is Dero Israel', {
        resourceId,
        threadId,
        ifIdle: { streamOptions: { memory: { resource: resourceId, thread: threadId } } },
      });
      await expect(followUp.accepted).resolves.toMatchObject({ action: 'deliver' });

      // The follow-up run reaches the model with the user's answer...
      await waitForCondition(() => modelCallCount >= 2);
      expect(capturedPrompts[1]).toContain('The user is Dero Israel');
      // ...and nothing is left stranded in the parked run's pending queue.
      expect(agentThreadStreamRuntime.drainPendingSignals(suspendedRunId!)).toHaveLength(0);
    } finally {
      subscription.unsubscribe();
      await Promise.race([pump, nextTick()]);
    }
  });
});
