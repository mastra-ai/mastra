/**
 * A Factory session whose thread lives in a file, so two worker processes see the same thread:
 * its settings (the run ends) and the ids of the messages that landed on it. The open-run ledger
 * lives in the shared Factory storage.
 * Everything else the dispatcher asks of a session is answered the way an idle session would.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TWO_WORKER_DIR_ENV = 'FACTORY_TWO_WORKER_DIR';
export const TWO_WORKER_PROJECT_ID = '11111111-2222-4333-8444-555555555555';

type ThreadFile = { settings: Record<string, unknown>; messages: Array<{ id: string; contents?: string }> };

function threadPath(dir: string) {
  return join(dir, 'thread.json');
}

export function readThread(dir: string): ThreadFile {
  const path = threadPath(dir);
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as ThreadFile) : { settings: {}, messages: [] };
}

function writeThread(dir: string, thread: ThreadFile) {
  const path = threadPath(dir);
  writeFileSync(`${path}.tmp`, JSON.stringify(thread));
  renameSync(`${path}.tmp`, path);
}

export function createFileSession(
  dir: string,
  options: {
    /** Whether a run this session started finishes here; a run that never ends stays active in this process. */
    runsFinish: boolean;
  },
) {
  const listeners = new Set<(event: { type: string; reason?: string }) => void>();
  const sent: Array<{ id: string; type?: string; contents?: string }> = [];
  let running = false;
  const session = {
    thread: {
      list: async () => [],
      create: async () => ({ id: 'thread-1' }),
      switch: async () => {},
      getSetting: async ({ key }: { key: string }) => readThread(dir).settings[key],
      getSettingOn: async ({ key }: { threadId: string; key: string }) => readThread(dir).settings[key],
      setSetting: async ({ key, value }: { key: string; value: unknown }) => {
        const thread = readThread(dir);
        thread.settings[key] = value;
        writeThread(dir, thread);
      },
      rename: async () => {},
      requireId: () => 'thread-1',
      getId: () => 'thread-1',
      listActiveMessages: async () => readThread(dir).messages,
    },
    stream: { isActive: () => false },
    abort: () => {},
    suspensions: { hasPending: () => false },
    run: { isRunning: () => running },
    getWorkspace: () => ({
      skills: {
        maybeRefresh: async () => {},
        get: async (name: string) => ({ name, instructions: 'Follow the skill.' }),
      },
    }),
    state: { get: () => ({ factoryProjectId: TWO_WORKER_PROJECT_ID }), set: async () => {} },
    model: { get: () => 'openai/gpt-5.6-sol' },
    mode: { get: () => 'build' },
    identity: { getId: () => 'session-1', getOwnerId: () => 'user-1' },
    permissions: { setForTool: async () => {} },
    sendMessage: async () => {},
    sendSignal: (input: { id: string; type?: string; contents?: string }) => {
      sent.push(input);
      const thread = readThread(dir);
      thread.messages.push({ id: input.id, contents: input.contents });
      writeThread(dir, thread);
      running = true;
      if (options.runsFinish) {
        queueMicrotask(() => {
          running = false;
          for (const listener of listeners) listener({ type: 'agent_end', reason: 'complete' });
        });
      }
      return { accepted: Promise.resolve({ accepted: true as const, action: 'wake' }) };
    },
    subscribe: (listener: (event: { type: string; reason?: string }) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    respondToToolSuspension: async () => {},
    sendNotificationSignal: async () => ({
      persisted: Promise.resolve(),
      accepted: Promise.resolve({ action: 'wake', output: { consumeStream: async () => {} } }),
    }),
  };
  const controller = {
    createSession: async () => session,
    getSession: async (sessionId: string) => (sessionId === 'session-1' ? session : undefined),
    // The run this process started is the only one it can see stepping.
    listActiveThreadRuns: () => (running ? [{ runId: 'run-1', threadId: 'thread-1' }] : []),
  };
  return { session, controller, sent };
}
