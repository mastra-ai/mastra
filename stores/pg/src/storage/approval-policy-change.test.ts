import { randomUUID } from 'node:crypto';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { MastraLanguageModelV2Mock, simulateReadableStream } from '@mastra/core/test-utils/llm-mock';
import { createTool } from '@mastra/core/tools';
import { Workspace } from '@mastra/core/workspace';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { connectionString } from './test-utils';
import { PostgresStore } from '.';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function makeModel() {
  let calls = 0;
  return new MastraLanguageModelV2Mock({
    doStream: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: simulateReadableStream({
          chunks:
            calls === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'tool-call', toolCallId: `call-${randomUUID()}`, toolName: 'transition', input: '{}' },
                  { type: 'finish', finishReason: 'tool-calls', usage },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'ok' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: 'stop', usage },
                ],
        }),
      };
    },
  } as never);
}

const stores: PostgresStore[] = [];
async function makeStorage() {
  const storage = new PostgresStore({
    id: `approval-${randomUUID()}`,
    connectionString,
    schemaName: `appr_${randomUUID().slice(0, 8)}`,
  });
  await storage.init();
  stores.push(storage);
  return storage;
}
afterAll(async () => {
  for (const s of stores) await s.close?.();
});

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
  const makeController = async (storage: PostgresStore) => {
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'test', model: makeModel(), tools: { transition } });
    const controller = new AgentController({
      workspace: new Workspace({ name: 'w', skills: ['/tmp/test-skills'] }),
      id: 'c',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
    } as never);
    await controller.init();
    return controller;
  };
  return { counter, makeController };
}

async function until(check: () => boolean, ms = 10_000) {
  const end = Date.now() + ms;
  while (!check() && Date.now() < end) await new Promise(r => setTimeout(r, 25));
  return check();
}

function approvalSeen(session: any) {
  let seen = false;
  session.subscribe((e: any) => {
    if (e.type === 'tool_approval_required') seen = true;
  });
  return () => seen;
}

describe('tool approval follows policy changes (Postgres)', () => {
  it('releases a parked approval when the tool policy changes to allow', async () => {
    const { counter, makeController } = setup();
    const controller = await makeController(await makeStorage());
    const session = await controller.createSession({ id: randomUUID(), ownerId: 'o' });
    const seen = approvalSeen(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(seen)).toBe(true);

    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
    expect(await until(() => counter.executed === 1)).toBe(true);
    // The run goes on to a second model turn and saves its snapshot; let it finish before the stores close.
    expect(await until(() => !session.run.isRunning())).toBe(true);
  }, 60_000);

  it('declines a parked approval when the tool policy changes to deny', async () => {
    const { counter, makeController } = setup();
    const controller = await makeController(await makeStorage());
    const session = await controller.createSession({ id: randomUUID(), ownerId: 'o' });
    const seen = approvalSeen(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(seen)).toBe(true);

    await session.permissions.setForTool({ toolName: 'transition', policy: 'deny' });
    expect(await until(() => !session.run.isRunning())).toBe(true);
    expect(counter.executed).toBe(0);
  });

  it('keeps tool permission rules when another controller reopens the session', async () => {
    const { makeController } = setup();
    const storage = await makeStorage();
    const id = randomUUID();
    const first = await makeController(storage);
    const session = await first.createSession({ id, ownerId: 'o' });
    await session.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
    const threadId = session.thread.getId();

    const second = await makeController(storage);
    const reopened = await second.createSession({ id, ownerId: 'o', threadId } as never);
    expect(reopened.permissions.getRules().tools).toMatchObject({ transition: 'allow' });
  });

  it('runs a call parked elsewhere once a reopening controller allows the tool on session create', async () => {
    const { counter, makeController } = setup();
    const storage = await makeStorage();
    const id = randomUUID();
    const first = await makeController(storage);
    const session = await first.createSession({ id, ownerId: 'o' });
    const threadId = session.thread.getId();
    const seen = approvalSeen(session);
    void session.sendMessage({ content: 'go' });
    expect(await until(seen)).toBe(true);

    const second = await makeController(storage);
    second.onSessionCreated(
      async reopened => {
        await new Promise(r => setTimeout(r, 50));
        await reopened.permissions.setForTool({ toolName: 'transition', policy: 'allow' });
      },
      { blocking: true },
    );
    const reopened = await second.createSession({ id, ownerId: 'o', threadId } as never);
    expect(reopened.permissions.getRules().tools).toMatchObject({ transition: 'allow' });
    expect(await until(() => counter.executed === 1)).toBe(true);
    expect(await until(() => !reopened.run.isRunning())).toBe(true);
  }, 60_000);
});
