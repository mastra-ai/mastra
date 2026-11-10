/**
 * #26870 end to end, on every agent engine the AgentController drives: park a
 * tool call, make the resume fail before its run starts, then check the
 * session is idle, a new message is still taken, and the retried resume
 * completes the tool call and answers that message. The only stub is the
 * forced `sendStreamResume` rejection.
 *
 * A message sent while a tool call is parked is delivered into the parked run
 * (the run still owns the thread) and answered once that run resumes; that is
 * the same on main without any failure.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { createDurableAgent, createEventedAgent } from '../../agent/durable';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { anyToolResult, useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const getMock = useLoopScenarioAimock();

function lastUserText(req: ChatCompletionRequest): string {
  const user = [...req.messages].reverse().find(message => message.role === 'user');
  return typeof user?.content === 'string' ? user.content : JSON.stringify(user?.content ?? '');
}

/** Calls `confirm` for the first message, replies to "hello", and finishes once the tool result is in. */
function model() {
  const llm = getMock();
  llm.on({ endpoint: 'chat', predicate: req => lastUserText(req).includes('hello') }, { content: 'hi there' });
  llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'confirmed and done' });
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: 'confirm', arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

async function createSession(engine: 'normal' | 'durable' | 'evented') {
  const executed: string[] = [];
  const confirm = createTool({
    id: 'confirm',
    description: 'asks the user to confirm',
    inputSchema: z.object({ q: z.string() }),
    execute: async (input, context) => {
      if (context?.agent?.resumeData) {
        executed.push('confirm');
        return { confirmed: true };
      }
      await context?.agent?.suspend?.({ q: input.q });
      return { confirmed: false };
    },
  });
  const storage = new InMemoryStore();
  const baseAgent = new Agent({
    id: `e2e-${engine}-agent`,
    name: `e2e-${engine}-agent`,
    instructions: 'test',
    model: model(),
    memory: new MockMemory({ storage }),
    tools: { confirm },
  });
  const cache = new InMemoryServerCache();
  const pubsub = new EventEmitterPubSub();
  const wrapped =
    engine === 'durable'
      ? createDurableAgent({ agent: baseAgent, cache, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent: baseAgent, cache, pubsub })
        : baseAgent;
  const mastra = new Mastra({
    agents: { [`e2e-${engine}-agent`]: wrapped as any },
    logger: false,
    storage,
    cache,
    pubsub,
  });
  const agent = mastra.getAgent(`e2e-${engine}-agent`);
  const controller = new AgentController({
    agent,
    pubsub,
    workspace: createMockWorkspace(),
    id: `e2e-${engine}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `e2e-${engine}-session`, ownerId: 'owner' });
  await session.thread.create();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  return { session, events, executed };
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe.each(['normal', 'durable', 'evented'] as const)('failed tool resume end to end [%s]', engine => {
  it('goes idle, takes a new message, and the retried resume completes and answers it', async () => {
    const { session, events, executed } = await createSession(engine);
    const ends = () => events.filter(event => event.type === 'agent_end');

    await session.sendMessage({ content: 'confirm it' });
    await vi.waitFor(() => expect(ends()).toMatchObject([{ reason: 'suspended' }]), { timeout: 10_000 });
    expect(session.displayState.get().pendingSuspensions.size).toBe(1);

    const resume = vi
      .spyOn(session.machinery.getAgent(), 'sendStreamResume')
      .mockRejectedValueOnce(new Error('resume dispatch failed'));
    await session.respondToToolSuspension({ resumeData: { ok: true } });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(events.filter(event => event.type === 'error').map(event => (event as any).error.message)).toContain(
      'resume dispatch failed',
    );
    expect(session.run.isRunning()).toBe(false);
    expect(session.run.getRunId()).toBeNull();
    expect(session.displayState.get().pendingSuspensions.size).toBe(1);

    events.length = 0;
    const sent = session.sendMessage({ content: 'hello' });
    await vi.waitFor(() => expect(events.some(event => event.type === 'agent_start')).toBe(true));

    await session.respondToToolSuspension({ resumeData: { ok: true } });
    await sent;
    await vi.waitFor(() => expect(ends()).toMatchObject([{ reason: 'complete' }]), { timeout: 10_000 });
    expect(executed).toEqual(['confirm']);
    expect(resume).toHaveBeenCalledTimes(2);
    const replies = events.flatMap(event => (event.type === 'message_update' ? [(event as any).event?.delta] : []));
    expect(replies.join('')).toBe('hi there');
    expect(session.displayState.get().pendingSuspensions.size).toBe(0);
    expect(session.run.isRunning()).toBe(false);
    expect(session.run.getRunId()).toBeNull();
  }, 30_000);
});
