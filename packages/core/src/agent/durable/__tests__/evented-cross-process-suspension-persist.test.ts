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
import { afterEach, describe, expect, it, vi } from 'vitest';
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

// 'starting-process-tools': each tool call runs in the starting process with the list
// its LLM step built, which goes stale once another process resumes a call; each resume runs
// without a registry message list. Tool steps alternate call, resume, call, resume.
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
          // The starting process keeps the list its LLM step built, assistant message included.
          this.startingList ??= entry.messageList;
          entry.messageList = step % 2 === 1 ? undefined : this.startingList;
        } else if (this.boundary === 'fresh-worker') {
          globalRunRegistry.delete(runId);
        } else if (entry.messageList) {
          const stale = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
          // The starting process's list: recalled history plus this turn's input, no response.
          stale.add([...entry.messageList.get.remembered.db(), ...entry.messageList.get.input.db()], 'memory');
          entry.messageList = stale;
        }
      }
    }
    return super.publish(topic, event, options);
  }
}

function makeModel(toolCallIds = ['call-1']) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      // Once the tool results are in, the model answers instead of calling the tools again.
      stream: convertArrayToReadableStream<any>(
        calls++ > 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'Thanks.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ]
          : [
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
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ],
      ),
    }),
  });
}

describe('evented agent cross-process tool suspension persistence (#30123)', () => {
  let pubsub: EventEmitterPubSub | undefined;
  let mastra: Mastra | undefined;
  const resumedRuns: string[] = [];

  afterEach(async () => {
    // A resume that ends paused on the next call keeps its in-flight marker, and run ids repeat across tests.
    for (const runId of resumedRuns.splice(0)) {
      clearResumeInFlight(runId, 'call-1');
      clearResumeInFlight(runId, 'call-2');
    }
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

  const siblingBoundaries: Boundary[] = ['fresh-worker', 'starting-process-tools', 'stale-message-list'];
  it.each(
    siblingBoundaries.flatMap(boundary => (['suspension', 'approval'] as const).map(kind => ({ boundary, kind }))),
  )(
    'saves the next sibling $kind on the existing assistant row when it pauses in another process after a resume, and clears both once answered ($boundary)',
    async ({ boundary, kind }) => {
      pubsub = new CrossProcessToolStepPubSub(boundary);
      const storage = new InMemoryStore();
      const memory = new MockMemory({ storage });
      const pendingKey = kind === 'approval' ? 'pendingToolApprovals' : 'suspendedTools';
      const askColour = createTool({
        id: 'askColour',
        description: 'Asks the user for a colour',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ colour: z.string() }),
        requireApproval: kind === 'approval',
        execute: async (input, context: any) => {
          if (kind === 'approval') return { colour: 'approved' };
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
      const durable = mastra.getAgentById(evented.id) as any;
      const threadMemory = { thread: 'thread-1', resource: 'user-1' };
      const waitForPause = async (output: any) => {
        for await (const chunk of output.fullStream) {
          if (chunk.type === 'tool-call-suspended' || chunk.type === 'tool-call-approval') {
            return chunk.payload.toolCallId as string;
          }
        }
      };
      const answer = (toolCallId: string, colour: string) =>
        kind === 'approval'
          ? durable.approveToolCall({ runId: first.runId, toolCallId, memory: threadMemory })
          : durable.resumeStream({ colour }, { runId: first.runId, toolCallId, memory: threadMemory });

      const first = await durable.stream('Ask me twice', { memory: threadMemory });
      expect(await waitForPause(first.output)).toBe('call-1');
      first.cleanup();
      resumedRuns.push(first.runId);
      await new Promise(r => setTimeout(r, 200));

      // The evented loop runs sibling tool calls one at a time, so call-2 only runs once call-1 resumes.
      expect(await waitForPause(await answer('call-1', 'blue'))).toBe('call-2');

      const { messages } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
      expect(messages.map(m => m.role)).toEqual(['user', 'assistant']);
      expect(Object.keys((messages[1]!.content.metadata as any)?.[pendingKey] ?? {})).toEqual(['call-2']);

      // Answering call-2 completes the run; neither answered call may be left pending.
      const completed = await answer('call-2', 'green');
      for await (const chunk of completed.fullStream) if (chunk.type === 'finish') break;

      await vi.waitFor(async () => {
        const { messages: final } = await memory.recall({ threadId: 'thread-1', resourceId: 'user-1', perPage: false });
        const results = Object.fromEntries(
          final.flatMap(m =>
            m.content.parts.flatMap(part =>
              part.type === 'tool-invocation' && part.toolInvocation.state === 'result'
                ? [[part.toolInvocation.toolCallId, part.toolInvocation.result]]
                : [],
            ),
          ),
        );
        expect(results).toEqual(
          kind === 'approval'
            ? { 'call-1': { colour: 'approved' }, 'call-2': { colour: 'approved' } }
            : { 'call-1': { colour: 'blue' }, 'call-2': { colour: 'green' } },
        );
        const metadata = final.find(m => m.content.parts.some(part => part.type === 'tool-invocation'))!.content
          .metadata as any;
        expect(Object.keys(metadata?.suspendedTools ?? {})).toEqual([]);
        expect(Object.keys(metadata?.pendingToolApprovals ?? {})).toEqual([]);
      });
    },
    15_000,
  );
});
