import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';
import { Hono } from 'hono';
import { studioAuth } from '../../src/mastra/server/auth.ts';

const setup = vi.hoisted(() => ({
  root: `/tmp/vrq-http-${process.pid}-${Date.now()}`,
  prepare: vi.fn(),
  profile: vi.fn(),
}));
vi.mock('../../src/mastra/persistence/database.ts', async importOriginal => ({
  ...(await importOriginal<typeof import('../../src/mastra/persistence/database.ts')>()),
  databaseUrl: `file:${setup.root}/test.db`,
  runtimeRoot: setup.root,
}));
vi.mock('../../src/mastra/runtime/respond.ts', () => ({ prepareResponse: setup.prepare }));
vi.mock('../../src/mastra/runtime/profile.ts', () => ({ loadEvidenceProfile: setup.profile }));
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
  await mkdir(setup.root, { recursive: true });
  setup.profile.mockResolvedValue({});
});
afterAll(async () => {
  await rm(setup.root, { recursive: true, force: true });
});

it('enables SimpleAuth only in production and requires a configured token', async () => {
  expect(studioAuth({ NODE_ENV: 'test' })).toBeUndefined();
  expect(studioAuth({ NODE_ENV: 'production', MASTRA_DEV: 'true' })).toBeUndefined();
  expect(studioAuth({ NODE_ENV: 'development', MASTRA_STUDIO_TOKEN: 'secret' })).toBeUndefined();
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
