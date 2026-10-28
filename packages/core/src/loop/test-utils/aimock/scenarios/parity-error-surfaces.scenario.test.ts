/**
 * Ported from validation harness case T37 (error-surfaces).
 *
 * The harness case has three variants:
 *   - model-4xx: the model fails before producing any output (an up-front,
 *     non-retryable provider error).
 *   - stream-cut: the model streams one text delta, then the stream errors.
 *   - tool-timeout: the total budget closes a run even if its tool never returns.
 *
 * Harness exclusions: error message wording, and retry timing (T27).
 *
 * `stream-cut` runs in parity mode (`expectParity`). COR-1417 made a failed run
 * recordable: the chunks that arrived before the failure are kept and compared,
 * and the failure itself is compared as `{ name, message }` (never `stack`, which
 * embeds a checkout-specific path), so the variant needs no declared difference.
 *
 * `model-4xx` now runs in parity mode (`expectParity`): COR-1429 makes the stale
 * check scenario-aware, so its matching `finish.stepResult` does not make the
 * unrelated COR-1390 finish declaration fail before comparison.
 */

import { it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import { MessageHistory } from '../../../../processors/memory';
import type { RequestContext } from '../../../../request-context';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import {
  type EngineParityScenario,
  type EngineParityResults,
  type ModelScript,
  type ParityTarget,
  describeParity,
  expectParity,
} from '../parity';

const THREAD = 'thread-t37';
const RESOURCE = 'resource-t37';

/** The model fails before producing any output. */
const MODEL_4XX: ModelScript = {
  respond: () => {
    throw new Error('T37 model 400');
  },
};

/** The model streams one text delta, then the stream errors. */
const STREAM_CUT: ModelScript = {
  respond: () => [
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'parity-id-0', modelId: 'parity-model', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: 'partial ' },
    { type: 'error', error: new Error('T37 stream cut') },
  ],
};

/** One turn of `input` on plain and `target`. */
function scenario(target: ParityTarget, model: ModelScript): Omit<EngineParityScenario, 'engines'> {
  return {
    model,
    buildAgent: ({ model: recordingModel }) =>
      new Agent({
        id: 't37-agent',
        name: 'T37 Agent',
        instructions: 'Follow the script.',
        model: recordingModel,
        // The case asserts the first failure, not a retry sequence.
        maxRetries: 0,
        memory: new MockMemory(),
      }),
    input: 'Go.',
    options: { memory: { thread: THREAD, resource: RESOURCE } },
  };
}

/** Plain's and `target`'s snapshot for the scenario's single turn. */
function turnsByEngine(target: ParityTarget, results: EngineParityResults) {
  return (['plain', target] as const).map(engine => ({ engine, turn: results[engine]!.turns[0]! }));
}

