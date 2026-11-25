/**
 * Processes started in different directories can share one resource id, and
 * with it one socket pubsub directory and one database. A thread belongs to the
 * process whose session runs it: another process has its own directory, tools
 * and credentials, so a step of that thread it runs does the wrong work in the
 * wrong place.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AgentController, Session } from '@mastra/core/agent-controller';
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
  vi.unstubAllEnvs();
  for (const stop of stops.splice(0).reverse()) await stop();
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

/** Reads `marker.txt` on the first turn, then answers. */
async function startModelServer() {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      requests.push(body);
      const chunk = (delta: object, finish: string | null = null) =>
        `data: ${JSON.stringify({ id: 'c', object: 'chat.completion.chunk', created: 0, model: 'model', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(
        (body.includes('"role":"tool"')
          ? chunk({ role: 'assistant', content: 'done' }) + chunk({}, 'stop')
          : chunk({
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: 'read-1',
                  type: 'function',
                  function: { name: 'mastra_workspace_read_file', arguments: '{"path":"marker.txt"}' },
                },
              ],
            }) + chunk({}, 'tool_calls')) + 'data: [DONE]\n\n',
      );
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  stops.push(() => new Promise(resolve => server.close(resolve)));
  const { port } = server.address() as AddressInfo;
  setCustomProvidersSource(() => [
    { name: 'Fixture LLM', url: `http://127.0.0.1:${port}/v1`, apiKey: 'sk-fixture', models: ['model'] },
  ]);
  return requests;
}

/** One process in its own project directory, on the shared database and socket directory. */
async function startProcess(name: string, storage: InMemoryStore) {
  const directory = await mkdtemp(join(tmpdir(), `steps-${name}-`));
  directories.push(directory);
  await writeFile(join(directory, 'marker.txt'), `written in ${name}`);
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
    unixSocketPubSub: true,
  });
  const controller = result.controller as AgentController<any>;
  stops.push(() => result.stopNotificationDispatch?.());
  stops.push(() => controller.getMastra()?.shutdown?.());
  await controller.init();
  const mastra = controller.getMastra()!;
  await mastra.startWorkers();
  const workflowEvents = vi.spyOn(mastra, 'handleWorkflowEvent');
  // Every run of the code agent in this process starts with `stream`.
  const agent = mastra.getAgentById('code-agent') as any;
  const runs = vi.spyOn(agent, 'stream');
  const session = (await controller.createSession({ id: `${name}-session`, ownerId: 'test' })) as Session<any>;
  await session.thread.create();
  await session.model.switch('fixture-llm/model');
  const errors: string[] = [];
  session.subscribe(event => {
    if (event.type === 'error') errors.push(event.error.message);
  });
  return { controller, session, agent, workflowEvents, runs, errors };
}

async function startTwoProcesses(experimental?: string) {
  const socketRoot = await mkdtemp('/tmp/mcrs-');
  directories.push(socketRoot);
  vi.stubEnv('MASTRACODE_SIGNALS_SOCKET_ROOT', socketRoot);
  vi.stubEnv('MASTRA_RESOURCE_ID', 'shared-resource');
  if (experimental) vi.stubEnv('MASTRACODE_EXPERIMENTAL_AGENT', experimental);
  const requests = await startModelServer();
  const storage = new InMemoryStore();
  const a = await startProcess('a', storage);
  const b = await startProcess('b', storage);
  // They share one socket directory: an ordinary event published in A reaches B.
  const crossed: unknown[] = [];
  await b.controller.getMastra()!.pubsub.subscribe('probe', event => void crossed.push(event));
  await a.controller.getMastra()!.pubsub.publish('probe', { type: 'probe', runId: 'probe', data: {} });
  await vi.waitFor(() => expect(crossed).toHaveLength(1));
  // What each model call that followed a read got back from it.
  const readMarker = () =>
    requests.flatMap(body =>
      (JSON.parse(body).messages as Array<{ role: string; content: string }>)
        .filter(message => message.role === 'tool')
        .map(message => message.content.match(/written in \w+/)?.[0]),
    );
  return { storage, a, b, readMarker };
}

describe.each([undefined, 'durable', 'evented'] as const)('two processes on one resource, agent %s', experimental => {
  it('runs every step of a turn in the process that started it', async () => {
    const { a, b, readMarker } = await startTwoProcesses(experimental);

    await a.session.sendMessage({ content: 'Read the marker.' });
    await vi.waitFor(() => expect(a.session.run.isRunning()).toBe(false), { timeout: 10_000 });

    expect(readMarker()).toEqual(['written in a']);
    expect(b.workflowEvents).not.toHaveBeenCalled();
    expect(b.runs).not.toHaveBeenCalled();
    expect(a.errors).toEqual([]);
  });
});

/**
 * B sends A's idle thread a notification, B wins three fires of the shared
 * dispatch schedule, then A runs one.
 */
async function notifyFromOtherProcess(priority: 'high' | 'low') {
  const { storage, a, b, readMarker } = await startTwoProcesses();
  const target = { resourceId: a.session.identity.getResourceId(), threadId: a.session.thread.getId()! };
  const sent = await b.agent.sendNotificationSignal(
    { source: 'inbox', kind: 'task', priority, summary: 'Note' },
    target,
  );
  const notifications = (await storage.getStore('notifications'))! as any;
  const dispatchFrom = (process: { controller: AgentController<any> }, minutesFromNow: number) =>
    dispatchDueNotifications({
      mastra: process.controller.getMastra()!,
      storage: notifications,
      now: new Date(Date.now() + 60_000 * minutesFromNow),
    });
  for (let pass = 1; pass <= 3; pass++) await dispatchFrom(b, pass);
  await dispatchFrom(a, 4);
  const getRecord = () => notifications.getNotification({ ...target, id: sent.record.id });
  return { a, b, readMarker, sent, getRecord };
}

describe('a notification one process sends to a thread another process runs', () => {
  it('wakes the thread in the process that runs it', async () => {
    const { a, b, readMarker, sent, getRecord } = await notifyFromOtherProcess('high');
    await vi.waitFor(() => expect(readMarker()).toHaveLength(1), { timeout: 10_000 });
    await vi.waitFor(() => expect(a.session.run.isRunning()).toBe(false), { timeout: 10_000 });

    expect(readMarker()).toEqual(['written in a']);
    expect(b.runs).not.toHaveBeenCalled();
    expect(a.errors).toEqual([]);
    expect(await getRecord()).toMatchObject({ status: 'delivered', deliveryAttempts: 0 });
    expect(sent.decision).toMatchObject({ action: 'defer', hold: true });
  });

  it('wakes neither process when it is low priority', async () => {
    const { a, b, sent, getRecord } = await notifyFromOtherProcess('low');
    await vi.waitFor(async () => expect((await getRecord()).summaryAt).toBeFalsy(), { timeout: 10_000 });

    expect(a.runs).not.toHaveBeenCalled();
    expect(b.runs).not.toHaveBeenCalled();
    expect(a.errors).toEqual([]);
    expect(sent.decision).toMatchObject({ action: 'summarize', hold: true });
  });
});
