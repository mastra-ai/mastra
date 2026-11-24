import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createDurableAgent, createEventedAgent, DurableAgent } from '../../../../agent/durable';
import { DurableStepIds } from '../../../../agent/durable/constants';
import { globalRunRegistry } from '../../../../agent/durable/run-registry';
import { EventEmitterPubSub } from '../../../../events';
import { Mastra } from '../../../../mastra';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import {
  createSharedAgent,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
  isDurableEngineVariant,
} from '../aimock-scenario';

const TIMEOUT_MESSAGE = '`modelSettings.timeout.stepMs` must be a positive, finite number of milliseconds.';

describeForAllEngines('AIMock scenario: resume timeout validation (COR-1426)', engine => {
  const getMock = useLoopScenarioAimock();
  const modes =
    engine === 'durable' || engine === 'evented'
      ? (['per-call', 'default', 'untilIdle', 'cold', 'cold-default'] as const)
      : (['per-call', 'default', 'untilIdle'] as const);

  describe.each(['resumeStream', 'resumeGenerate'] as const)('%s', method => {
    it.each(modes.filter(mode => method === 'resumeStream' || mode !== 'untilIdle'))(
      'rejects invalid %s settings without consuming the suspended run',
      async mode => {
        let toolCalls = 0;
        let defaultStepMs = 30_000;
        const defaultOptions = {
          autoResumeSuspendedTools: false,
          get modelSettings() {
            return { timeout: { stepMs: defaultStepMs } };
          },
        };
        const memory = new MockMemory();
        const shared = await createSharedAgent(getMock(), {
          engine,
          memory,
          defaultOptions,
          tools: {
            ask: createTool({
              id: 'ask',
              inputSchema: z.object({}),
              suspendSchema: z.object({}),
              resumeSchema: z.object({ answer: z.string() }),
              execute: async (_, context) => {
                toolCalls++;
                if (!context?.agent?.resumeData) return context?.agent?.suspend({});
                return { answer: context.agent.resumeData.answer };
              },
            }),
          },
        });
        const { output, chunks } = await runLoopScenario({
          engine,
          llm: getMock(),
          sharedAgent: shared,
          prompt: 'Ask for an answer.',
          memory,
          threadId: `timeout-${engine}-${method}-${mode}`,
          resourceId: 'timeout-resource',
          maxSteps: 3,
          collectChunks: true,
          fixtures: llm => {
            llm.on(
              { endpoint: 'chat', hasToolResult: false },
              {
                toolCalls: [{ id: 'timeout-call', name: 'ask', arguments: {} }],
              },
            );
            llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Answer accepted.' });
          },
        });
        expect(chunks?.some(chunk => chunk.type === 'tool-call-suspended')).toBe(true);
        expect(toolCalls).toBe(1);
        expect(getMock().getRequests()).toHaveLength(1);

        let agent = shared.agent;
        if (mode === 'cold' || mode === 'cold-default') {
          if (!(agent instanceof DurableAgent)) throw new Error('Cold setup requires a durable wrapper');
          const entry = globalRunRegistry.get(output.runId);
          await entry?.workflowExecution;
          const workflows = await shared.mastra.getStorage()!.getStore('workflows');
          await vi.waitFor(async () => {
            const persisted = await workflows!.getWorkflowRunById({
              runId: output.runId,
              workflowName: DurableStepIds.AGENTIC_LOOP,
            });
            expect(persisted?.snapshot.status).toBe('suspended');
          });
          const baseAgent = agent.agent;
          entry?.cleanup?.();
          globalRunRegistry.delete(output.runId);
          const oldPubsub = agent.getPubSub();
          if (oldPubsub instanceof EventEmitterPubSub) oldPubsub.close();
          const pubsub = new EventEmitterPubSub();
          const wrapped =
            engine === 'evented'
              ? createEventedAgent({ agent: baseAgent, pubsub })
              : createDurableAgent({ agent: baseAgent, pubsub });
          const mastra = new Mastra({
            agents: { wrapped },
            storage: shared.mastra.getStorage(),
            pubsub,
            logger: false,
          });
          agent = mastra.getAgent('wrapped');
          expect(globalRunRegistry.has(output.runId)).toBe(false);
        }
        const invalidDefault = mode === 'default' || mode === 'cold-default';
        if (invalidDefault) defaultStepMs = -1;
        const options = {
          runId: output.runId,
          toolCallId: 'timeout-call',
          maxSteps: 3,
          ...(invalidDefault ? {} : { modelSettings: { timeout: { stepMs: -1 } } }),
        };
        const invalidResume =
          method === 'resumeStream'
            ? agent.resumeStream(
                { answer: 'yes' },
                { ...options, ...(mode === 'untilIdle' ? { untilIdle: true } : {}) },
              )
            : agent.resumeGenerate({ answer: 'yes' }, options);
        await expect(invalidResume).rejects.toThrow(TypeError);
        await expect(invalidResume).rejects.toThrow(TIMEOUT_MESSAGE);
        expect(toolCalls).toBe(1);
        expect(getMock().getRequests()).toHaveLength(1);

        const validOptions = { ...options, modelSettings: { timeout: { stepMs: 30_000 } } };
        const result =
          method === 'resumeStream'
            ? await (async () => {
                const resumed = await agent.resumeStream({ answer: 'yes' }, validOptions);
                for await (const _chunk of resumed.fullStream) {
                  /* drain */
                }
                return resumed.getFullOutput();
              })()
            : await agent.resumeGenerate({ answer: 'yes' }, validOptions);
        expect(result.text).toBe('Answer accepted.');
        expect(JSON.stringify(result.toolResults)).toContain('yes');
        expect(toolCalls).toBe(2);
        expect(getMock().getRequests()).toHaveLength(2);
      },
    );

    if (engine === 'normal' || engine === 'fs') {
      it('validates timeout before looking up a missing snapshot', async () => {
        const { agent } = await createSharedAgent(getMock(), { engine });
        await expect(
          agent[method](
            {},
            {
              runId: 'missing-run',
              modelSettings: { timeout: { stepMs: -1 } },
            },
          ),
        ).rejects.toThrow(new TypeError(TIMEOUT_MESSAGE));
        expect(getMock().getRequests()).toHaveLength(0);
      });
    }
  });
});

