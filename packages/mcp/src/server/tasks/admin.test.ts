import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it } from 'vitest';
import { BackgroundTaskMCPTaskStore } from './background-store';
import { InMemoryMCPTaskStore } from './in-memory-store';
import { principalKeyOf, taskKeyOf } from './store';
import type { MCPTaskStore, MCPTaskStoreAdmin, MCPTaskWork } from './store';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until<T>(read: () => Promise<T>, done: (value: T) => boolean): Promise<T> {
  let value = await read();
  for (let i = 0; i < 200 && !done(value); i++) {
    await sleep(20);
    value = await read();
  }
  return value;
}

/** `ask` waits for an answer, then completes with it; `wait` runs until it is cancelled. */
const works: Record<string, MCPTaskWork> = {
  ask: async attempt =>
    attempt.resume
      ? {
          status: 'completed',
          result: { content: [{ type: 'text', text: JSON.stringify(attempt.resume.inputResponses) }] },
        }
      : {
          status: 'input_required',
          inputRequests: {
            approve: {
              method: 'elicitation/create',
              params: { mode: 'form', message: 'Approve?', requestedSchema: { type: 'object', properties: {} } },
            },
          },
        },
  wait: attempt =>
    new Promise((_, reject) => attempt.signal.addEventListener('abort', () => reject(new Error('cancelled')))),
};

type Store = MCPTaskStore & MCPTaskStoreAdmin & { close(): void };

let mastra: Mastra | undefined;
let store: Store | undefined;

afterEach(async () => {
  store?.close();
  store = undefined;
  await mastra?.shutdown();
  mastra = undefined;
});

const stores: Array<[string, () => Promise<Store>]> = [
  ['InMemoryMCPTaskStore', async () => new InMemoryMCPTaskStore()],
  [
    'BackgroundTaskMCPTaskStore',
    async () => {
      mastra = new Mastra({ logger: false, storage: new InMemoryStore(), backgroundTasks: { enabled: true } });
      const background = new BackgroundTaskMCPTaskStore({
        manager: mastra.backgroundTaskManager!,
        serverId: 's',
        workFor: context => works[context.toolName]!,
        recoverFor: () => false,
      });
      background.registerTool('ask');
      background.registerTool('wait');
      return background;
    },
  ],
];

describe.each(stores)('%s admin view', (_name, make) => {
  async function start(toolName: 'ask' | 'wait', principal: string) {
    const task = await store!.create({ ttlMs: 60_000, principal, context: { toolName } });
    store!.run(task.taskId, works[toolName]!);
    return task.taskId;
  }

  it("lists every principal's tasks by key, newest first, without their ids", async () => {
    store = await make();
    const asking = await start('ask', 'alice');
    await sleep(5);
    const waiting = await start('wait', 'bob');
    await until(
      () => store!.get(asking, { principal: 'alice' }),
      task => task?.status === 'input_required',
    );

    const listed = await store.list();
    expect(listed.map(task => [task.taskKey, task.principalKey, task.context?.toolName, task.status])).toEqual([
      [taskKeyOf(waiting), principalKeyOf('bob'), 'wait', 'working'],
      [taskKeyOf(asking), principalKeyOf('alice'), 'ask', 'input_required'],
    ]);
    expect(listed[1]).toMatchObject({ ttlMs: 60_000, inputRequests: { approve: { method: 'elicitation/create' } } });
    const serialized = JSON.stringify(listed);
    expect(serialized).not.toContain(asking);
    expect(serialized).not.toContain(waiting);
    expect(serialized).not.toMatch(/"(alice|bob)"/);
    expect(await store.list({ limit: 1 })).toHaveLength(1);
  });

  it('answers by key through the same path as tasks/update, once', async () => {
    store = await make();
    const taskId = await start('ask', 'alice');
    const alice = { principal: 'alice' };
    await until(
      () => store!.get(taskId, alice),
      task => task?.status === 'input_required',
    );

    const answer = { approve: { action: 'accept', content: { ok: true } } };
    expect(await store.updateByKey(taskKeyOf(taskId), answer)).toBe('done');
    const done = await until(
      () => store!.get(taskId, alice),
      task => task?.status === 'completed',
    );
    expect(done).toMatchObject({ status: 'completed', result: { content: [{ text: JSON.stringify(answer) }] } });
    // The key is no longer open: a second answer changes nothing.
    expect(await store.updateByKey(taskKeyOf(taskId), answer)).toBe('ignored');
  });

  it('cancels by key; a later answer or cancel is ignored', async () => {
    store = await make();
    const taskId = await start('ask', 'alice');
    const alice = { principal: 'alice' };
    await until(
      () => store!.get(taskId, alice),
      task => task?.status === 'input_required',
    );

    expect(await store.cancelByKey(taskKeyOf(taskId))).toBe('done');
    expect(
      await until(
        () => store!.get(taskId, alice),
        task => task?.status === 'cancelled',
      ),
    ).toMatchObject({ status: 'cancelled' });
    expect(await store.updateByKey(taskKeyOf(taskId), { approve: { action: 'accept' } })).toBe('ignored');
    expect(await store.cancelByKey(taskKeyOf(taskId))).toBe('ignored');
    expect((await store.get(taskId, alice))?.status).toBe('cancelled');
  });

  it('cancels a working task of another principal by key', async () => {
    store = await make();
    const taskId = await start('wait', 'bob');
    expect(await store.cancelByKey(taskKeyOf(taskId))).toBe('done');
    expect(
      await until(
        () => store!.get(taskId, { principal: 'bob' }),
        task => task?.status === 'cancelled',
      ),
    ).toMatchObject({ status: 'cancelled' });
  });

  it('reports an unknown key, and does not accept a task id as a key', async () => {
    store = await make();
    const taskId = await start('wait', 'bob');
    expect(await store.cancelByKey('nope')).toBe('not_found');
    expect(await store.updateByKey('nope', {})).toBe('not_found');
    expect(await store.cancelByKey(taskId)).toBe('not_found');
    expect((await store.get(taskId, { principal: 'bob' }))?.status).toBe('working');
  });
});
