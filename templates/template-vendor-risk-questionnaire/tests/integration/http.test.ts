import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { rename, rm } from 'node:fs/promises';
import { Hono } from 'hono';
import { studioAuth } from '../../src/mastra/server/auth.ts';
import { z } from 'zod';

const setup = vi.hoisted(() => ({
  root: `/tmp/vrq-http-${process.pid}-${Date.now()}`,
  prepare: vi.fn(),
}));
vi.mock('../../src/mastra/persistence/database.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/mastra/persistence/database.ts')>()),
  databaseUrl: `file:${setup.root}/test.db`,
  runtimeRoot: setup.root,
}));
vi.mock('../../src/mastra/runtime/respond.ts', () => ({ prepareResponse: setup.prepare }));
import { prepareDemo } from '../../scripts/generate-demo.ts';
import { questionnaireRoutes } from '../../src/mastra/server/routes.ts';
import { openRespondStore } from '../../src/mastra/persistence/respond.ts';

const app = new Hono();
for (const route of questionnaireRoutes)
  if ('handler' in route && route.handler) app.on(route.method, route.path, route.handler);
const upload = (name: string, content = 'questionnaire bytes') => {
  const body = new FormData();
  body.set('file', new File([content], name));
  return app.request('/vrq/questionnaires', { method: 'POST', body });
};
beforeAll(async () => {
  await prepareDemo(setup.root);
});
afterAll(async () => {
  await rm(setup.root, { recursive: true, force: true });
});