describeForAllEngines('error-surfaces: tool-timeout', engine => {
  const getMock = useLoopScenarioAimock();
  // Every Inngest step is a round trip through the dev server, so a run needs
  // more than 500ms just to reach its tool.
  const DEADLINE_MS = engine === 'inngest' ? 2_500 : 500;
  const TEST_TIMEOUT_MS = engine === 'inngest' ? 15_000 : 5_000;

  it.each([false, true])(
    'closes a stuck tool run without flushing unfinished-step memory (save blocked: %s)',
    async blockSave => {
      const onError = vi.fn();
      let toolStarted = false;
      const execution = Promise.withResolvers<unknown>();
      const onOutput = vi.fn();
      const memory = new MockMemory();
      let releaseSave!: () => void;
      const saveGate = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      let saveBlocked = false;
      const saveMessages = memory.saveMessages.bind(memory);
      const saveSpy = vi.spyOn(memory, 'saveMessages').mockImplementation(async args => {
        if (blockSave && toolStarted && args.messages.some(message => message.role === 'assistant')) {
          saveBlocked = true;
          await saveGate;
        }
        return saveMessages(args);
      });
      try {
        const result = await runLoopScenario({
          engine,
          memory,
          threadId: THREAD,
          resourceId: RESOURCE,
          llm: getMock(),
          prompt: 'Call the hanging tool.',
          tools: {
            hanging: createTool({
              id: 'hanging',
              description: 'A tool that ignores cancellation and never returns.',
              inputSchema: z.object({}),
              execute: async () => {
                toolStarted = true;
                return execution.promise;
              },
              onOutput,
            }),
          },
          modelSettings: { timeout: { totalMs: DEADLINE_MS } },
          onError,
          collectChunks: true,
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              {
                toolCalls: [{ id: 'call_hanging', name: 'hanging', arguments: {} }],
              },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Must not reach the model again.' });
          },
        });

        expect(toolStarted).toBe(true);
        const errors = result.chunks!.filter(chunk => chunk.type === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0]!.payload.error).toMatchObject({
          name: 'MastraTimeoutError',
          message: `Agent execution timed out after ${DEADLINE_MS}ms (modelSettings.timeout.totalMs)`,
        });
        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(result.chunks!.some(chunk => chunk.type === 'finish')).toBe(false);
        expect(result.requests).toHaveLength(1);
        const workflows = await result.mastra.getStorage()!.getStore('workflows');
        const durable = engine === 'durable' || engine === 'evented' || engine === 'inngest';
        const prefix = engine === 'inngest' ? 'inngest:' : '';
        for (const name of durable
          ? ['durable-agentic-loop', 'durable-agentic-execution']
          : ['agentic-loop', 'executionWorkflow']) {
          await expect
            .poll(async () => {
              const snapshot = await workflows!.loadWorkflowSnapshot({
                workflowName: `${prefix}${name}`,
                runId: result.output.runId,
              });
              return snapshot?.status;
            })
            .not.toBe('running');
        }
        execution.reject(new Error('tool failed after the total deadline'));
        await new Promise<void>(resolve => setImmediate(resolve));
        expect(onOutput).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledTimes(1);
        if (blockSave && (engine === 'durable' || engine === 'evented')) {
          await new Promise(resolve => setTimeout(resolve, 50));
          expect(saveBlocked).toBe(false);
        }
      } finally {
        execution.resolve(undefined);
        releaseSave();
        saveSpy.mockRestore();
      }
    },
    TEST_TIMEOUT_MS,
  );

  it.each([
    { savePerStep: false, readOnly: false },
    { savePerStep: true, readOnly: false },
    { savePerStep: false, readOnly: true },
    // History disabled in config, but the agent saves through an explicitly configured MessageHistory.
    { savePerStep: false, readOnly: false, explicitHistory: true },
    // Same, but that MessageHistory writes to its own store, not the agent memory store.
    { savePerStep: false, readOnly: false, explicitHistory: true, historyStore: true },
    // Same, but the agent picks MessageHistory from requestContext, and a tool changes that context
    // mid-run. The deadline save must use the processors the run started with.
    { savePerStep: false, readOnly: false, dynamicHistory: true },
    // A custom processor takes the message-history id, so memory adds no MessageHistory and the
    // finish path would not save to agent memory. The deadline save must not either.
    { savePerStep: false, readOnly: false, customHistory: true },
    // History disabled in config and no MessageHistory configured, so the finish path saves nothing.
    // The deadline save must not either.
    { savePerStep: false, readOnly: false, historyOff: true },
  ])(
    'only completed steps reach memory at the deadline (savePerStep: $savePerStep, readOnly: $readOnly, explicitHistory: $explicitHistory, dynamicHistory: $dynamicHistory, historyStore: $historyStore, customHistory: $customHistory, historyOff: $historyOff)',
    async ({ savePerStep, readOnly, explicitHistory, dynamicHistory, historyStore, customHistory, historyOff }) => {
      const memory = new MockMemory();
      const historyMemory = historyStore ? new MockMemory() : memory;
      const threadId = `deadline-memory-${engine}-${savePerStep}-${readOnly}-${!!explicitHistory}-${!!dynamicHistory}-${!!historyStore}-${!!customHistory}-${!!historyOff}`;
      const resourceId = RESOURCE;
      const llm = getMock();
      let completedTool = false;
      let hangingTool = false;
      const result = await runLoopScenario({
        engine,
        llm,
        memory,
        threadId,
        resourceId,
        prompt: 'Look up the order, then check the courier.',
        maxSteps: 3,
        savePerStep,
        ...(readOnly && { memoryOptions: { readOnly } }),
        ...(explicitHistory && {
          memoryOptions: { lastMessages: false },
          outputProcessors: [new MessageHistory({ storage: (await historyMemory.storage.getStore('memory'))! })],
        }),
        ...(dynamicHistory && {
          memoryOptions: { lastMessages: false },
          agentOutputProcessors: async ({ requestContext }: { requestContext: RequestContext }) =>
            requestContext.get('history') === 'off'
              ? []
              : [new MessageHistory({ storage: (await memory.storage.getStore('memory'))! })],
        }),
        ...(historyOff && { memoryOptions: { lastMessages: false } }),
        ...(customHistory && {
          outputProcessors: [{ id: 'message-history', processOutputResult: ({ messages }: any) => messages }],
        }),
        modelSettings: { timeout: { totalMs: DEADLINE_MS } },
        collectChunks: true,
        tools: {
          lookup: createTool({
            id: 'lookup',
            description: 'Look up an order.',
            inputSchema: z.object({}),
            execute: async (_input, context) => {
              context?.requestContext?.set('history', 'off');
              completedTool = true;
              return { status: 'shipped' };
            },
          }),
          courier: createTool({
            id: 'courier',
            description: 'Check the courier.',
            inputSchema: z.object({}),
            execute: async () => {
              hangingTool = true;
              return new Promise<never>(() => {});
            },
          }),
        },
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              content: 'The order lookup is complete.',
              toolCalls: [{ id: 'call_lookup', name: 'lookup', arguments: {} }],
            },
          );
          llm.on(
            { endpoint: 'chat', hasToolResult: true },
            {
              content: 'Checking the courier now.',
              toolCalls: [{ id: 'call_courier', name: 'courier', arguments: {} }],
            },
          );
        },
      });

      expect(completedTool).toBe(true);
      expect(hangingTool).toBe(true);
      expect(result.requests).toHaveLength(2);
      const errors = result.chunks!.filter(chunk => chunk.type === 'error');
      expect(errors).toHaveLength(1);
      expect(errors[0]!.payload.error).toMatchObject({ name: 'MastraTimeoutError' });
      const { messages } = await historyMemory.recall({ threadId, resourceId });
      const saved = JSON.stringify(messages);
      // Durable and evented persist the input through agent memory regardless of the configured
      // MessageHistory or lastMessages. Inngest saves nothing at the deadline beyond the savePerStep
      // flush. Both predate this test and are out of scope here.
      const durable = engine === 'durable' || engine === 'evented';
      const inputSaved =
        !readOnly &&
        (engine === 'inngest'
          ? savePerStep
          : !(historyStore && durable) && !((customHistory || historyOff) && !durable));
      expect(saved.includes('Look up the order, then check the courier.')).toBe(inputSaved);
      expect(saved.includes('The order lookup is complete.')).toBe(savePerStep && !readOnly);
      expect(saved.includes('Checking the courier now.')).toBe(false);
    },
    TEST_TIMEOUT_MS,
  );

  it.each(['generate', 'resumeStream', 'resumeGenerate'] as const)(
    '%s settles at the deadline without waiting for the tool',
    async method => {
      const onError = vi.fn();
      let toolStarted = false;
      let releaseTool!: () => void;
      const toolGate = new Promise<void>(resolve => {
        releaseTool = resolve;
      });
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', hasToolResult: false },
        {
          toolCalls: [{ id: 'call_hanging', name: 'hanging', arguments: {} }],
        },
      );
      llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Must not reach the model again.' });
      const shared = await createSharedAgent(llm, {
        engine,
        memory: new MockMemory(),
        tools: {
          hanging: createTool({
            id: 'hanging',
            description: 'Waits forever after optional suspension.',
            inputSchema: z.object({}),
            resumeSchema: z.object({ proceed: z.boolean() }),
            suspendSchema: z.object({}),
            execute: async (_input, context) => {
              if (method !== 'generate' && !context?.agent?.resumeData) {
                return context?.agent?.suspend({});
              }
              toolStarted = true;
              await toolGate;
              return { completed: true };
            },
          }),
        },
      });
      const options = { modelSettings: { timeout: { totalMs: DEADLINE_MS } }, onError };
      try {
        if (method === 'generate') {
          await expect(shared.agent.generate('Call the hanging tool.', options)).rejects.toMatchObject({
            name: 'MastraTimeoutError',
          });
        } else {
          const suspended = await shared.agent.generate('Call the hanging tool.');
          expect(suspended.finishReason).toBe('suspended');
          const resumeOptions = { ...options, runId: suspended.runId };
          if (method === 'resumeGenerate') {
            await expect(shared.agent.resumeGenerate({ proceed: true }, resumeOptions)).rejects.toMatchObject({
              name: 'MastraTimeoutError',
            });
          } else {
            const resumed = await shared.agent.resumeStream({ proceed: true }, resumeOptions);
            const errors = [];
            for await (const chunk of resumed.fullStream) {
              if (chunk.type === 'error') errors.push(chunk.payload.error);
              expect(chunk.type).not.toBe('finish');
            }
            expect(errors).toHaveLength(1);
            expect(errors[0]).toMatchObject({ name: 'MastraTimeoutError' });
          }
        }
        expect(toolStarted).toBe(true);
        await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
        expect(llm.getRequests()).toHaveLength(1);
      } finally {
        releaseTool();
      }
    },
    TEST_TIMEOUT_MS,
  );
});

