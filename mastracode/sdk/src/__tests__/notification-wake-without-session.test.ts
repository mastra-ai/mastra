/**
 * Every Mastra Code process shares one database, so one notification store and
 * one shared dispatch schedule. A process created with its own `pubsub` takes
 * turns running that schedule even for resources it has no session for. While
 * the owning process waits on a run parked on `ask_user`, a high-priority
 * notification for that thread stays due, and the process without a session
 * picked it up and woke the thread itself with no session context, so the run
 * failed with "No model available" on every attempt until the notification
 * failed. It must leave the notification for the process that owns the thread.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AgentController, Session } from '@mastra/core/agent-controller';
import { EventEmitterPubSub } from '@mastra/core/events';
import { dispatchDueNotifications } from '@mastra/core/notifications';
import { InMemoryStore } from '@mastra/core/storage';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setCustomProvidersSource } from '../agents/custom-provider-source.js';
import { createMastraCodeAgentController } from '../index.js';

const directories: string[] = [];
const stops: Array<() => Promise<unknown> | unknown> = [];
afterEach(async () => {
  setCustomProvidersSource(undefined);
  for (const stop of stops.splice(0).reverse()) await stop();
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

/**
 * An OpenAI-compatible model shared by both processes. Its first call asks the
 * user a question; any later call answers. Calls are recorded per process by
 * the API key each process's provider sends.
 */
async function startModelServer() {
  const calls: string[] = [];
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      calls.push(String(req.headers.authorization));
      const chunk = (delta: object, finish: string | null = null) =>
        `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'model', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(
        (calls.length === 1
          ? chunk({
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'ask-1',
                  type: 'function',
                  function: { name: 'ask_user', arguments: '{"question":"Which one?"}' },
                },
              ],
            }) + chunk({}, 'tool_calls')
          : chunk({ role: 'assistant', content: 'ok' }) + chunk({}, 'stop')) + 'data: [DONE]\n\n',
      );
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  stops.push(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address() as AddressInfo;
  setCustomProvidersSource(() => [
    { name: 'Fixture LLM', url: `http://127.0.0.1:${port}/v1`, apiKey: 'sk-fixture', models: ['model'] },
  ]);
  return calls;
}

/** One Mastra Code process in its own project directory, on the shared database. */
async function startProcess(name: string, storage: InMemoryStore, options: { pubsub?: EventEmitterPubSub } = {}) {
  const directory = await mkdtemp(join(tmpdir(), `notify-${name}-`));
  directories.push(directory);
  const result = await createMastraCodeAgentController({
    cwd: directory,
    homeDir: directory,
    settingsPath: join(directory, 'settings.json'),
    storage,
    storageBackend: 'libsql',
    workspace: new Workspace({ filesystem: new LocalFilesystem({ basePath: directory }) }),
    intervalHandlers: [],
    disableMcp: true,
    disableHooks: true,
    disablePlugins: true,
    disableGithubSignals: true,
    unixSocketPubSub: false,
    ...(options.pubsub ? { pubsub: options.pubsub } : {}),
  });
  const controller = result.controller as AgentController<any>;
  stops.push(() => result.stopNotificationDispatch?.());
  await controller.init();
  const session = (await controller.createSession({ id: `${name}-session`, ownerId: 'test' })) as Session<any>;
  await session.thread.create();
  await session.model.switch('fixture-llm/model');
  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });
  return { controller, session, errors };
}

/**
 * The owner parks a run on `ask_user` and a high-priority notification arrives
 * for that thread. Then another process, with its own `pubsub` and a session
 * only for a different resource, wins five fires of the shared schedule.
 */
async function notifyParkedOwnerAndDispatchElsewhere(ownerOptions: { pubsub?: EventEmitterPubSub } = {}) {
  const modelCalls = await startModelServer();
  const storage = new InMemoryStore();
  const owner = await startProcess('owner', storage, ownerOptions);
  const other = await startProcess('other', storage, { pubsub: new EventEmitterPubSub() });
  const resourceId = owner.session.identity.getResourceId();
  const threadId = owner.session.thread.getId()!;
  expect(other.session.identity.getResourceId()).not.toBe(resourceId);

  await owner.session.sendMessage({ content: 'Pick one for me.' });
  await vi.waitFor(() => expect(owner.session.displayState.get().pendingSuspensions.size).toBe(1));

  const codeAgent = owner.controller.getMastra()!.getAgentById('code-agent') as any;
  const sent = await codeAgent.sendNotificationSignal(
    { source: 'inbox', kind: 'task', priority: 'high', summary: 'New task' },
    { resourceId, threadId },
  );
  expect(sent.decision).toMatchObject({ reason: 'active-high-summary-then-full' });

  const notifications = (await storage.getStore('notifications'))! as any;
  const dispatchFrom = async (process: { controller: AgentController<any> }, minutesFromNow: number) => {
    const result = await dispatchDueNotifications({
      mastra: process.controller.getMastra()!,
      storage: notifications,
      now: new Date(Date.now() + 60_000 * minutesFromNow),
    });
    return result.failed.map(({ error }) => error);
  };
  const failed: string[] = [];
  for (let pass = 1; pass <= 5; pass++) failed.push(...(await dispatchFrom(other, pass)));
  const getRecord = () => notifications.getNotification({ threadId, id: sent.record.id });
  return { modelCalls, owner, other, failed, getRecord, dispatchFrom };
}

describe('a high-priority notification for a thread parked on ask_user', () => {
  it('is left for the owning process by a process with its own pubsub and no session for the thread', async () => {
    const { modelCalls, owner, failed, getRecord } = await notifyParkedOwnerAndDispatchElsewhere();
    const record = await getRecord();

    expect(failed).toEqual([]);
    expect(record).toMatchObject({ status: 'pending' });
    expect(record.deliveryAttempts ?? 0).toBe(0);
    expect(record.lastDeliveryError).toBeUndefined();
    expect(modelCalls).toHaveLength(1);
    expect(owner.errors).toEqual([]);
    // The question is still waiting for its answer.
    expect(owner.session.displayState.get().pendingSuspensions.size).toBe(1);
  }, 30_000);

  it('is delivered by the owning process once its thread is idle, when the owner also has its own pubsub', async () => {
    const { modelCalls, owner, other, failed, getRecord, dispatchFrom } = await notifyParkedOwnerAndDispatchElsewhere({
      pubsub: new EventEmitterPubSub(),
    });
    expect(failed).toEqual([]);

    // The user answers, and the owner's run finishes.
    await owner.session.respondToToolSuspension({ toolCallId: 'ask-1', resumeData: 'the first' });
    await vi.waitFor(() => expect(modelCalls).toHaveLength(2));
    await vi.waitFor(() => expect(owner.session.run.isRunning()).toBe(false));

    // The other process still leaves it alone.
    expect(await dispatchFrom(other, 6)).toEqual([]);
    expect((await getRecord()).status).toBe('pending');

    // The owner wins a later fire and delivers it.
    expect(await dispatchFrom(owner, 7)).toEqual([]);
    expect((await getRecord()).status).toBe('delivered');
    expect(owner.errors).toEqual([]);
  }, 30_000);
});
