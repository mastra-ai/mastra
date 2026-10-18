/**
 * A run parked on a tool suspension (a question or access prompt waiting on the
 * user) keeps the thread's lease while it waits. When another run then starts on
 * the same thread and finishes, the thread must be free again: a later message
 * has to start a run, not be reported delivered to the parked run that nothing
 * resumes. While the prompt is the last thing on the thread, a message still
 * waits for the answer.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { createDurableAgent } from '../../agent/durable';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

function modelStream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

const askForAccess = () =>
  modelStream([
    { type: 'tool-call', toolCallId: 'call-1', toolName: 'requestAccess', input: '{"path":"/elsewhere"}' },
    { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);

const reply = (text: string) =>
  modelStream([
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  ]);

/** Run `agent` on the session's thread to its end and return what it said. */
async function runOnThread(
  agent: Agent<any, any, any, any>,
  message: string,
  memory: { thread: string; resource: string },
) {
  const output = await agent.stream(message, { memory });
  let text = '';
  for await (const chunk of output.fullStream) {
    if (chunk.type === 'text-delta') text += chunk.payload.text;
  }
  return text;
}

async function createHarness(id: string, durable: boolean) {
  const requestAccess = createTool({
    id: 'request-access',
    description: 'Ask the user for access to a path.',
    inputSchema: z.object({ path: z.string() }),
    execute: async (_input: { path: string }, context?: any) => {
      const resumeData = context?.agent?.resumeData ?? context?.resumeData;
      if (resumeData !== undefined) return `access: ${resumeData}`;
      await (context?.agent?.suspend ?? context?.suspend)({ kind: 'access_request' });
      return 'unreachable';
    },
  });

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  // What the session agent's model was asked, one entry per model call.
  const prompts: string[] = [];
  const baseAgent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You help.',
    memory,
    model: new MastraLanguageModelV2Mock({
      doStream: async ({ prompt }) => {
        prompts.push(JSON.stringify(prompt));
        return { stream: prompts.length === 1 ? askForAccess() : reply(`reply ${prompts.length}`) };
      },
    }),
    tools: { requestAccess },
  });
  // Another agent that runs on the session's own thread, as a goal judge or an
  // application's own `generate` call does.
  const otherAgent = new Agent({
    id: `${id}-other`,
    name: `${id} other`,
    instructions: 'You check.',
    memory,
    model: new MastraLanguageModelV2Mock({ doStream: async () => ({ stream: reply('checked') }) }),
  });

  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const agent = durable ? createDurableAgent({ agent: baseAgent, cache, pubsub }) : baseAgent;
  const mastra = new Mastra({
    agents: { [`${id}-agent`]: agent as any, [`${id}-other`]: otherAgent },
    logger: false,
    storage,
    cache,
    pubsub,
  });
  const registeredAgent = mastra.getAgent(`${id}-agent`);
  const controller = new AgentController({
    agent: registeredAgent,
    pubsub,
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });

  await session.sendMessage({ content: 'Read /elsewhere' });
  expect(events.flatMap(event => (event.type === 'agent_end' ? [event.reason] : []))).toEqual(['suspended']);
  expect(session.displayState.get().pendingSuspensions.size).toBe(1);

  const runEnds = () => events.flatMap(event => (event.type === 'agent_end' ? [event.reason] : []));
  return {
    session,
    prompts,
    runEnds,
    threadId: session.thread.getId()!,
    resourceId: session.identity.getResourceId(),
    otherAgent: mastra.getAgent(`${id}-other`),
    sessionAgent: registeredAgent,
  };
}

describe.each([false, true])('a message after a parked prompt, durable=%s', durable => {
  it('starts a run once another run on the thread has finished', async () => {
    const { session, prompts, runEnds, threadId, resourceId, otherAgent } = await createHarness('displaced', durable);

    const memory = { thread: threadId, resource: resourceId };
    expect(await runOnThread(otherAgent, 'Is the work done?', memory)).toBe('checked');
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete']));

    const sent = session.sendSignal({ content: 'Are you there?' }, { requireDelivery: true });
    expect((await sent.accepted).action).toBe('wake');
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete', 'complete']));
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('Are you there?');
  });

  it('starts a run once the same agent has run on the thread again', async () => {
    const { session, prompts, runEnds, threadId, resourceId, sessionAgent } = await createHarness(
      'same-agent',
      durable,
    );

    const memory = { thread: threadId, resource: resourceId };
    expect(await runOnThread(sessionAgent, 'Status?', memory)).toBe('reply 2');
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete']));

    const sent = session.sendSignal({ content: 'Are you there?' }, { requireDelivery: true });
    expect((await sent.accepted).action).toBe('wake');
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete', 'complete']));
    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain('Are you there?');
  });

  it('still takes the answer to the prompt after another run on the thread', async () => {
    const { session, prompts, runEnds, threadId, resourceId, otherAgent } = await createHarness(
      'answered-later',
      durable,
    );

    const memory = { thread: threadId, resource: resourceId };
    expect(await runOnThread(otherAgent, 'Is the work done?', memory)).toBe('checked');
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete']));

    await session.respondToToolSuspension({ resumeData: 'granted' });
    await vi.waitFor(() => expect(prompts).toHaveLength(2));
    expect(prompts[1]).toContain('access: granted');
  });

  it('waits for the answer while the prompt is the last thing on the thread', async () => {
    const { session, prompts } = await createHarness('waiting', durable);

    const sent = session.sendSignal({ content: 'Are you there?' }, { requireDelivery: true });
    expect((await sent.accepted).action).toBe('deliver');
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(prompts).toHaveLength(1);
    expect(session.displayState.get().pendingSuspensions.size).toBe(1);

    await session.respondToToolSuspension({ resumeData: 'granted' });
    await vi.waitFor(() => expect(prompts.some(prompt => prompt.includes('Are you there?'))).toBe(true));
    expect(prompts[1]).toContain('access: granted');
  });
});
