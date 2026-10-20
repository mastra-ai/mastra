/**
 * A mode's `availableTools` keeps applying for the whole run: the model call
 * that continues a run after an approved or declined tool call must see the
 * same tool subset the first call saw, not every tool the agent owns.
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

function model() {
  const llm = getMock();
  // The continuation carries the tool result (or the decline); the first call asks for the gated tool.
  llm.on(
    { endpoint: 'chat', predicate: req => req.messages.some(message => message.role === 'tool') },
    { content: 'done' },
  );
  llm.on({ endpoint: 'chat' }, { toolCalls: [{ id: 'call-1', name: 'lookup', arguments: { q: 'x' } }] });
  return createOpenAI({ apiKey: 'aimock', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` })('gpt-4o-mini');
}

function requestedToolNames() {
  return getMock()
    .getRequests()
    .map(request => (request.body?.tools ?? []).map(tool => tool.function.name).sort());
}

async function parkedInReadOnlyMode() {
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
    model: model(),
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
        availableTools: ['lookup'],
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
      expect(events.some(event => event.type === 'tool_approval_required' && event.toolCallId === 'call-1')).toBe(true),
    { timeout: 10_000 },
  );
  // The first model call saw only the mode's subset.
  expect(requestedToolNames()).toEqual([['lookup']]);

  return { session, executed };
}

afterEach(() => {
  vi.restoreAllMocks();
  agentThreadStreamRuntime.resetForTests();
});

describe('mode availableTools after a tool approval', () => {
  it('keeps the mode subset on the continuation after an approval', async () => {
    const env = await parkedInReadOnlyMode();

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'approve' })).toEqual({
      accepted: true,
    });

    await vi.waitFor(() => expect(requestedToolNames()).toHaveLength(2), { timeout: 10_000 });
    expect(env.executed).toEqual(['lookup']);
    expect(requestedToolNames()[1]).toEqual(['lookup']);
    expect(requestedToolNames()[1]).not.toContain('write_note');
  }, 30_000);

  it('keeps the mode subset on the continuation after a decline', async () => {
    const env = await parkedInReadOnlyMode();

    expect(env.session.respondToToolApproval({ toolCallId: 'call-1', decision: 'decline' })).toEqual({
      accepted: true,
    });

    await vi.waitFor(() => expect(requestedToolNames()).toHaveLength(2), { timeout: 10_000 });
    expect(env.executed).toEqual([]);
    expect(requestedToolNames()[1]).toEqual(['lookup']);
    expect(requestedToolNames()[1]).not.toContain('write_note');
  }, 30_000);
});