/**
 * Manual tool resumption with `resumeStream()`.
 *
 * When a tool calls `suspend()` to pause execution, the user can manually
 * resume by calling `agent.resumeStream(resumeData, { runId })`. The tool
 * receives the `resumeData` via `context.agent.resumeData` on the second
 * execution and continues.
 *
 * This differs from `requireApproval` (which suspends before execution and
 * auto-resumes with `{ approved: true }`). Runtime suspension via `suspend()`
 * suspends mid-execution and requires explicit resume data from the user.
 *
 * Regression classes:
 * - Tool calls `suspend()` mid-execution, emits `tool-call-suspended` chunk
 * - `agent.resumeStream(data, { runId })` resumes the suspended tool
 * - Tool receives `resumeData` via `context.agent.resumeData` on second call
 * - Final output reflects the resumed tool's result
 */
describeForAllEngines(
  'AIMock loop scenario: resumeStream() with resumeData',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('resumes a suspended tool when resumeStream() is called with resume data', async () => {
      let suspendCalled = false;
      let resumeDataReceived: string | undefined;

      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({
          query: z.string().describe('Search query'),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          name: z.string(),
        }),
        execute: async (_inputData, context) => {
          if (!context?.agent?.resumeData) {
            suspendCalled = true;
            return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
          }
          resumeDataReceived = context.agent.resumeData?.name;
          return {
            name: context.agent.resumeData.name,
            email: `${context.agent.resumeData.name.toLowerCase()}@test.com`,
          };
        },
      });

      const shared = await createSharedAgent(getMock(), {
        tools: { findUserTool },
        memory: new MockMemory(),
        engine,
      });

      // First call: model calls the tool, tool suspends
      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Find the user Dero Israel',
        memory: new MockMemory(),
        threadId: 'test-thread',
        resourceId: 'test-resource',
        fixtures: llm => {
          llm.onMessage(/find/i, {
            toolCalls: [
              {
                id: 'call-1',
                name: 'find-user',
                arguments: { query: 'Dero Israel' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: tool-call-suspended chunk emitted
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);
      expect(suspendCalled).toBe(true);
      expect(resumeDataReceived).toBeUndefined();

      // Resume: call agent.resumeStream with the runId and resume data
      const resumeOutput = await shared.agent.resumeStream({ name: 'Dero Israel' }, { runId: output.runId });

      // A durable resume continues the existing message, rather than opening another.
      const resumedTypes: string[] = [];
      for await (const chunk of resumeOutput.fullStream) {
        resumedTypes.push(chunk.type);
      }
      if (isDurableEngineVariant(engine)) {
        expect(chunks![0]?.type).toBe('start');
        expect(chunks!.filter(c => c.type === 'start')).toHaveLength(1);
        expect(resumedTypes).not.toContain('start');
      }

      // Assert: tool received the resume data
      expect(resumeDataReceived).toBe('Dero Israel');

      // Assert: tool results contain the user data
      const toolResults = await resumeOutput.toolResults;
      const findUserResult = toolResults?.find((r: any) => r.payload.toolName === 'find-user');
      expect(findUserResult).toBeDefined();
      const result = findUserResult?.payload.result as { name: string; email: string };
      expect(result.name).toBe('Dero Israel');
      expect(result.email).toBe('dero israel@test.com');
    });

    it('does not resume when resumeStream() is never called (tool remains suspended)', async () => {
      let suspendCalled = false;
      let toolCompleted = false;

      const editTool = createTool({
        id: 'edit-file',
        description: 'Edits a file with confirmation',
        inputSchema: z.object({
          path: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          confirmed: z.boolean(),
        }),
        execute: async (inputData, context) => {
          if (!context?.agent?.resumeData) {
            suspendCalled = true;
            return await context?.agent?.suspend({ message: 'Are you sure you want to edit this file?' });
          }
          toolCompleted = true;
          return { edited: true, path: inputData.path };
        },
      });

      const shared = await createSharedAgent(getMock(), {
        tools: { editTool },
        memory: new MockMemory(),
        engine,
      });

      // First call: tool suspends
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Edit the config file',
        memory: new MockMemory(),
        threadId: 'test-thread-2',
        resourceId: 'test-resource',
        fixtures: llm => {
          llm.onMessage(/edit/i, {
            toolCalls: [
              {
                id: 'call-edit-1',
                name: 'edit-file',
                arguments: { path: '/etc/config.json' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: tool suspended
      expect(suspendCalled).toBe(true);
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);

      // Do NOT call resumeStream - tool remains suspended
      // Assert: tool never completed
      expect(toolCompleted).toBe(false);
    });
  },
  { skip: ['fs'] },
);
