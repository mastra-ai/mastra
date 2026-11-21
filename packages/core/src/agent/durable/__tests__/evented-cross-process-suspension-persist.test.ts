/**
 * Evented agent: a tool-call step that runs in a different process from the
 * LLM step must still persist the assistant message carrying the tool call,
 * with its `suspendedTools` / `pendingToolApprovals` metadata, when the tool
 * suspends or awaits approval (#30123).
 *
 * With a step-guarded store and a shared PubSub, each evented step is
 * delivered to whichever process's worker claims it. The tool-call step's
 * process then either has no run registry entry (a fresh worker) or holds a
 * message list from earlier in the run that lacks the assistant message the
 * LLM step produced in another process. The process boundary is simulated by
 * rewriting the registry entry when the tool step's `workflow.step.run` event
 * is published; everything else runs the real evented loop.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import type { Event } from '../../../events/types';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { TOOL_STEP_PATH } from '../../../workflows/evented/test-utils/redelivery-driver';
import { Agent } from '../../agent';
import { MessageList } from '../../message-list';
import { DurableStepIds } from '../constants';
import { createEventedAgent } from '../create-evented-agent';
import { clearResumeInFlight, globalRunRegistry } from '../run-registry';

// 'starting-process-tools': every tool step runs in the starting process with one
// long-lived stale list, except the resume step, which runs in a fresh worker.
type Boundary = 'same-process' | 'fresh-worker' | 'stale-message-list' | 'starting-process-tools';

class CrossProcessToolStepPubSub extends EventEmitterPubSub {
  private toolSteps = 0;
  private startingList: MessageList | undefined;

  constructor(private readonly boundary: Boundary) {
    super();
  }

  override async publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>, options?: any): Promise<void> {
    const data = event.data as { workflowId?: string; executionPath?: number[] } | undefined;
    if (
      this.boundary !== 'same-process' &&
      topic === 'workflows' &&
      event.type === 'workflow.step.run' &&
      data?.workflowId === DurableStepIds.AGENTIC_EXECUTION &&
      // One tool step per sibling call: [3,0], [3,1], ...
      data.executionPath?.length === 2 &&
      data.executionPath[0] === TOOL_STEP_PATH[0]
    ) {
      // The tool step belongs to the nested execution workflow; the registry is
      // keyed by the agent run, the only run in these tests.
      const step = this.toolSteps++;
      for (const [runId, entry] of [...globalRunRegistry.entries()]) {
        if (this.boundary === 'starting-process-tools') {
          if (!this.startingList && entry.messageList) {
            this.startingList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
            this.startingList.add(entry.messageList.get.input.db(), 'memory');
          }
          entry.messageList = step === 1 ? undefined : this.startingList;
        } else if (this.boundary === 'fresh-worker') {
          globalRunRegistry.delete(runId);
        } else if (entry.messageList) {
          const stale = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
          stale.add(entry.messageList.get.input.db(), 'memory');
          entry.messageList = stale;
        }
      }
    }
    return super.publish(topic, event, options);
  }
}

function makeModel(toolCallIds = ['call-1']) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream<any>([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
        ...toolCallIds.map(toolCallId => ({
          type: 'tool-call',
          toolCallType: 'function',
          toolCallId,
          toolName: 'askColour',
          input: '{"question":"Favourite colour?"}',
          providerExecuted: false,
        })),
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
      ]),
    }),
  });
}

describe('evented agent cross-process tool suspension persistence (#30123)', () => {
  let pubsub: EventEmitterPubSub | undefined;
  let mastra: Mastra | undefined;

  const resumedRuns: string[] = [];

  afterEach(async () => {
    // The resumed segment ends suspended on call-2, so call-1's in-flight marker outlives the test.
    for (const runId of resumedRuns.splice(0)) clearResumeInFlight(runId, 'call-1');
    await mastra?.stopWorkers();
    globalRunRegistry.clear();
    await pubsub?.close();
  });

  const boundaries: Boundary[] = ['same-process', 'fresh-worker', 'stale-message-list'];
  it.each(boundaries.flatMap(boundary => (['suspension', 'approval'] as const).map(kind => ({ boundary, kind }))))(
    'saves the assistant tool call with its $kind metadata ($boundary)',
    async ({ boundary, kind }) => {
      pubsub = new CrossProcessToolStepPubSub(boundary);
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      const askColour = createTool({
        id: 'askColour',
        description: 'Asks the user for a colour',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ colour: z.string() }),
        requireApproval: kind === 'approval',
        execute: async (input, context: any) => {
          if (!context?.agent?.resumeData) return await context.agent.suspend({ question: input.question });
          return { colour: context.agent.resumeData.colour };
        },
      });
      const agent = new Agent({
        id: 'colour-agent',
        name: 'colour-agent',
        instructions: 'Ask for a colour.',
        model: makeModel() as any,
        tools: { askColour },
        memory,
      });
      const evented = createEventedAgent({ agent });
      mastra = new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });
      await mastra.startWorkers();

      const { output, cleanup } = await mastra.getAgentById(evented.id).stream('Ask me my colour', {
        memory: { thread: 'thread-1', resource: 'user-1' },
      });
      const types: string[] = [];
      for await (const chunk of output.fullStream) {
        types.push(chunk.type);
        // A suspended evented run keeps its stream open for the resume.
        if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') break;
      }
      cleanup();
      expect(types).toContain(kind === 'approval' ? 'tool-call-approval' : 'tool-call-suspended');

      const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
      expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
      const assistant = messages[1]!;
      expect(
        assistant.content.parts.some(
          part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1',
        ),
      ).toBe(true);
      const metadata = assistant.content.metadata as any;
      if (kind === 'approval') {
        expect(metadata?.pendingToolApprovals?.['call-1']).toMatchObject({
          toolCallId: 'call-1',
          toolName: 'askColour',
        });
      } else {
        expect(metadata?.suspendedTools?.['call-1']).toMatchObject({
          toolCallId: 'call-1',
          toolName: 'askColour',
          suspendPayload: { question: 'Favourite colour?' },
        });
      }
    },
    15_000,
  );

  it.each<Boundary>(['fresh-worker', 'stale-message-list'])(
    'saves the suspension on this turn, not an older turn that reused the tool call id (%s)',
    async boundary => {
      pubsub = new CrossProcessToolStepPubSub(boundary);
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      await memory.saveThread({
        thread: { id: 'thread-1', resourceId: 'user-1', title: '', createdAt: new Date(0), updatedAt: new Date(0) },
      });
      await memory.saveMessages({
        messages: [
          {
            id: 'old-assistant',
            role: 'assistant',
            threadId: 'thread-1',
            resourceId: 'user-1',
            createdAt: new Date(0),
            content: {
              format: 2,
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: 'call-1',
                    toolName: 'askColour',
                    args: { question: 'Favourite colour?' },
                    result: { colour: 'red' },
                  },
                },
              ],
            },
          },
        ],
      });
      const askColour = createTool({
        id: 'askColour',
        description: 'Asks the user for a colour',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        execute: async (input, context: any) => context.agent.suspend({ question: input.question }),
      });
      const agent = new Agent({
        id: 'colour-agent',
        name: 'colour-agent',
        instructions: 'Ask for a colour.',
        model: makeModel() as any,
        tools: { askColour },
        memory,
      });
      const evented = createEventedAgent({ agent });
      mastra = new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });
      await mastra.startWorkers();

      const { output, cleanup } = await mastra.getAgentById(evented.id).stream('Ask me again', {
        memory: { thread: 'thread-1', resource: 'user-1' },
      });
      for await (const chunk of output.fullStream) if (chunk.type === 'tool-call-suspended') break;
      cleanup();

      const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
      expect(messages.map(m => m.role)).toEqual(['assistant', 'user', 'assistant']);
      expect((messages[0]!.content.metadata as any)?.suspendedTools).toBeUndefined();
      expect(Object.keys((messages[2]!.content.metadata as any)?.suspendedTools ?? {})).toEqual(['call-1']);
    },
    15_000,
  );

  it.each<Boundary>(['fresh-worker', 'starting-process-tools'])(
    'saves the next sibling suspension on the existing assistant row when it suspends in another process after a resume (%s)',
    async boundary => {
      pubsub = new CrossProcessToolStepPubSub(boundary);
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      const askColour = createTool({
        id: 'askColour',
        description: 'Asks the user for a colour',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ colour: z.string() }),
        execute: async (input, context: any) => {
          if (!context?.agent?.resumeData) return await context.agent.suspend({ question: input.question });
          return { colour: context.agent.resumeData.colour };
        },
      });
      const agent = new Agent({
        id: 'colour-agent',
        name: 'colour-agent',
        instructions: 'Ask for a colour.',
        model: makeModel(['call-1', 'call-2']) as any,
        tools: { askColour },
        memory,
      });
      const evented = createEventedAgent({ agent });
      mastra = new Mastra({ logger: false, storage, pubsub, agents: { [evented.id]: evented } });
      await mastra.startWorkers();
      const durable = mastra.getAgentById(evented.id);
      const threadMemory = { thread: 'thread-1', resource: 'user-1' };
      const waitForSuspension = async (output: any) => {
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-call-suspended') return chunk.payload.toolCallId as string;
        }
      };

      const first = await durable.stream('Ask me twice', { memory: threadMemory });
      expect(await waitForSuspension(first.output)).toBe('call-1');
      first.cleanup();
      await new Promise(r => setTimeout(r, 200));
      resumedRuns.push(first.runId);

      // The evented loop runs sibling tool calls one at a time, so call-2 only runs once call-1 resumes.
      const resumed = await (durable as any).resumeStream(
        { colour: 'blue' },
        { runId: first.runId, toolCallId: 'call-1', memory: threadMemory },
      );
      expect(await waitForSuspension(resumed)).toBe('call-2');

      const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
      expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
      const assistant = messages[1]!;
      expect(Object.keys((assistant.content.metadata as any)?.suspendedTools ?? {})).toEqual(['call-2']);
    },
    15_000,
  );
});
