/**
 * A prompt a run has parked on (a question or access prompt waiting on the user)
 * stays on screen while it can still be answered. Another run on the same thread
 * ending must not clear it; the prompt's own run finishing, or an abort, does.
 */
import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
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

/** A session whose run has parked on its prompt, plus another agent that can run on its thread. */
async function createHarness(id: string) {
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
        if (prompts.length > 1) return { stream: reply(`reply ${prompts.length}`) };
        return { stream: askForAccess() };
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
    model: new MastraLanguageModelV2Mock({
      doStream: async () => ({ stream: reply('checked') }),
    }),
  });

  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const mastra = new Mastra({
    agents: { [`${id}-agent`]: baseAgent, [`${id}-other`]: otherAgent },
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

  const runEnds = () => events.flatMap(event => (event.type === 'agent_end' ? [event.reason] : []));
  await session.sendMessage({ content: 'Read /elsewhere' });
  expect(runEnds()).toEqual(['suspended']);
  expect(session.displayState.get().pendingSuspensions.size).toBe(1);
  return {
    session,
    prompts,
    runEnds,
    threadId: session.thread.getId()!,
    resourceId: session.identity.getResourceId(),
    otherAgent: mastra.getAgent(`${id}-other`),
  };
}

const waitingPrompts = (session: {
  displayState: { get(): { pendingSuspensions: Map<string, { toolCallId: string }> } };
}) => [...session.displayState.get().pendingSuspensions.values()].map(suspension => suspension.toolCallId);

describe('a parked prompt on screen', () => {
  it('stays after another run on the thread ends, until its own run finishes', async () => {
    const { session, prompts, runEnds, threadId, resourceId, otherAgent } = await createHarness('kept');

    expect(await runOnThread(otherAgent, 'Is the work done?', { thread: threadId, resource: resourceId })).toBe(
      'checked',
    );
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete']));
    expect(waitingPrompts(session)).toEqual(['call-1']);

    await session.respondToToolSuspension({ resumeData: 'granted' });
    await vi.waitFor(() => expect(runEnds()).toEqual(['suspended', 'complete', 'complete']));
    expect(prompts[1]).toContain('access: granted');
    expect(waitingPrompts(session)).toEqual([]);
  });

  it('is cleared when the run is aborted', async () => {
    const { session } = await createHarness('aborted');

    await session.abort();

    expect(waitingPrompts(session)).toEqual([]);
  });
});
