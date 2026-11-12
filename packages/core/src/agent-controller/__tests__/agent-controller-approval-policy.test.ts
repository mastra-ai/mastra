/**
 * Regression for #30131: the controller must only gate tool calls its session
 * policy does not already allow, and must not serialize a step's tool calls
 * just because approval gating is on or a suspendable builtin (`ask_user`,
 * `submit_plan`) is registered.
 */
import { afterEach, describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../agent/thread-stream-runtime';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';

import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';

vi.setConfig({ testTimeout: 30_000 });

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

function createToolCallsStream(calls: { toolCallId: string; toolName: string; input?: string }[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      for (const call of calls) {
        controller.enqueue({
          type: 'tool-call',
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          input: call.input ?? '{}',
          providerExecuted: false,
        });
      }
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'done' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

async function setup({
  yolo,
  firstStep,
}: {
  yolo: boolean;
  firstStep: { toolCallId: string; toolName: string; input?: string }[];
}) {
  const executions: string[] = [];
  let active = 0;
  let maxActive = 0;
  const slow = createTool({
    id: 'slow',
    description: 'Takes a while',
    inputSchema: z.object({}),
    execute: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 150));
      active -= 1;
      executions.push('slow');
      return { ok: true };
    },
  });
  const deploy = createTool({
    id: 'deploy',
    description: 'Deploys',
    inputSchema: z.object({}),
    execute: async () => {
      executions.push('deploy');
      return { ok: true };
    },
  });

  let callCount = 0;
  const agent = new Agent({
    id: 'approval-policy-agent',
    name: 'Approval Policy Agent',
    instructions: 'Use the tools.',
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        callCount += 1;
        return { stream: callCount === 1 ? createToolCallsStream(firstStep) : createTextStream() };
      },
    }),
    tools: { slow, deploy },
  });

  const storage = new InMemoryStore();
  const mastra = new Mastra({ agents: { 'approval-policy-agent': agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent('approval-policy-agent');
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'approval-policy-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: 'approval-policy-session', ownerId: 'test-owner' });
  const events: any[] = [];
  session.subscribe(event => {
    events.push(event);
  });
  await session.thread.create();

  return {
    session,
    events,
    registeredAgent,
    executions,
    maxActive: () => maxActive,
    errors: () => events.filter(e => e.type === 'error'),
  };
}

describe('AgentController approval policy (#30131)', () => {
  it('runs a tool the session allows without an approval round trip', async () => {
    const env = await setup({ yolo: false, firstStep: [{ toolCallId: 'call-1', toolName: 'slow' }] });
    await env.session.permissions.setForTool({ toolName: 'slow', policy: 'allow' });
    const approvalSpy = vi.spyOn(env.registeredAgent, 'sendToolApproval');

    await env.session.sendMessage({ content: 'go' });

    expect(env.errors()).toEqual([]);
    expect(env.executions).toEqual(['slow']);
    expect(env.events.some(e => e.type === 'tool_approval_required')).toBe(false);
    expect(approvalSpy).not.toHaveBeenCalled();
  });

  it('still parks a tool whose policy is ask, and resumes it with the session policy', async () => {
    const env = await setup({ yolo: false, firstStep: [{ toolCallId: 'call-1', toolName: 'deploy' }] });
    const approvalSpy = vi.spyOn(env.registeredAgent, 'sendToolApproval');

    const sent = env.session.sendMessage({ content: 'deploy' });
    await vi.waitFor(() => expect(env.events.some(e => e.type === 'tool_approval_required')).toBe(true));
    expect(env.executions).toEqual([]);

    await env.session.respondToToolApproval({ decision: 'approve', toolCallId: 'call-1' });
    await sent;
    await vi.waitFor(() => expect(env.executions).toEqual(['deploy']));

    expect(env.errors()).toEqual([]);
    expect(approvalSpy).toHaveBeenCalledTimes(1);
    const [options] = approvalSpy.mock.calls[0] as [any];
    expect(options.requireToolApproval).toBeUndefined();
    expect(options.streamOptions.requireToolApproval).toEqual(expect.any(Function));
    expect(options.streamOptions.toolCallConcurrency).toEqual({ strategy: 'called' });
  });

  it.each([
    { label: 'allowed tools outside yolo', yolo: false },
    { label: 'yolo with suspendable builtins registered', yolo: true },
  ])('runs a step’s tool calls concurrently: $label', async ({ yolo }) => {
    const env = await setup({
      yolo,
      firstStep: [
        { toolCallId: 'call-1', toolName: 'slow' },
        { toolCallId: 'call-2', toolName: 'slow' },
      ],
    });
    if (!yolo) await env.session.permissions.setForTool({ toolName: 'slow', policy: 'allow' });

    await env.session.sendMessage({ content: 'go' });

    expect(env.errors()).toEqual([]);
    expect(env.executions).toEqual(['slow', 'slow']);
    expect(env.maxActive()).toBe(2);
  });
});
