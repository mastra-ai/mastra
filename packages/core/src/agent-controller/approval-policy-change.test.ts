import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { createTool } from '../tools';
import { AgentController } from './agent-controller';
import type { Session } from './session';
import { createMockWorkspace } from './test-utils';
import type { AgentControllerEvent } from './types';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/** First step calls `transition` (once per id), second step answers. */
function makeModel(callIds: string[] = ['call-1']) {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          calls === 1
            ? [
                { type: 'stream-start', warnings: [] },
                ...callIds.map(toolCallId => ({
                  type: 'tool-call' as const,
                  toolCallId,
                  toolName: 'transition',
                  input: '{}',
                })),
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'text-start', id: 't' },
                { type: 'text-delta', id: 't', delta: 'ok' },
                { type: 'text-end', id: 't' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

function setup(callIds?: string[]) {
  const counter = { executed: 0 };
  const transition = createTool({
    id: 'transition',
    description: 'Move the card',
    inputSchema: z.object({}),
    requireApproval: true,
    execute: async () => {
      counter.executed++;
      return { moved: true };
    },
  });
  // One model for every controller: a reopened run continues the same
  // conversation instead of replaying the first step's tool calls.
  const model = makeModel(callIds);
  const makeController = async (storage: InMemoryStore) => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      tools: { transition },
    });
    const controller = new AgentController({
      workspace: createMockWorkspace(),
      id: 'c',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    });
    await controller.init();
    return controller;
  };
  return { counter, makeController };
}

async function until(check: () => boolean, ms = 3_000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 10));
  return check();
}

function recordEvents(session: Session<any>) {
  const events: AgentControllerEvent[] = [];
  session.subscribe(e => events.push(e));
  return {
    events,
    approvalRequired: () => events.some(e => e.type === 'tool_approval_required'),
  };
}

describe('tool approval follows policy changes', () => {
  it('runs a requireApproval tool without a prompt when allow is set before the run', async () => {
    const { counter, makeController } = setup();
    const controller = await makeController(new InMemoryStore());
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
    const rec = recordEvents(session);

    await session.sendMessage({ content: 'go' });

    expect(rec.approvalRequired()).toBe(false);
    expect(counter.executed).toBe(1);
  });

  it('releases a parked approval when the tool policy changes to allow', async () => {
    const { counter, makeController } = setup();
    const controller = await makeController(new InMemoryStore());
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    const rec = recordEvents(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(rec.approvalRequired)).toBe(true);

    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });

    expect(await until(() => counter.executed === 1)).toBe(true);
  });

  it('declines a parked approval when the tool policy changes to deny', async () => {
    const { counter, makeController } = setup();
    const controller = await makeController(new InMemoryStore());
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    const rec = recordEvents(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(rec.approvalRequired)).toBe(true);

    await session.permissions.setForTool({ toolName: 'transition', policy: 'deny' });

    expect(await until(() => !session.run.isRunning())).toBe(true);
    expect(counter.executed).toBe(0);
  });

  it('keeps tool permission rules when another controller reopens the session', async () => {
    const { makeController } = setup();
    const storage = new InMemoryStore();
    const first = await makeController(storage);
    const session = await first.createSession({ id: 's', ownerId: 'o' });
    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
    const threadId = session.thread.getId();

    const second = await makeController(storage);
    const reopened = await second.createSession({ id: 's', ownerId: 'o', threadId } as never);

    expect(reopened.permissions.getRules().tools).toMatchObject({ transition: 'allow' });
  });

  it('runs a call parked elsewhere once a reopening controller allows the tool on session create', async () => {
    const { counter, makeController } = setup();
    const storage = new InMemoryStore();
    const first = await makeController(storage);
    const session = await first.createSession({ id: 's', ownerId: 'o' });
    const threadId = session.thread.getId();
    const rec = recordEvents(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(rec.approvalRequired)).toBe(true);
    await first.destroy();

    // Factory's recovery path: a blocking onSessionCreated hook allows the
    // tool after a lookup, on a process that never saw the original prompt.
    const second = await makeController(storage);
    second.onSessionCreated(
      async reopened => {
        await new Promise(r => setTimeout(r, 50));
        await reopened.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
      },
      { blocking: true },
    );
    const reopened = await second.createSession({ id: 's', ownerId: 'o', threadId } as never);

    expect(reopened.permissions.getRules().tools).toMatchObject({ transition: 'allow' });
    expect(await until(() => counter.executed === 1)).toBe(true);
    await new Promise(r => setTimeout(r, 200));
    expect(counter.executed).toBe(1);
  });

  it('runs both calls when one step parks two approvals and the tool becomes allowed', async () => {
    const { counter, makeController } = setup(['call-1', 'call-2']);
    const controller = await makeController(new InMemoryStore());
    const session = await controller.createSession({ id: 's', ownerId: 'o' });
    const rec = recordEvents(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(rec.approvalRequired)).toBe(true);

    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });

    expect(await until(() => counter.executed === 2)).toBe(true);
    expect(await until(() => !session.run.isRunning())).toBe(true);
    await new Promise(r => setTimeout(r, 100));
    expect(counter.executed).toBe(2);
  });

  it('keeps both rules when two setters run back to back', async () => {
    const { makeController } = setup();
    const controller = await makeController(new InMemoryStore());
    const session = await controller.createSession({ id: 's', ownerId: 'o' });

    await Promise.all([
      session.permissions.setForTool({ toolName: 'transition', policy: 'allow' }),
      session.permissions.setForTool({ toolName: 'other', policy: 'deny' }),
      session.permissions.setForCategory({ category: 'mcp', policy: 'allow' }),
    ]);

    expect(session.permissions.getRules()).toMatchObject({
      tools: { transition: 'allow', other: 'deny' },
      categories: { mcp: 'allow' },
    });
  });

  it('opens the session and saves the rule even when re-checking parked approvals fails', async () => {
    const { makeController } = setup();
    const storage = new InMemoryStore();
    const first = await makeController(storage);
    const session = await first.createSession({ id: 's', ownerId: 'o' });
    const threadId = session.thread.getId();

    const second = await makeController(storage);
    second.onSessionCreated(
      async reopened => {
        const agent = (reopened as any).machinery.getAgent();
        agent.listSuspendedRuns = async () => {
          throw new Error('storage down');
        };
      },
      { blocking: true },
    );
    const reopened = await second.createSession({ id: 's', ownerId: 'o', threadId } as never);
    await expect(reopened.permissions.setForTool({ toolName: 'transition', policy: 'allow' })).resolves.toBeUndefined();
    expect(reopened.permissions.getRules().tools).toMatchObject({ transition: 'allow' });
  });

  it('runs both parked calls once when a reopening controller allows the tool', async () => {
    const { counter, makeController } = setup(['call-1', 'call-2']);
    const storage = new InMemoryStore();
    const first = await makeController(storage);
    const session = await first.createSession({ id: 's', ownerId: 'o' });
    const threadId = session.thread.getId();
    const rec = recordEvents(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(rec.approvalRequired)).toBe(true);
    await first.destroy();

    const second = await makeController(storage);
    second.onSessionCreated(
      async reopened => {
        await reopened.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
      },
      { blocking: true },
    );
    await second.createSession({ id: 's', ownerId: 'o', threadId } as never);

    expect(await until(() => counter.executed === 2)).toBe(true);
    await new Promise(r => setTimeout(r, 200));
    expect(counter.executed).toBe(2);
  });
});