it('requires a configured token even in development and test modes', async () => {
  expect(() => studioAuth({ NODE_ENV: 'test' })).toThrow('MASTRA_STUDIO_TOKEN_REQUIRED');
  expect(() => studioAuth({ NODE_ENV: 'production', MASTRA_DEV: 'true' })).toThrow('MASTRA_STUDIO_TOKEN_REQUIRED');
  expect(studioAuth({ NODE_ENV: 'development', MASTRA_STUDIO_TOKEN: 'secret' })).toBeDefined();
  expect(() => studioAuth({ NODE_ENV: 'production' })).toThrow('MASTRA_STUDIO_TOKEN_REQUIRED');
  const auth = studioAuth({ NODE_ENV: 'production', MASTRA_STUDIO_TOKEN: 'secret' })!;
  expect(await auth.getCurrentUser(new Request('http://localhost'))).toBeNull();
  expect(
    await auth.getCurrentUser(new Request('http://localhost', { headers: { Authorization: 'Bearer wrong' } })),
  ).toBeNull();
  expect(
    await auth.getCurrentUser(new Request('http://localhost', { headers: { Authorization: 'Bearer secret' } })),
  ).toMatchObject({ id: 'operator' });
});
it('rejects unsupported and empty uploads before starting the workflow', async () => {
  expect((await upload('questionnaire.pdf')).status).toBe(400);
  expect((await upload('questionnaire.xlsx', '')).status).toBe(400);
  expect(setup.prepare).not.toHaveBeenCalled();
});
it('reports missing evidence configuration before dispatch and accepts uploads once restored', async () => {
  await rename(`${setup.root}/profile.json`, `${setup.root}/saved-profile.json`);
  const calls = setup.prepare.mock.calls.length;
  try {
    const response = await upload('questionnaire.xlsx');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'PROFILE_NOT_CONFIGURED' });
    expect(setup.prepare).toHaveBeenCalledTimes(calls);
    expect(await (await app.request('/vrq/questionnaires')).json()).toEqual([]);
  } finally {
    await rename(`${setup.root}/saved-profile.json`, `${setup.root}/profile.json`);
  }
  expect((await upload('questionnaire.xlsx')).status).toBe(202);
  await vi.waitFor(() => expect(setup.prepare).toHaveBeenCalledTimes(calls + 1));
});
it('persists source bytes before dispatch, lists failures and rejects premature downloads', async () => {
  setup.prepare.mockRejectedValueOnce(new Error('UNSUPPORTED_INTAKE'));
  const response = await upload('questionnaire.xlsx');
  expect(response.status).toBe(202);
  const { runId } = (await response.json()) as { runId: string };
  await vi.waitFor(async () => {
    const rows = (await (await app.request('/vrq/questionnaires')).json()) as Array<{ runId: string }>;
    expect(rows.find((r: { runId: string }) => r.runId === runId)).toMatchObject({
      name: 'questionnaire.xlsx',
      state: 'failed',
      error: 'UNSUPPORTED_INTAKE',
      download: null,
    });
  });
  const store = await openRespondStore(`file:${setup.root}/test.db`);
  try {
    expect(new TextDecoder().decode((await store.read(runId))!.source.bytes)).toBe('questionnaire bytes');
  } finally {
    store.close();
  }
  expect(setup.prepare).toHaveBeenCalledWith(expect.objectContaining({ resume: runId, workflow: expect.any(Object) }));
  expect((await app.request(`/vrq/questionnaires/${runId}/download`)).status).toBe(409);
  expect((await app.request(`/vrq/questionnaires/${runId}`)).status).toBe(200);
});
it('binds input to the current pending prompt and rejects replay', async () => {
  setup.prepare.mockImplementationOnce(async options => {
    await options.io.ask('Replace this exact inspected value? Type REPLACE: ');
  });
  const { runId } = (await (await upload('questionnaire.docx')).json()) as { runId: string };
  let detail: { prompt: { id: string } };
  await vi.waitFor(async () => {
    detail = (await (await app.request(`/vrq/questionnaires/${runId}`)).json()) as { prompt: { id: string } };
    expect(detail.prompt).toBeTruthy();
  });
  const send = (id: string) =>
    app.request(`/vrq/questionnaires/${runId}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, answer: 'REPLACE' }),
    });
  expect((await send(crypto.randomUUID())).status).toBe(409);
  expect((await send(detail!.prompt.id)).status).toBe(202);
  expect((await send(detail!.prompt.id)).status).toBe(409);
});
it('preserves a specific explanation-field error when background preparation fails', async () => {
  setup.prepare.mockRejectedValueOnce(
    new z.ZodError([
      {
        code: 'custom',
        path: [],
        message: 'Choice destinations require an explanation field for qualifications and gaps.',
        params: { code: 'EXPLANATION_FIELD_REQUIRED' },
      },
    ]),
  );
  const { runId } = (await (await upload('legacy.xlsx')).json()) as { runId: string };
  await vi.waitFor(async () => {
    expect(await (await app.request(`/vrq/questionnaires/${runId}`)).json()).toMatchObject({
      state: 'failed',
      error: 'EXPLANATION_FIELD_REQUIRED',
    });
  });
});
it('rejects unknown run IDs and malformed review decisions', async () => {
  expect((await app.request('/vrq/questionnaires/missing')).status).toBe(404);
  expect(
    (
      await app.request('/vrq/questionnaires/missing/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalApproval: true }),
      })
    ).status,
  ).toBe(400);
});

it('cancels pending intake, persists the terminal state and rejects later writes', async () => {
  let settled = false;
  setup.prepare.mockImplementationOnce(async options => {
    try {
      await options.io.ask('Map this region?');
    } finally {
      settled = true;
    }
  });
  const { runId } = (await (await upload('cancel.xlsx')).json()) as { runId: string };
  const path = `/vrq/questionnaires/${runId}`;
  let promptId = '';
  await vi.waitFor(async () => {
    const detail = (await (await app.request(path)).json()) as { state: string; prompt: { id: string } };
    expect(detail.state).toBe('awaiting_input');
    promptId = detail.prompt.id;
  });
  expect((await app.request(path, { method: 'DELETE' })).status).toBe(409);
  expect((await app.request(`${path}/cancel`, { method: 'POST' })).status).toBe(202);
  await vi.waitFor(async () => {
    expect(settled).toBe(true);
    expect(await (await app.request(path)).json()).toMatchObject({ state: 'cancelled', prompt: null, error: null });
  });
  expect((await app.request(`${path}/cancel`, { method: 'POST' })).status).toBe(202);
  expect((await app.request(`${path}/resume`, { method: 'POST' })).status).toBe(409);
  expect((await app.request(`${path}/download`)).status).toBe(409);
  expect(
    (
      await app.request(`${path}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: promptId, answer: 'map' }),
      })
    ).status,
  ).toBe(409);
});
it('signals running work and prevents removal until cancellation settles', async () => {
  const { executionSignal } = await import('../../src/mastra/runtime/cancellation.ts');
  let release!: () => void;
  let signal: AbortSignal | undefined;
  setup.prepare.mockImplementationOnce(async options => {
    signal = executionSignal(options.resume);
    await new Promise<void>(resolve => {
      release = resolve;
    });
  });
  const { runId } = (await (await upload('running.xlsx')).json()) as { runId: string };
  const path = `/vrq/questionnaires/${runId}`;
  await vi.waitFor(() => expect(signal).toBeDefined());
  try {
    expect((await app.request(`${path}/cancel`, { method: 'POST' })).status).toBe(202);
    expect(signal!.aborted).toBe(true);
    expect(await (await app.request(path)).json()).toMatchObject({ state: 'cancelling' });
    expect((await app.request(path, { method: 'DELETE' })).status).toBe(409);
  } finally {
    release();
  }
  await vi.waitFor(async () => expect(await (await app.request(path)).json()).toMatchObject({ state: 'cancelled' }));
  expect((await app.request(path, { method: 'DELETE' })).status).toBe(204);
  expect((await app.request(path)).status).toBe(404);
});
it('removes inactive questionnaires and denies every subsequent HTTP operation', async () => {
  const { runId } = (await (await upload('remove.xlsx')).json()) as { runId: string };
  const path = `/vrq/questionnaires/${runId}`;
  await vi.waitFor(async () => expect(await (await app.request(path)).json()).toMatchObject({ state: 'interrupted' }));
  expect((await app.request(`${path}/cancel`, { method: 'POST' })).status).toBe(409);
  expect((await app.request(path, { method: 'DELETE' })).status).toBe(204);
  const rows = (await (await app.request('/vrq/questionnaires')).json()) as Array<{ runId: string }>;
  expect(rows.some(row => row.runId === runId)).toBe(false);
  for (const suffix of ['', '/metrics', '/download']) expect((await app.request(path + suffix)).status).toBe(404);
  for (const suffix of ['/cancel', '/resume'])
    expect((await app.request(path + suffix, { method: 'POST' })).status).toBe(404);
  expect(
    (
      await app.request(`${path}/input`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crypto.randomUUID(), answer: 'map' }),
      })
    ).status,
  ).toBe(404);
  expect((await app.request(path, { method: 'DELETE' })).status).toBe(404);
});

it('limits active jobs across distinct run IDs and releases capacity after completion', async () => {
  const { startJob } = await import('../../src/mastra/server/questionnaire-jobs.ts');
  const ids = ['quota-one', 'quota-two', 'quota-three'];
  const store = await openRespondStore(`file:${setup.root}/test.db`);
  const { source } = await import('../fixtures/support.ts');
  for (const id of ids) await store.initialize(id, source(new TextEncoder().encode('content')));
  store.close();
  let release!: () => void;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  try {
    await startJob(ids[0]!, () => pending);
    await startJob(ids[1]!, () => pending);
    await expect(startJob(ids[2]!, async () => {})).rejects.toThrow('ACTIVE_RUN_LIMIT');
  } finally {
    release();
  }
  await vi.waitFor(async () =>
    expect(await (await app.request(`/vrq/questionnaires/${ids[0]}`)).json()).toMatchObject({ state: 'interrupted' }),
  );
  await expect(startJob(ids[2]!, async () => {})).resolves.toBeUndefined();
  await vi.waitFor(async () =>
    expect(await (await app.request(`/vrq/questionnaires/${ids[2]}`)).json()).toMatchObject({ state: 'interrupted' }),
  );
});
