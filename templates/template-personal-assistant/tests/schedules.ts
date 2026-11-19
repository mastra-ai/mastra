import type { AgentSchedule } from '@mastra/core/schedules';
import type { Schedule, ScheduleTrigger } from '@mastra/core/storage';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { json, startAssistant } from './helpers';
import { progressTurn } from './progress';

type App = Awaited<ReturnType<typeof startAssistant>>;
export async function nativeSchedule<T = unknown>(
  app: App,
  operation: string,
  input: Record<string, unknown> = {},
): Promise<T> {
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      app.child.off('message', listener);
      reject(new Error(`Native ${operation} timed out.`));
    }, 10000);
    /** Resolve only the matching native scheduler IPC response and propagate its actual error. */
    const listener = (message: { requestId?: string; result: T; error?: string }) => {
      if (message.requestId !== requestId) return;
      clearTimeout(timeout);
      app.child.off('message', listener);
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    };
    app.child.on('message', listener);
    app.child.send({ requestId, operation, input });
  });
}
/** Poll an observable native effect with a bounded deadline and report the last observed value. */
export async function eventually<T>(read: () => Promise<T>, matches: (value: T) => boolean): Promise<T> {
  let result: T;
  for (let attempt = 0; attempt < 300; attempt++) {
    result = await read();
    if (matches(result)) return result;
    await delay(25);
  }
  assert.fail(`Expected native effect was not observed: ${JSON.stringify(result!)}`);
}
export async function scheduleTurn(app: App, thread: string, input: Record<string, unknown>) {
  return progressTurn(app, thread, { calls: [[{ name: 'schedule', args: input }]] });
}
export async function schedules(app: App, status = 'active'): Promise<AgentSchedule[]> {
  return (await json(await app.request(`/schedules?status=${status}`))).schedules;
}
export async function occurrences(app: App, id: string): Promise<ScheduleTrigger[]> {
  return (await json(await app.request(`/schedules/${id}/triggers`))).triggers;
}
export async function history(app: App, thread: string) {
  return JSON.stringify(await json(await app.request(`/memory/threads/${thread}/messages?agentId=personalAssistant`)));
}
export const recurring = { kind: 'cron', cron: '0 0 9 * * 1-5', timezone: 'America/Sao_Paulo' };
export const monitorPrompt = JSON.stringify({
  scheduledResult: true,
  reuseCompleted: true,
  calls: [
    [{ name: 'google_mail_get_message', args: { id: 'source-message', format: 'full' } }],
    [{ name: 'google_docs_create_document', args: { title: 'Scheduled reviewed result' } }],
    [
      {
        name: 'google_docs_insert_text',
        args: {
          documentId: 'existing-document',
          text: 'Source source-message requires an offline-first editor and a recovery test.',
          location: { index: 1 },
        },
      },
    ],
  ],
});
export async function createMonitor(app: App, thread: string, requestId: string, prompt = monitorPrompt) {
  await scheduleTurn(app, thread, {
    action: 'create',
    requestId,
    name: 'Meeting monitor',
    prompt,
    timing: recurring,
  });
  const value = (await schedules(app)).find(value => value.threadId === thread);
  assert.ok(value, 'The conversation must persist its native monitor.');
  return value;
}
export async function dueNow(app: App, id: string, nextFireAt = Date.now() - 1000) {
  const row = await nativeSchedule<Schedule>(app, 'row', { id });
  await nativeSchedule(app, 'patch', { id, patch: { nextFireAt } });
  await nativeSchedule(app, 'tick');
  return row;
}
