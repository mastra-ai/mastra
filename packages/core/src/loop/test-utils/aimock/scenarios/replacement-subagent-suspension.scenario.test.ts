import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Memory } from '../../../../../../memory/src';
import { Agent } from '../../../../agent';
import { createDurableAgent, createEventedAgent } from '../../../../agent/durable';
import { assembleAgentFromFsEntry } from '../../../../agent/fs-routing';
import { EventEmitterPubSub } from '../../../../events';
import { Mastra } from '../../../../mastra';
import { InMemoryStore } from '../../../../storage/mock';
import { createTool } from '../../../../tools';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';

const getMock = useLoopScenarioAimock();

describeForAllEngines(
  'replacement-instance sub-agent resuspension',
  engine => {
    it('recovers the delegation invocation and replaces the persisted suspension', async () => {
      const llm = getMock();
      const storage = new InMemoryStore();
      const provider = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
      const memoryOptions = { thread: `replacement-subagent-${engine}`, resource: 'resource' };
      llm.on(
        { endpoint: 'chat', model: 'supervisor' },
        {
          toolCalls: [
            {
              id: 'call-delegate',
              name: 'agent-specialist',
              arguments: JSON.stringify({ prompt: 'Ask both questions' }),
            },
          ],
        },
      );
      llm.on(
        { endpoint: 'chat', model: 'specialist', predicate: req => JSON.stringify(req.messages).includes('call-q1') },
        {
          toolCalls: [{ id: 'call-q2', name: 'ask', arguments: JSON.stringify({ question: 'q2' }) }],
        },
      );
      llm.on(
        { endpoint: 'chat', model: 'specialist' },
        {
          toolCalls: [{ id: 'call-q1', name: 'ask', arguments: JSON.stringify({ question: 'q1' }) }],
        },
      );

      const calls: string[] = [];
      const createInstance = () => {
        const memory = new Memory({
          storage,
          options: {
            observationalMemory: {
              enabled: true,
              observation: { model: provider.chat('observer'), messageTokens: 100_000, bufferTokens: false },
              reflection: { model: provider.chat('observer'), observationTokens: 100_000 },
            },
          },
        });
        const ask = createTool({
          id: 'ask',
          description: 'Ask a question',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async ({ question }, context) => {
            calls.push(`${question}:${context?.agent?.resumeData ? 'resume' : 'suspend'}`);
            return context?.agent?.resumeData ?? context?.agent?.suspend({ question });
          },
        });
        const specialist = new Agent({
          id: 'specialist',
          name: 'specialist',
          instructions: 'Ask questions.',
          model: provider.chat('specialist'),
          tools: { ask },
        });
        const supervisor =
          engine === 'fs'
            ? assembleAgentFromFsEntry({
                name: 'supervisor',
                config: { model: provider.chat('supervisor'), agents: { specialist }, memory },
                instructionsMd: 'Delegate.',
              })
            : new Agent({
                id: 'supervisor',
                name: 'supervisor',
                instructions: 'Delegate.',
                model: provider.chat('supervisor'),
                agents: { specialist },
                memory,
              });
        const pubsub = engine === 'evented' ? new EventEmitterPubSub() : undefined;
        const agent =
          engine === 'durable'
            ? createDurableAgent({ agent: supervisor })
            : engine === 'evented'
              ? createEventedAgent({ agent: supervisor, pubsub: pubsub! })
              : supervisor;
        const mastra = new Mastra({
          agents: engine === 'fs' ? {} : { supervisor: agent, specialist },
          storage,
          logger: false,
          ...(pubsub ? { pubsub } : {}),
        });
        if (engine === 'fs') mastra.__registerFsAgents({ supervisor: agent });
        return { agent: mastra.getAgent('supervisor'), mastra, memory };
      };

      const readSuspension = async (memory: Memory) => {
        const { messages } = await memory.recall({
          threadId: memoryOptions.thread,
          resourceId: memoryOptions.resource,
          perPage: false,
        });
        const invocation = messages.find(
          message =>
            message.role === 'assistant' &&
            message.content.parts?.some(
              part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-delegate',
            ),
        );
        expect(invocation, JSON.stringify(messages)).toBeDefined();
        return invocation?.content.metadata?.suspendedTools;
      };
      const first = createInstance();
      let replacement: ReturnType<typeof createInstance> | undefined;
      try {
        const opening = await first.agent.stream('Ask both questions', { memory: memoryOptions, maxSteps: 5 });
        const initialSuspensions: unknown[] = [];
        for await (const chunk of opening.fullStream) {
          if (chunk.type === 'tool-call-suspended') {
            initialSuspensions.push(chunk.payload.suspendPayload);
            break;
          }
        }
        expect(JSON.stringify(initialSuspensions)).toContain('q1');
        if (engine === 'durable' || engine === 'evented') {
          await vi.waitFor(
            async () => {
              expect(JSON.stringify(await readSuspension(first.memory))).toContain('q1');
            },
            { timeout: 5000 },
          );
        }
        const runId = await opening.runId;
        if (engine === 'evented') {
          await vi.waitFor(
            async () => {
              const runs = await first.agent.listSuspendedRuns({
                threadId: memoryOptions.thread,
                resourceId: memoryOptions.resource,
              });
              expect(runs.runs.some(run => run.runId === runId)).toBe(true);
            },
            { timeout: 5000 },
          );
        }
        replacement = engine === 'normal' || engine === 'fs' ? first : createInstance();
        const resumed = await replacement.agent.resumeStream(
          { answer: 'first answer' },
          {
            runId,
            toolCallId: 'call-delegate',
            memory: memoryOptions,
            maxSteps: 5,
          },
        );
        const nextSuspensions: unknown[] = [];
        for await (const chunk of resumed.fullStream) {
          if (chunk.type === 'tool-call-suspended') {
            nextSuspensions.push(chunk.payload.suspendPayload);
            break;
          }
        }
        expect(calls).toEqual(['q1:suspend', 'q1:resume', 'q2:suspend']);
        expect(JSON.stringify(nextSuspensions)).toContain('q2');
        if (engine === 'durable' || engine === 'evented') {
          await vi.waitFor(
            async () => {
              const saved = JSON.stringify(await readSuspension(replacement.memory));
              expect(saved).toContain('q2');
              expect(saved).not.toContain('q1');
            },
            { timeout: 5000 },
          );
        }
        expect(llm.getRequests().filter(request => request.body?.model === 'specialist')).toHaveLength(2);
      } finally {
        await replacement?.mastra.shutdown({ drainTimeout: 1000 });
        await first.mastra.shutdown({ drainTimeout: 1000 });
      }
    }, 40_000);
  },
  { skip: ['inngest'] },
);
