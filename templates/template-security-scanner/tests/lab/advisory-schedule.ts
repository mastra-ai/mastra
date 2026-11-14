import { createClient } from '@libsql/client';
import { randomBytes } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'vitest';
import { loadSettings } from '../../src/config/settings.js';
import { startControlPlane } from '../../src/http/server.js';
import { AdvisorySource } from '../../src/advisory/source.js';
import type { AdvisoryModels } from '../../src/advisory/triage.js';

/** Exercise the opt-in advisory schedule against a local feed and persisted application state. */
export async function periodicAdvisoryLifecycle() {
  const root = await mkdtemp(join(tmpdir(), 'scanner-schedule-'));
  const requests: string[] = [];
  let failing = false;
  let holdStatus = false;
  let heldStatusResponse: ServerResponse | undefined;
  let statusEntered: (() => void) | undefined;
  let modelCalls = 0;
  const models: AdvisoryModels = {
    /** Fail the first local advisory recommendation and return a bounded recommendation on later calls. */
    async plan() {
      modelCalls++;
      if (modelCalls === 1) throw new Error('OWNED_MODEL_UNAVAILABLE');
      return {
        value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
        modelId: 'owned-local-model',
      };
    },
  };
  const fixture = createServer((request, response) => {
    const path = request.url ?? '/';
    requests.push(path);
    if (holdStatus && path === '/api/v1/status') {
      heldStatusResponse = response;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.flushHeaders();
      statusEntered?.();
      return;
    }
    const id = 'CVE-2026-42421';
    const value =
      path === '/api/v1/status'
        ? { polling: {}, history: {}, backfill: {}, storage: {} }
        : path === '/api/v1/entries'
          ? { entries: [{ id }], nextCursor: null }
          : path === `/api/v1/entries/${id}`
            ? {
                id,
                aliases: [],
                status: 'published',
                title: 'Owned recurring advisory',
                originalDescription: 'Harmless owned feed entry',
                affected: [],
                sources: [{ name: 'Owned fixture', url: 'https://example.invalid/advisory', license: 'fixture' }],
                modifiedAt: '2026-10-31T00:00:00.000Z',
              }
            : null;
    response.writeHead(failing ? 503 : value ? 200 : 404, { 'content-type': 'application/json' });
    response.end(JSON.stringify(failing ? { error: 'bounded-owned-outage' } : (value ?? {})));
  });
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address();
  if (!address || typeof address === 'string') throw new Error('FIXTURE_ADDRESS');
  const source = new AdvisorySource(`http://127.0.0.1:${address.port}`, true);
  const secret = randomBytes(32).toString('base64url');
  /** Build isolated advisory-schedule settings with the selected explicit enablement state. */
  const settings = (enabled: boolean) =>
    loadSettings(
      {
        CONTROL_BOOTSTRAP_SECRET: secret,
        SCANNER_ADVISORY_SYNC_ENABLED: String(enabled),
        ...(enabled
          ? { SCANNER_ADVISORY_SYNC_CRON: '* * * * *', SCANNER_ADVISORY_SYNC_TIMEZONE: 'America/Sao_Paulo' }
          : {}),
      },
      root,
    );
  let server: Awaited<ReturnType<typeof startControlPlane>> | undefined;
  let cookie = '',
    csrf = '';
  const start = async (enabled: boolean) => {
    server = await startControlPlane(
      settings(enabled),
      0,
      undefined,
      undefined,
      source,
      undefined,
      undefined,
      undefined,
      undefined,
      models,
    );
    const response = await fetch(`${server.url}/api/session`, {
      method: 'POST',
      headers: { origin: server.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret }),
    });
    expect(response.status).toBe(201);
    cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken;
  };
  /** Send an authenticated GET or POST to the real advisory-schedule fixture. */
  const request = async (path: string, body?: unknown) => {
    const response = await fetch(`${server!.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { origin: server!.url, cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: (await response.json()) as Record<string, any> };
  };
  let dueSequence = 0;
  const forceDue = async () => {
    const db = createClient({ url: settings(true).databaseUrl });
    try {
      await db.execute({
        sql: "UPDATE scanner_advisory_schedule SET data=json_set(data,'$.nextAt',?) WHERE singleton=1",
        args: [new Date(Date.UTC(2000, 0, 1, 0, dueSequence++)).toISOString()],
      });
    } finally {
      db.close();
    }
  };
  /** Invoke the actual native schedule and wait for a newly persisted scheduled event. */
  const runWake = async () => {
    const priorId = (await request('/api/advisory-schedule')).data.events[0]?.id;
    const schedule = (await server!.mastra.schedules.list()).find(item => item.workflowId === 'local-advisory-sync');
    expect(schedule).toMatchObject({ cron: '* * * * *', timezone: 'America/Sao_Paulo', status: 'active' });
    await server!.mastra.schedules.run(schedule!.id);
    for (let attempt = 0; attempt < 100; attempt++) {
      const status = await request('/api/advisory-schedule');
      if (status.data.events[0] && status.data.events[0].id !== priorId && status.data.events[0].state !== 'RUNNING')
        return status.data;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('SCHEDULE_EVENT_TIMEOUT');
  };
  try {
    expect(() => loadSettings({ SCANNER_ADVISORY_SYNC_ENABLED: 'true' }, root)).toThrow('Check supported values');
    expect(() =>
      loadSettings(
        {
          SCANNER_ADVISORY_SYNC_ENABLED: 'true',
          SCANNER_ADVISORY_SYNC_CRON: '* * * * *',
          SCANNER_ADVISORY_SYNC_TIMEZONE: 'not-a-timezone',
        },
        root,
      ),
    ).toThrow('Check supported values');
    await start(false);
    expect((await server!.mastra.schedules.list()).filter(item => item.workflowId === 'local-advisory-sync')).toEqual(
      [],
    );
    expect(requests).toEqual([]);
    await server!.close();
    await start(true);
    expect(requests).toEqual([]);
    await forceDue();
    const first = await runWake();
    expect(first.events).toHaveLength(1);
    expect(first.events[0].state).toBe('COMPLETE');
    expect(modelCalls).toBe(1);
    expect((await request('/api/advisories/CVE-2026-42421/triage-state')).data.hypothesis.state).toBe('pending');
    expect(requests.length).toBeGreaterThan(0);
    expect(requests.length).toBeLessThanOrEqual(65);
    expect(new Date(first.schedule.nextAt).getTime()).toBeGreaterThan(Date.now());
    const afterFirst = requests.length;
    await server!.close();
    await start(true);
    expect(requests).toHaveLength(afterFirst);
    expect((await request('/api/advisory-schedule')).data.events).toHaveLength(1);
    const current = (await request('/api/advisory-schedule')).data.schedule;
    expect((await request('/api/advisory-schedule/pause', { paused: true, revision: current.revision })).status).toBe(
      200,
    );
    await forceDue();
    const native = (await server!.mastra.schedules.list()).find(item => item.workflowId === 'local-advisory-sync')!;
    await server!.mastra.schedules.run(native.id);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(requests).toHaveLength(afterFirst);
    const paused = (await request('/api/advisory-schedule')).data.schedule;
    expect((await request('/api/advisory-schedule/pause', { paused: false, revision: paused.revision })).status).toBe(
      200,
    );
    failing = true;
    await forceDue();
    const skipped = await runWake();
    expect(skipped.events[0]).toMatchObject({ state: 'SKIPPED', reason: 'ADVISORY_STATUS_UNAVAILABLE' });
    expect(modelCalls).toBe(1);
    expect((await request('/api/advisories/CVE-2026-42421/triage-state')).data.hypothesis.state).toBe('pending');
    const checkpoint = await request('/api/advisories/status');
    expect(checkpoint.status).toBe(200);
    expect(checkpoint.data).toMatchObject({ stale: true, incomplete: true, failureCount: 1 });
    expect(new Date(checkpoint.data.nextRetryAt).getTime()).toBeGreaterThan(Date.now());
    const beforeBackoff = requests.length;
    await forceDue();
    const backoff = await runWake();
    expect(backoff.events[0]).toMatchObject({ state: 'FAILED', reason: 'ADVISORY_RETRY_NOT_DUE' });
    expect(requests).toHaveLength(beforeBackoff);
    await server!.close();
    await start(true);
    expect(
      (await request('/api/advisory-schedule')).data.events.some(
        (event: { state: string }) => event.state === 'SKIPPED',
      ),
    ).toBe(true);
    failing = false;
    const delay = Date.parse(checkpoint.data.nextRetryAt) - Date.now() + 25;
    expect(delay).toBeLessThanOrEqual(15000);
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    await forceDue();
    const recovered = await runWake();
    expect(recovered.events[0].state).toBe('COMPLETE');
    expect(modelCalls).toBe(2);
    expect((await request('/api/advisories/CVE-2026-42421/triage-state')).data.hypothesis.state).toBe('ready');
    expect((await request('/api/advisories/status')).data).toMatchObject({
      stale: false,
      failureCount: 0,
      failureCode: null,
    });

    const retained = await request('/api/advisories/CVE-2026-42421');
    expect(retained.status).toBe(200);
    expect(retained.data.revision).toBe(1);
    const beforeDisabled = requests.length;
    await forceDue();
    const oldScheduleId = (await server!.mastra.schedules.list()).find(
      item => item.workflowId === 'local-advisory-sync',
    )!.id;
    await server!.close();
    await start(false);
    expect((await server!.mastra.schedules.list()).filter(item => item.workflowId === 'local-advisory-sync')).toEqual(
      [],
    );
    expect(requests).toHaveLength(beforeDisabled);
    expect(await server!.mastra.schedules.get(oldScheduleId)).toBeNull();
    expect((await request('/api/advisory-schedule')).data.schedule.enabled).toBe(false);

    // A native tick blocked in a real feed body must fail on close without poisoning retry state.
    await server!.close();
    await start(true);
    await forceDue();
    holdStatus = true;
    const entered = new Promise<void>(resolve => {
      statusEntered = resolve;
    });
    const closingSchedule = (await server!.mastra.schedules.list()).find(
      item => item.workflowId === 'local-advisory-sync',
    )!;
    const wake = server!.mastra.schedules.run(closingSchedule.id).catch(() => undefined);
    /** Bound an asynchronous schedule observation and clear its timeout after settlement. */
    const within = async <T>(work: Promise<T>, code: string): Promise<T> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          work,
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(code)), 5000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    await within(entered, 'HELD_STATUS_NOT_ENTERED');
    await within(server!.close(), 'SCHEDULE_CLOSE_TIMEOUT');
    await wake;
    const db = createClient({ url: settings(true).databaseUrl });
    try {
      const event = await db.execute(
        'SELECT state,reason FROM scanner_advisory_schedule_events ORDER BY rowid DESC LIMIT 1',
      );
      const state = await db.execute('SELECT failure_count,stale FROM scanner_advisory_checkpoint WHERE singleton=1');
      expect(event.rows[0]).toMatchObject({ state: 'FAILED', reason: 'ADVISORY_SYNC_CLOSED' });
      expect(Number(state.rows[0]?.failure_count)).toBe(0);
      expect(Number(state.rows[0]?.stale)).toBe(0);
      expect(modelCalls).toBe(2);
    } finally {
      db.close();
    }
  } finally {
    heldStatusResponse?.destroy();
    await server?.close();
    await new Promise<void>((resolve, reject) => fixture.close(error => (error ? reject(error) : resolve())));
    await rm(root, { recursive: true, force: true });
  }
}
