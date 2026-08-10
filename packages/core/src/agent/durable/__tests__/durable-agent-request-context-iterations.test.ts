/**
 * Regression coverage for #20673.
 *
 * `prepareForDurableExecution` snapshots the caller's RequestContext onto the
 * workflow input as `requestContextEntries`. Any step that cannot use the
 * in-process run registry — an Inngest worker, a recovered run, an evicted
 * registry entry — rebuilds the model and tools from the Mastra instance and
 * restores the caller's context from that snapshot
 * (`resolveRuntimeDependencies` -> `restoreRequestContext`).
 *
 * The snapshot only reached iteration 1. `createBaseIterationStateUpdate`
 * dropped the field when it rebuilt iteration state, and `map-to-llm-input`
 * never forwarded it to the LLM step, so from iteration 2 on the LLM step
 * input carried no snapshot. On a cross-isolate engine there is no run-level
 * context to fall back to either — @mastra/inngest derives the run-level
 * context from `inputData.requestContextEntries` — so dynamic `model`,
 * `tools`, `memory` and `workspace` resolvers silently fell back to defaults
 * with no error raised.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import * as resolveRuntime from '../utils/resolve-runtime';
import { createBaseIterationStateUpdate } from '../workflows/shared/iteration-state';

/**
 * Calls a tool on the first turn and finishes on the second, so the agentic
 * loop runs more than one iteration.
 */
function createTwoIterationModel() {
  let turn = 0;

  return new MockLanguageModelV2({
    doStream: async () => {
      turn += 1;

      if (turn === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'echoTool',
              input: JSON.stringify({ data: 'hello' }),
            },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }

      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('durable agent requestContextEntries across iterations', () => {
  describe('createBaseIterationStateUpdate', () => {
    function buildUpdate(requestContextEntries?: Record<string, unknown>) {
      return createBaseIterationStateUpdate({
        currentState: {
          runId: 'run-1',
          agentId: 'agent-1',
          agentName: 'Agent',
          requestContextEntries,
          iterationCount: 1,
          accumulatedSteps: [],
          accumulatedUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        } as any,
        executionOutput: {
          output: { usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          stepResult: { reason: 'stop' },
          messageListState: {},
          state: {},
        } as any,
      });
    }

    it('carries the request context snapshot into the next iteration state', () => {
      // Without this the snapshot is gone from iteration 2 onwards and every
      // downstream step that reads `getInitData().requestContextEntries`
      // (tool-call, goal, is-task-complete, finalize-run) sees undefined.
      expect(buildUpdate({ tenantId: 'tenant-1' }).requestContextEntries).toEqual({ tenantId: 'tenant-1' });
    });

    it('leaves the snapshot undefined when the run had no request context', () => {
      expect(buildUpdate().requestContextEntries).toBeUndefined();
    });
  });

  describe('LLM step input', () => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      await pubsub.close();
    });

    it('carries the request context snapshot on every iteration', async () => {
      // `resolveRuntimeDependencies` is the seam every durable step goes
      // through to rebuild the model/tools when the registry cannot serve
      // them, and `options.input` is verbatim the step input. Recording what
      // it receives shows exactly what a cross-isolate worker would have to
      // work with.
      const snapshotsSeenBySteps: (Record<string, unknown> | undefined)[] = [];
      const actual = resolveRuntime.resolveRuntimeDependencies;
      vi.spyOn(resolveRuntime, 'resolveRuntimeDependencies').mockImplementation(async options => {
        snapshotsSeenBySteps.push(options.input?.requestContextEntries);
        return actual(options);
      });

      const echoTool = createTool({
        id: 'echoTool',
        description: 'Echoes its input',
        inputSchema: z.object({ data: z.string() }),
        execute: async input => ({ data: input.data }),
      });

      const baseAgent = new Agent({
        id: 'request-context-iterations-agent',
        name: 'Request Context Iterations Agent',
        instructions: 'Use the tool, then answer.',
        model: createTwoIterationModel() as LanguageModelV2,
        tools: { echoTool },
      });

      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
      new Mastra({
        agents: { 'request-context-iterations-agent': durableAgent as any },
        storage: new InMemoryStore(),
        logger: false,
      });

      const requestContext = new RequestContext();
      requestContext.set('tenantId', 'tenant-1');

      const { cleanup } = await durableAgent.stream('Use the tool', { requestContext });
      await new Promise(resolve => setTimeout(resolve, 800));
      cleanup();

      // Two model turns means the loop ran at least twice; every one of those
      // step inputs must carry the caller's snapshot, not just the first.
      expect(snapshotsSeenBySteps.length).toBeGreaterThanOrEqual(2);
      expect(snapshotsSeenBySteps).not.toContain(undefined);
      for (const snapshot of snapshotsSeenBySteps) {
        expect(snapshot).toMatchObject({ tenantId: 'tenant-1' });
      }
    });
  });
});
