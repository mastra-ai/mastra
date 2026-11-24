/**
 * An approval gate stays in step with the run it parks:
 * - an answer whose resume fails while the run is still parked re-arms the gate,
 *   so the answer can be retried instead of being lost;
 * - detaching the host leaves a parked approval in storage instead of declining it.
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

const ids = { id: 'gate-session', ownerId: 'owner', resourceId: 'gate-user', threadId: 'gate-thread' };

const getMock = useLoopScenarioAimock();

function model() {
  const llm = getMock();
  // Answered turns carry the tool result; everything else asks for the approval-gated tool.
  llm.on(
    { endpoint: 'chat', predicate: req => req.messages.some(message => message.role === 'tool') },
    { content: 'done' },
  );
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

async function parked() {
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
  const agent = new Agent({
    id: 'gate-agent',
    name: 'gate-agent',
    instructions: 'test',
    model: model(),
    tools: { lookup },
  });
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'gate-controller',
    storage: new InMemoryStore(),
    memory: new MockMemory({ storage: new InMemoryStore() }),
    modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
  });
  await controller.init();
  const session = await controller.createSession(ids);
  await controller.getMastra()?.startWorkers();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => events.push(event));
  const approvalPrompts = () =>
    events.filter(event => event.type === 'tool_approval_required' && event.toolCallId === 'call-1').length;
  const errors = () => events.flatMap(event => (event.type === 'error' ? [event.error.message] : []));

  const sent = session.sendMessage({ content: 'use the tool' }).catch(() => {});
  await vi.waitFor(() => expect(approvalPrompts()).toBe(1), { timeout: 10_000 });
  await vi.waitFor(async () => expect(await suspendedApprovals()).toEqual(['call-1']));

  async function suspendedApprovals() {
    const { runs } = await session.machinery
      .getAgent()
      .listSuspendedRuns({ threadId: ids.threadId, resourceId: ids.resourceId });
    return runs.flatMap(run => run.toolCalls.filter(call => call.requiresApproval).map(call => call.toolCallId));
  }

  return { session, sent, events, executed, approvalPrompts, errors, suspendedApprovals };
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('approval gate reconciliation', () => {
  it('re-arms the gate when the resume fails before it is dispatched', async () => {
    const env = await parked();
    vi.spyOn(env.session.machinery, 'buildToolsets').mockRejectedValueOnce(new Error('toolsets unavailable'));

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });
    await vi.waitFor(() => expect(env.approvalPrompts()).toBe(2));
    expect(env.errors()).toContain('toolsets unavailable');
    expect(env.session.approval.isArmed({ toolCallId: 'call-1' })).toBe(true);
    expect(env.executed).toEqual([]);

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });
    await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
    await vi.waitFor(async () => expect(await env.suspendedApprovals()).toEqual([]));
  }, 30_000);

  it('re-arms the gate when a dispatched resume fails and the run is still parked', async () => {
    const env = await parked();
    vi.spyOn(env.session.machinery.getAgent(), 'sendToolApproval').mockRejectedValueOnce(new Error('storage down'));

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });
    await vi.waitFor(() => expect(env.approvalPrompts()).toBe(2));
    expect(env.errors()).toContain('storage down');
    expect(env.session.approval.isArmed({ toolCallId: 'call-1' })).toBe(true);

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });
    await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
  }, 30_000);

  it('does not re-arm when a dispatched resume fails and the run is no longer parked', async () => {
    const env = await parked();
    const agent = env.session.machinery.getAgent();
    vi.spyOn(agent, 'sendToolApproval').mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(agent, 'listSuspendedRuns').mockResolvedValue({ runs: [] } as Awaited<
      ReturnType<typeof agent.listSuspendedRuns>
    >);

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });
    await vi.waitFor(() => expect(env.errors()).toContain('storage down'));
    expect(env.approvalPrompts()).toBe(1);
    expect(env.session.approval.isArmed()).toBe(false);
    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: false,
      reason: 'not_pending',
    });
  }, 30_000);

  it('keeps a parked approval in storage when the host detaches', async () => {
    const env = await parked();
    const decline = vi.spyOn(env.session, 'declineToolCall');

    env.session.thread.detachFromCurrent();

    expect(env.session.approval.isArmed()).toBe(false);
    expect(env.session.displayState.get().pendingApprovals.has('call-1')).toBe(false);
    // The run settles only after the engine has dispatched any (wrong) decline.
    await env.sent;
    expect(decline).not.toHaveBeenCalled();
    expect(await env.suspendedApprovals()).toEqual(['call-1']);
    expect(env.executed).toEqual([]);
    expect(env.errors()).toEqual([]);

    await env.session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true });
    await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
    await vi.waitFor(async () => expect(await env.suspendedApprovals()).toEqual([]));
  }, 30_000);

  it('still declines a parked approval on a plain abort', async () => {
    const env = await parked();

    env.session.abort();

    expect(env.session.approval.isArmed()).toBe(false);
    await vi.waitFor(async () => expect(await env.suspendedApprovals()).toEqual([]));
    expect(env.executed).toEqual([]);
  }, 30_000);
});
