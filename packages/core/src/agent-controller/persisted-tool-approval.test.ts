/**
 * A tool approval parked before a restart is answered by a session on a fresh
 * controller: no gate is armed there, so the answer goes through the stored
 * suspended run.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../agent/thread-stream-runtime';
import { MockMemory } from '../memory/mock';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const ids = { id: 'approval-session', ownerId: 'owner', resourceId: 'approval-user', threadId: 'approval-thread' };

function model() {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const answered = JSON.stringify(prompt).includes('"type":"tool-result"');
      const parts = answered
        ? [
            { type: 'text-start' as const, id: 't' },
            { type: 'text-delta' as const, id: 't', delta: 'done' },
            { type: 'text-end' as const, id: 't' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ]
        : [
            { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'lookup', input: '{"q":"x"}' },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start' as const, warnings: [] },
          { type: 'response-metadata' as const, id: 'r', modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

function backend() {
  const storage = new InMemoryStore();
  const memoryStorage = new InMemoryStore();
  const executed: string[] = [];

  const boot = async () => {
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
      id: 'approval-agent',
      name: 'approval-agent',
      instructions: 'test',
      model: model(),
      tools: { lookup },
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'approval-controller',
      storage,
      memory: new MockMemory({ storage: memoryStorage }),
      modes: [{ id: 'default', name: 'Default', default: true, agent, defaultModelId: 'mock-model' }],
    });
    await controller.init();
    const session = await controller.createSession(ids);
    await controller.getMastra()?.startWorkers();
    return session;
  };

  /** Park the approval on one controller, then come back on a fresh one. */
  const parkThenRestart = async () => {
    const first = await boot();
    const events: AgentControllerEvent[] = [];
    first.subscribe(event => events.push(event));
    void first.sendMessage({ content: 'use the tool' }).catch(() => {});
    await vi.waitFor(() => expect(events.some(event => event.type === 'tool_approval_required')).toBe(true), {
      timeout: 10_000,
    });
    agentThreadStreamRuntime.resetForTests();
    const restarted = await boot();
    expect(restarted.approval.isArmed()).toBe(false);
    return restarted;
  };

  const suspendedRuns = async (session: Awaited<ReturnType<typeof boot>>) =>
    (await session.machinery.getAgent().listSuspendedRuns({ threadId: ids.threadId, resourceId: ids.resourceId })).runs;

  return { parkThenRestart, suspendedRuns, executed };
}

afterEach(() => {
  agentThreadStreamRuntime.resetForTests();
});

describe('Session.respondToPersistedToolApproval', () => {
  it('approves a tool call parked before a restart', async () => {
    const env = backend();
    const session = await env.parkThenRestart();

    await session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: true });

    await vi.waitFor(() => expect(env.executed).toEqual(['lookup']));
    await vi.waitFor(async () => expect(await env.suspendedRuns(session)).toEqual([]));
  }, 30_000);

  it('declines a tool call parked before a restart', async () => {
    const env = backend();
    const session = await env.parkThenRestart();

    await session.respondToPersistedToolApproval({ toolCallId: 'call-1', approved: false });

    await vi.waitFor(async () => expect(await env.suspendedRuns(session)).toEqual([]));
    expect(env.executed).toEqual([]);
  }, 30_000);

  it('rejects a tool call no stored run is waiting on', async () => {
    const env = backend();
    const session = await env.parkThenRestart();

    await expect(
      session.respondToPersistedToolApproval({ toolCallId: 'call-unknown', approved: true }),
    ).rejects.toThrow('No suspended run is waiting on tool call call-unknown');
    expect(await env.suspendedRuns(session)).toHaveLength(1);
    expect(env.executed).toEqual([]);
  }, 30_000);
});
