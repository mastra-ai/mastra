import { createOpenAI } from '@ai-sdk/openai-v5';
import { expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { LeasePubSub } from '../../agent/__tests__/thread-stream-test-utils';
import { createEventedAgent } from '../../agent/durable';
import type { ToolsInput } from '../../agent/types';
import { InMemoryServerCache } from '../../cache';
import { EventEmitterPubSub } from '../../events';
import { anyToolResult, useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const getMock = useLoopScenarioAimock();

// COR-1658: evented execution can release the run scope before plan approval arrives.
it.each([
  { engine: 'standard', replay: false },
  { engine: 'evented wrapper', replay: false },
  { engine: 'native evented', replay: false },
  { engine: 'evented wrapper', replay: true },
] as const)(
  'approves a parked plan on its original agent after switching to build ($engine, replay: $replay)',
  async ({ engine, replay }) => {
    const llm = getMock();
    llm.on({ endpoint: 'chat', model: 'gpt-4o' }, { content: 'Build agent ready.' });
    llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'Plan agent finished.' });
    llm.on(
      { endpoint: 'chat' },
      { toolCalls: [{ id: 'plan-call', name: 'submit_plan', arguments: { path: 'plan.md' } }] },
    );
    const model = createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });
    const storage = new InMemoryStore();
    const cache = new InMemoryServerCache();
    const retainedPubSub = new LeasePubSub();
    retainedPubSub.retain = true;
    retainedPubSub.delayBacklog = true;
    const pubsub = replay ? retainedPubSub : new EventEmitterPubSub();
    const createHost = (pubsub: EventEmitterPubSub | LeasePubSub) => {
      const plan = new Agent<'planner', ToolsInput, unknown>({
        id: 'planner',
        name: 'Planner',
        instructions: 'Create a plan.',
        model: model('gpt-4o-mini'),
        memory: new MockMemory({ storage }),
        ...(engine === 'native evented' && { durable: { executionEngine: 'evented' } }),
      });
      const build = new Agent({
        id: 'builder',
        name: 'Builder',
        instructions: 'Implement plans.',
        model: model('gpt-4o'),
        memory: new MockMemory({ storage }),
      });
      const planner = engine === 'evented wrapper' ? createEventedAgent({ agent: plan, cache, pubsub }) : plan;
      const controller = new AgentController({
        id: 'parked-plan',
        workspace: createMockWorkspace(),
        modes: [
          { id: 'plan', name: 'Plan', default: true, transitionsTo: 'build', agent: planner },
          { id: 'build', name: 'Build', agent: build },
        ],
      });
      const mastra = new Mastra({
        agents: { planner, builder: build },
        agentControllers: { controller },
        storage,
        cache,
        pubsub,
        logger: false,
      });
      return { controller, mastra };
    };
    const { controller, mastra } = createHost(pubsub);
    await controller.init();
    const session = await controller.createSession({
      id: `parked-plan-${engine}`,
      ownerId: 'owner',
      resourceId: 'resource',
    });
    await session.thread.create();
    await session.permissions.setForTool({ toolName: 'submit_plan', policy: 'allow' });
    const events: AgentControllerEvent[] = [];
    const unsubscribe = session.subscribe(event => events.push(event));
    const output = () =>
      events
        .flatMap(event =>
          event.type === 'message_update' && event.event.type === 'text-delta' ? [event.event.delta] : [],
        )
        .join('');
    await mastra.startWorkers();
    try {
      await session.sendMessage({ content: 'Create a plan.' });
      expect(events).toContainEqual(expect.objectContaining({ type: 'agent_end', reason: 'suspended' }));
      const parked = session.suspensions.get({ toolCallId: 'plan-call' });
      expect(parked).toMatchObject({ toolName: 'submit_plan' });

      await session.mode.switch({ modeId: 'build' });
      if (replay) {
        if (!parked) throw new Error('Expected a parked plan');
        const threadId = session.thread.requireId();
        session.thread.detachFromCurrent();
        const follower = createHost(retainedPubSub.restart());
        expect(follower.mastra.__getRunScope(parked.runId)).toBeUndefined();
        const observer = await follower.controller.createSession({
          id: 'observer',
          ownerId: 'owner',
          resourceId: 'resource',
          createInitialThread: false,
        });
        const unsubscribeObserver = observer.subscribe(event => events.push(event));
        try {
          await follower.mastra.startWorkers();
          events.length = 0;
          await observer.thread.switch({ threadId });
          expect(observer.mode.get()).toBe('build');
          await vi.waitFor(() => {
            expect(events).toContainEqual(expect.objectContaining({ type: 'tool_suspended', toolCallId: 'plan-call' }));
            expect(events).toContainEqual(expect.objectContaining({ type: 'agent_end', reason: 'suspended' }));
          });
          expect(observer.suspensions.get({ toolCallId: 'plan-call' })).toMatchObject({ runId: parked.runId });
          events.length = 0;
          await observer.respondToToolSuspension({ toolCallId: 'plan-call', resumeData: { action: 'approved' } });
          await vi.waitFor(() => {
            expect(events.filter(event => event.type === 'error').map(event => event.error.message)).toEqual([]);
            expect(output()).toBe('Plan agent finished.');
          });
          expect(observer.suspensions.get({ toolCallId: 'plan-call' })).toBeUndefined();
        } finally {
          unsubscribeObserver();
          observer.thread.detachFromCurrent();
          await follower.mastra.stopWorkers();
        }
        return;
      }
      events.length = 0;
      await session.respondToToolSuspension({ toolCallId: 'plan-call', resumeData: { action: 'approved' } });

      expect(events.filter(event => event.type === 'error').map(event => event.error.message)).toEqual([]);
      expect(output()).toBe('Plan agent finished.');
      expect(session.mode.get()).toBe('build');
      expect(session.suspensions.get({ toolCallId: 'plan-call' })).toBeUndefined();

      events.length = 0;
      await session.sendMessage({ content: 'Ready to build?' });
      expect(output()).toBe('Build agent ready.');
    } finally {
      unsubscribe();
      await mastra.stopWorkers();
    }
  },
  30_000,
);
