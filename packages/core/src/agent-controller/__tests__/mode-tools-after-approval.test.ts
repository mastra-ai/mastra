/**
 * A mode's `availableTools` keeps applying for the whole run: the model call
 * that continues a run after a tool approval, a decline, an `ask_user` answer
 * or a rejected plan must see the same tool subset the first call saw, not
 * every tool the agent owns.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { useLoopScenarioAimock } from '../../loop/test-utils/aimock/aimock-scenario';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage/mock';
import { createTool } from '../../tools';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

const ids = {
  id: 'mode-tools-session',
  ownerId: 'owner',
  resourceId: 'mode-tools-user',
  threadId: 'mode-tools-thread',
};

const getMock = useLoopScenarioAimock();

type FirstCall = { name: string; arguments: Record<string, unknown> };

function model(firstCall: FirstCall) {
  const llm = getMock();
  // The continuation carries the tool result (or the decline); the first call asks for the paused tool.
  llm.on(
    { endpoint: 'chat', predicate: req => req.messages.some(message => message.role === 'tool') },
    { content: 'done' },
  );
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', ...firstCall }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

function requestedToolNames() {
  return getMock()
    .getRequests()
    .map(request => (request.body?.tools ?? []).map(tool => tool.function.name).sort());
}

async function pausedInRestrictedMode({
  availableTools,
  firstCall,
  pausedEvent,
  transitionsTo,
}: {
  availableTools: string[];
  firstCall: FirstCall;
  pausedEvent: 'tool_approval_required' | 'tool_suspended';
  transitionsTo?: string;
}) {
  const executed: string[] = [];
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
  const writeNote = createTool({
    id: 'write_note',
    description: 'write a note to disk',
    inputSchema: z.object({ text: z.string() }),
    execute: async () => {
      executed.push('write_note');
      return { written: true };
    },
  });
  const agent = new Agent({
    id: 'mode-tools-agent',
    name: 'mode-tools-agent',
    instructions: 'test',
    model: model(firstCall),
    tools: { lookup, write_note: writeNote },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'mode-tools-controller',
    storage: new InMemoryStore(),
    memory: new MockMemory({ storage: new InMemoryStore() }),
    modes: [
      {
        id: 'read-only',
        name: 'Read only',
        default: true,
        agent,
        defaultModelId: 'mock-model',
        availableTools,
        transitionsTo,
      },
      // No availableTools: every agent tool is visible in this mode.
      { id: 'build', name: 'Build', agent, defaultModelId: 'mock-model' },
      { id: 'notes', name: 'Notes', agent, defaultModelId: 'mock-model', availableTools: ['write_note'] },
    ],
  });
  await controller.init();
  const session = await controller.createSession(ids);
  await controller.getMastra()?.startWorkers();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));

  if (pausedEvent === 'tool_suspended') {
    // Interactive built-ins suspend for the user's answer; allow them past the approval gate as Mastra Code does.
    await session.permissions.setForTool({ toolName: firstCall.name, policy: 'allow' });
  }
  void session.sendMessage({ content: 'use the tool' }).catch(() => {});
  await vi.waitFor(
    () => expect(events.some(event => event.type === pausedEvent && event.toolCallId === 'call-1')).toBe(true),
    { timeout: 10_000 },
  );
  // The first model call saw only the mode's subset.
  expect(requestedToolNames()).toEqual([[...availableTools].sort()]);

  return { session, executed };
}

async function continuationToolNames() {
  await vi.waitFor(() => expect(requestedToolNames()).toHaveLength(2), { timeout: 10_000 });
  return requestedToolNames()[1];
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('mode availableTools after a paused tool call', () => {
  const pausedOnLookup = () =>
    pausedInRestrictedMode({
      availableTools: ['lookup'],
      firstCall: { name: 'lookup', arguments: { q: 'x' } },
      pausedEvent: 'tool_approval_required',
    });

  it('keeps the mode subset on the continuation after an approval', async () => {
    const env = await pausedOnLookup();

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });

    const tools = await continuationToolNames();
    expect(env.executed).toEqual(['lookup']);
    expect(tools).toEqual(['lookup']);
    expect(tools).not.toContain('write_note');
  }, 30_000);

  it('keeps the mode subset on the continuation after a decline', async () => {
    const env = await pausedOnLookup();

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'decline' })).toEqual({
      accepted: true,
    });

    const tools = await continuationToolNames();
    expect(env.executed).toEqual([]);
    expect(tools).toEqual(['lookup']);
    expect(tools).not.toContain('write_note');
  }, 30_000);

  it('keeps the mode subset on the continuation after answering ask_user', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup', 'ask_user'],
      firstCall: { name: 'ask_user', arguments: { question: 'Which file?' } },
      pausedEvent: 'tool_suspended',
    });

    await env.session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: 'notes.md' });

    const tools = await continuationToolNames();
    expect(tools).toEqual(['ask_user', 'lookup']);
    expect(tools).not.toContain('write_note');
  }, 30_000);

  it('keeps the mode subset on the continuation after rejecting a plan', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup', 'submit_plan'],
      firstCall: { name: 'submit_plan', arguments: { path: '.mastracode/plans/p.md' } },
      pausedEvent: 'tool_suspended',
    });

    await env.session.respondToToolSuspension({
      toolCallId: 'call-1',
      resumeData: { action: 'rejected', feedback: 'not yet' },
    });

    const tools = await continuationToolNames();
    expect(tools).toEqual(['lookup', 'submit_plan']);
    expect(tools).not.toContain('write_note');
  }, 30_000);
});

describe('mode availableTools when the mode changes while a tool call is paused', () => {
  it('keeps the suspended run mode subset after switching to an unrestricted mode and approving', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup'],
      firstCall: { name: 'lookup', arguments: { q: 'x' } },
      pausedEvent: 'tool_approval_required',
    });
    await env.session.mode.switch({ modeId: 'build' });

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });

    const tools = await continuationToolNames();
    expect(env.executed).toEqual(['lookup']);
    expect(tools).toEqual(['lookup']);
  }, 30_000);

  it('keeps the suspended run mode subset after switching to another restricted mode and declining', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup'],
      firstCall: { name: 'lookup', arguments: { q: 'x' } },
      pausedEvent: 'tool_approval_required',
    });
    await env.session.mode.switch({ modeId: 'notes' });

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'decline' })).toEqual({
      accepted: true,
    });

    expect(await continuationToolNames()).toEqual(['lookup']);
  }, 30_000);

  it('keeps the suspended run mode subset after switching modes and answering ask_user', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup', 'ask_user'],
      firstCall: { name: 'ask_user', arguments: { question: 'Which file?' } },
      pausedEvent: 'tool_suspended',
    });
    await env.session.mode.switch({ modeId: 'build' });

    await env.session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: 'notes.md' });

    expect(await continuationToolNames()).toEqual(['ask_user', 'lookup']);
  }, 30_000);

  it('keeps the source run mode subset when answering ask_user on a non-active thread', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup', 'ask_user'],
      firstCall: { name: 'ask_user', arguments: { question: 'Which file?' } },
      pausedEvent: 'tool_suspended',
    });
    const address = env.session.suspensions.resolveAddress({ toolCallId: 'call-1' })!;
    expect(address).toBeDefined();
    await env.session.thread.create();
    await env.session.mode.switch({ modeId: 'build' });
    expect(env.session.thread.getId()).not.toBe(address.threadId);

    await env.session.respondToToolSuspension({ address, resumeData: 'notes.md' });

    expect(await continuationToolNames()).toEqual(['ask_user', 'lookup']);
  }, 30_000);

  it('applies the plan transition target, not the switched-to mode, after approving a plan', async () => {
    const env = await pausedInRestrictedMode({
      availableTools: ['lookup', 'submit_plan'],
      firstCall: { name: 'submit_plan', arguments: { path: '.mastracode/plans/p.md' } },
      pausedEvent: 'tool_suspended',
      transitionsTo: 'notes',
    });
    // `build` has no transition, so resolving from the live mode would keep every tool visible.
    await env.session.mode.switch({ modeId: 'build' });

    await env.session.respondToToolSuspension({ toolCallId: 'call-1', resumeData: { action: 'approved' } });

    expect(await continuationToolNames()).toEqual(['write_note']);
    expect(env.session.mode.get()).toBe('notes');
  }, 30_000);
});

describe('mode-level tools when the mode changes while a tool call is paused', () => {
  async function pausedWithModeTools({ startMode, firstCall }: { startMode: 'safe' | 'open'; firstCall: FirstCall }) {
    const executed: string[] = [];
    const deployTool = (impl: string) =>
      createTool({
        id: 'deploy',
        description: 'deploy the app',
        inputSchema: z.object({ target: z.string() }),
        requireApproval: true,
        execute: async () => {
          executed.push(impl);
          return { deployed: impl };
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
    const opsExtra = createTool({
      id: 'ops_extra',
      description: 'an operations-only tool',
      inputSchema: z.object({}),
      execute: async () => ({ ok: true }),
    });
    const agent = new Agent({
      id: 'mode-level-tools-agent',
      name: 'mode-level-tools-agent',
      instructions: 'test',
      model: model(firstCall),
      tools: { lookup },
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'mode-level-tools-controller',
      storage: new InMemoryStore(),
      memory: new MockMemory({ storage: new InMemoryStore() }),
      agent,
      modes: [
        {
          id: 'safe',
          name: 'Safe',
          default: startMode === 'safe',
          defaultModelId: 'mock-model',
          availableTools: ['deploy'],
          tools: { deploy: deployTool('safe-deploy') },
        },
        // No availableTools: every tool of the agent and of this mode is visible.
        { id: 'open', name: 'Open', default: startMode === 'open', defaultModelId: 'mock-model' },
        {
          id: 'ops',
          name: 'Ops',
          defaultModelId: 'mock-model',
          tools: { deploy: deployTool('ops-deploy'), ops_extra: opsExtra },
        },
      ],
    });
    await controller.init();
    const session = await controller.createSession(ids);
    await controller.getMastra()?.startWorkers();

    const events: AgentControllerEvent[] = [];
    session.subscribe(event => events.push(event));
    void session.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(
      () =>
        expect(events.some(event => event.type === 'tool_approval_required' && event.toolCallId === 'call-1')).toBe(
          true,
        ),
      { timeout: 10_000 },
    );
    return { session, executed };
  }

  it('runs the suspended mode tool implementation, not the switched-to mode one, after approving', async () => {
    const env = await pausedWithModeTools({
      startMode: 'safe',
      firstCall: { name: 'deploy', arguments: { target: 'prod' } },
    });
    await env.session.mode.switch({ modeId: 'ops' });

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });

    expect(await continuationToolNames()).toEqual(['deploy']);
    expect(env.executed).toEqual(['safe-deploy']);
  }, 30_000);

  it('does not add the switched-to mode tools to an unrestricted run after approving', async () => {
    const env = await pausedWithModeTools({ startMode: 'open', firstCall: { name: 'lookup', arguments: { q: 'x' } } });
    await env.session.mode.switch({ modeId: 'ops' });

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });

    const tools = await continuationToolNames();
    expect(env.executed).toEqual(['lookup']);
    expect(tools).toContain('lookup');
    expect(tools).not.toContain('ops_extra');
  }, 30_000);
});
