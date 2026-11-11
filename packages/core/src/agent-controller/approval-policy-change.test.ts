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

/** First step calls `transition`, second step answers. */
function makeModel() {
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
                { type: 'tool-call', toolCallId: 'call-1', toolName: 'transition', input: '{}' },
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

function setup() {
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
  const makeController = async (storage: InMemoryStore) => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model: makeModel(),
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
  });
});
