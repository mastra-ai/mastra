import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { DurableStepIds } from '../constants';
import { createEventedAgent } from '../create-evented-agent';
import { globalRunRegistry } from '../run-registry';

/**
 * An evented agent waiting on a tool approval must not leave the caller's bearer
 * token in its stored workflow snapshots.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/26217
 */

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
  globalRunRegistry.clear();
});

it('does not persist mastra__authToken while an evented agent waits for approval', async () => {
  const model = new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        {
          type: 'tool-call' as const,
          toolCallType: 'function' as const,
          toolCallId: 'call-1',
          toolName: 'deleteFile',
          input: JSON.stringify({ path: 'a.txt' }),
        },
        { type: 'finish' as const, finishReason: 'tool-calls' as const, usage: { inputTokens: 1, outputTokens: 1 } },
      ]),
    }),
  });
  const deleteFile = createTool({
    id: 'deleteFile',
    description: 'Deletes a file',
    inputSchema: z.object({ path: z.string() }),
    requireApproval: true,
    execute: async () => ({ deleted: true }),
  });
  const pubsub = new EventEmitterPubSub();
  const agent = createEventedAgent({
    agent: new Agent({
      id: 'evented-token-agent',
      name: 'evented token agent',
      instructions: 'Delete the file.',
      model: model as LanguageModelV2,
      tools: { deleteFile },
    }),
    pubsub,
  });
  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { agent }, storage, logger: false });
  const workflowsStore = (await storage.getStore('workflows'))!;
  const writes: unknown[] = [];
  for (const method of ['persistWorkflowSnapshot', 'updateWorkflowResults'] as const) {
    const original = workflowsStore[method].bind(workflowsStore) as (args: unknown) => Promise<unknown>;
    vi.spyOn(workflowsStore, method).mockImplementation(async (args: unknown) => {
      writes.push(structuredClone(args));
      return original(args);
    });
  }

  const requestContext = new RequestContext();
  requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'live-bearer-token-of-alice');
  requestContext.set('tenant', 'acme');
  const { runId, cleanup } = await mastra.getAgent('agent').stream('Delete a.txt', { requestContext });

  try {
    await vi.waitFor(
      async () => {
        const run = await workflowsStore.getWorkflowRunById({ runId, workflowName: DurableStepIds.AGENTIC_LOOP });
        const snapshot = typeof run?.snapshot === 'string' ? JSON.parse(run.snapshot) : run?.snapshot;
        expect(snapshot?.status).toBe('suspended');
      },
      { timeout: 10_000 },
    );

    expect(writes.length).toBeGreaterThan(0);
    for (const write of writes) {
      expect(JSON.stringify(write)).not.toContain('live-bearer-token-of-alice');
    }
    const { runs } = await workflowsStore.listWorkflowRuns();
    for (const run of runs) {
      expect(JSON.stringify(run.snapshot)).not.toContain('live-bearer-token-of-alice');
    }
  } finally {
    cleanup();
  }
});
