/**
 * #29808: two answers to the same parked tool call must resume it once. The
 * losing answer is a no-op: it must not report an error or end the live run.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { MastraError } from '../../error';
import { anyToolResult, useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const ids = { id: 'race-session', ownerId: 'owner', resourceId: 'race-user', threadId: 'race-thread' };

const getMock = useLoopScenarioAimock();

function model() {
  const llm = getMock();
  llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'done' });
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: 'confirm', arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

async function suspendedSession() {
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
  const agent = new Agent({
    id: 'race-agent',
    name: 'race-agent',
    instructions: 'test',
    model: model(),
    tools: { confirm },
  });
  const storage = new InMemoryStore();
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'race-controller',
    storage,
    memory: new MockMemory({ storage: new InMemoryStore() }),
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession(ids);
  await controller.getMastra()?.startWorkers();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));

  await session.sendMessage({ content: 'confirm it' });
  expect(events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'suspended' });
  events.length = 0;
  return { session, agent, events, executed };
}

const errors = (events: AgentControllerEvent[]) =>
  events.flatMap(event => (event.type === 'error' ? [event.error.message] : []));
const runEnds = (events: AgentControllerEvent[]) =>
  events.flatMap(event => (event.type === 'agent_end' ? [event.reason] : []));

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('concurrent answers to one parked tool call', () => {
  it('resumes once when the same session answers twice at the same time', async () => {
    const env = await suspendedSession();
    const resume = vi.spyOn(env.agent, 'sendStreamResume');

    await Promise.all([
      env.session.respondToToolSuspension({ resumeData: { ok: true } }),
      env.session.respondToToolSuspension({ resumeData: { ok: true } }),
    ]);

    await vi.waitFor(() => expect(runEnds(env.events)).toContain('complete'), { timeout: 10_000 });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(env.executed).toEqual(['confirm']);
    expect(errors(env.events)).toEqual([]);
    expect(runEnds(env.events)).toEqual(['complete']);
  }, 30_000);

  it('treats a resume another answer already claimed as a no-op', async () => {
    const env = await suspendedSession();
    vi.spyOn(env.agent, 'sendStreamResume').mockRejectedValueOnce(
      new MastraError({
        id: 'AGENT_RESUME_ALREADY_CLAIMED',
        domain: 'AGENT',
        category: 'USER',
        text: 'another resume of it already claimed it',
      }),
    );

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(errors(env.events)).toEqual([]);
    expect(runEnds(env.events)).toEqual([]);
    expect(env.session.run.isRunning()).toBe(false);
    // The winning answer resumed the call, so it no longer shows as parked here.
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(0);
    expect(env.session.suspensions.resolveAddress({})).toBeUndefined();
  }, 30_000);
});