describeParity('error-surfaces parity', target => {
  it('model-4xx: an up-front model failure surfaces the same way on every engine', async () => {
    const results = await expectParity(target, scenario(target, MODEL_4XX));

    for (const { engine, turn } of turnsByEngine(target, results)) {
      expect(turn.chunks, `${engine} chunks`).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.finishReason, `${engine} finishReason`).toBe('error');
      expect(turn.streamedText, `${engine} streamedText`).toBe('');
      expect(turn.error, `${engine} error`).toStrictEqual({ name: 'Error', message: 'T37 model 400' });
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(1);
    }
  });

  it('stream-cut: the partial text survives and the failure surfaces the same way on every engine', async () => {
    const results = await expectParity(target, scenario(target, STREAM_CUT));

    for (const { engine, turn } of turnsByEngine(target, results)) {
      // The delta that arrived before the failure is kept, and the failure is
      // recorded rather than raised.
      expect(turn.chunks, `${engine} chunks`).toEqual([
        'AGENT:start',
        'AGENT:step-start',
        'AGENT:text-start',
        'AGENT:text-delta',
        'AGENT:error',
        'AGENT:step-finish',
        'AGENT:finish',
      ]);
      expect(turn.streamedText, `${engine} streamedText`).toBe('partial ');
      expect(turn.text, `${engine} text`).toBe('partial ');
      expect(turn.finishReason, `${engine} finishReason`).toBe('error');
      expect(turn.error, `${engine} error`).toStrictEqual({ name: 'Error', message: 'T37 stream cut' });
      expect(results[engine]?.requests.length, `${engine} model calls`).toBe(1);
    }
  });
});
