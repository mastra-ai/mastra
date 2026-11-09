import { expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { questionnaireAccess } from '../../src/mastra/server/auth.ts';
import { serviceLimits } from '../../src/mastra/contracts/service-limits.ts';

it('blocks cross-origin multipart uploads without the bearer secret before any work', async () => {
  const work = vi.fn();
  const app = new Hono();
  app.use('/vrq/*', questionnaireAccess({ MASTRA_DEV: 'true', MASTRA_STUDIO_TOKEN: 'test-only-secret' }));
  app.post('/vrq/questionnaires', c => {
    work();
    return c.json({ runId: 'accepted' }, 202);
  });
  for (const authorization of ['', 'Bearer wrong']) {
    const body = new FormData();
    body.set('file', new File(['data'], 'questionnaire.xlsx'));
    const response = await app.request('/vrq/questionnaires', {
      method: 'POST',
      body,
      headers: {
        Origin: 'https://untrusted.example',
        'Sec-Fetch-Site': 'cross-site',
        Authorization: authorization,
        Cookie: 'mastra-token=test-only-secret',
      },
    });
    expect(response.status).toBe(401);
  }
  expect(work).not.toHaveBeenCalled();
  expect(
    (
      await app.request('/vrq/questionnaires', {
        method: 'POST',
        headers: { Authorization: 'Bearer test-only-secret' },
      })
    ).status,
  ).toBe(202);
  expect(work).toHaveBeenCalledOnce();
});

it('bounds mutations across paths and resumes admission after the shared window', async () => {
  let now = 1_000;
  const app = new Hono();
  app.use(
    '/vrq/*',
    questionnaireAccess({ MASTRA_STUDIO_TOKEN: 'test-only-secret' }, () => now),
  );
  app.all('/vrq/*', c => c.json({ accepted: true }));
  const headers = { Authorization: 'Bearer test-only-secret' };
  for (let i = 0; i < serviceLimits.maxMutationsPerMinute; i++)
    expect((await app.request(`/vrq/run-${i}`, { method: 'POST', headers })).status).toBe(200);
  expect((await app.request('/vrq/new-run', { method: 'POST', headers })).status).toBe(429);
  expect((await app.request('/vrq/questionnaires', { headers })).status).toBe(200);
  now += 60_000;
  expect((await app.request('/vrq/new-run', { method: 'POST', headers })).status).toBe(200);
});
