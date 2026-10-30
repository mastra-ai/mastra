/**
 * #26870: answering a parked tool call arms the session run before the resumed
 * run starts. When the answer fails before that run starts, the session must go
 * back to idle (instead of reporting running with no run id), keep the tool
 * call parked, and still accept a retry and new messages.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { anyToolResult, useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const ids = { id: 'answer-session', ownerId: 'owner', resourceId: 'answer-user', threadId: 'answer-thread' };

const getMock = useLoopScenarioAimock();

/** Calls `toolName` until a tool result is in the conversation, then answers. */
function model(toolName: string) {
  const llm = getMock();
  llm.on({ endpoint: 'chat', predicate: anyToolResult }, { content: 'done' });
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: toolName, arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

type Stores = { storage: InMemoryStore; memoryStorage: InMemoryStore; executed: string[] };

function stores(): Stores {
  return { storage: new InMemoryStore(), memoryStorage: new InMemoryStore(), executed: [] };
}

async function boot({ storage, memoryStorage, executed }: Stores) {
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
  const lookup = createTool({
    id: 'lookup',
    description: 'look something up',
    inputSchema: z.object({ q: z.string() }),
    requireApproval: true,
    execute: async () => {
      executed.push('lookup');
      return { found: true };
    },
  });
  return { executed, tools: { confirm, lookup }, storage, memoryStorage };
}

async function createSession(toolName: 'confirm' | 'lookup', shared: Stores = stores()) {
  // The suspending tool resumes without an approval re-check; the gated one parks for approval.
  const yolo = toolName === 'confirm';
  const env = await boot(shared);
  const agent = new Agent({
    id: 'answer-agent',
    name: 'answer-agent',
    instructions: 'test',
    model: model(toolName),
    tools: { [toolName]: env.tools[toolName] },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'answer-controller',
    storage: env.storage,
    memory: new MockMemory({ storage: env.memoryStorage }),
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    initialState: { yolo } as any,
  });
  await controller.init();
  const session = await controller.createSession(ids);
  await controller.getMastra()?.startWorkers();
  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  return { ...env, session, events };
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('tool answer that fails before its run starts', () => {
  async function suspended() {
    const env = await createSession('confirm');
    await env.session.sendMessage({ content: 'confirm it' });
    expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'suspended' });
    expect(env.session.run.isRunning()).toBe(false);
    env.events.length = 0;
    return env;
  }

  it('leaves the session idle with the suspension still parked, and the retry resumes it', async () => {
    const env = await suspended();
    const agent = env.session.machinery.getAgent();
    vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('resume dispatch failed'));

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.events.flatMap(event => (event.type === 'error' ? [event.error.message] : []))).toContain(
      'resume dispatch failed',
    );
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.run.getRunId()).toBeNull();
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(1);
    expect(env.events.some(event => event.type === 'agent_end')).toBe(false);
    expect(env.executed).toEqual([]);

    env.events.length = 0;
    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(env.executed).toEqual(['confirm']);
    expect(env.events.find(event => event.type === 'agent_end')).toMatchObject({ reason: 'complete' });
    expect(env.session.run.isRunning()).toBe(false);
    expect(env.session.displayState.get().pendingSuspensions.size).toBe(0);
  }, 30_000);

  it('keeps the run when someone else armed it while the resume was failing', async () => {
    const env = await suspended();
    let joinedSignal: AbortSignal | undefined;
    vi.spyOn(env.session.machinery.getAgent(), 'sendStreamResume').mockImplementationOnce(async () => {
      // A message or the subscription joining the run arms it again.
      joinedSignal = env.session.run.ensureAbortController().signal;
      throw new Error('resume failed');
    });

    await env.session.respondToToolSuspension({ resumeData: { ok: true } });

    expect(joinedSignal).toBeDefined();
    expect(env.session.run.isRunning()).toBe(true);
    expect(env.session.run.getAbortSignal()).toBe(joinedSignal);
    env.session.run.reset();
  }, 30_000);
});

describe('persisted tool approval that fails before its run starts', () => {
  it.each([true, false])(
    'leaves the session idle (approved: %s) and the retry settles the call',
    async approved => {
      const shared = stores();
      const first = await createSession('lookup', shared);
      void first.session.sendMessage({ content: 'use the tool' }).catch(() => {});
      await vi.waitFor(() => expect(first.events.some(event => event.type === 'tool_approval_required')).toBe(true), {
        timeout: 10_000,
      });
      agentThreadStreamRuntime.resetForTests();

      const env = await createSession('lookup', shared);
      const agent = env.session.machinery.getAgent();
      const suspendedRuns = async () =>
        (await agent.listSuspendedRuns({ threadId: ids.threadId, resourceId: ids.resourceId })).runs;
      await vi.waitFor(async () => expect(await suspendedRuns()).toHaveLength(1));
      vi.spyOn(agent, 'sendToolApproval').mockRejectedValueOnce(new Error('dispatch failed'));

      await expect(env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved })).rejects.toThrow(
        'dispatch failed',
      );

      expect(env.session.run.isRunning()).toBe(false);
      expect(env.session.run.getRunId()).toBeNull();
      expect(await suspendedRuns()).toHaveLength(1);

      await env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved });
      if (approved) await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
      await vi.waitFor(async () => expect(await suspendedRuns()).toEqual([]));
      expect(env.executed).toEqual(approved ? ['lookup'] : []);
    },
    30_000,
  );
});
