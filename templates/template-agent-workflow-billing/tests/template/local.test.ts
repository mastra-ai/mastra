import { afterEach, expect, it } from 'vitest';
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  command,
  templateCopy,
  profileManifest,
  query,
  sanitizedEnvironment,
  serve,
  observations,
  assertNativeClosed,
} from '../support/template.js';
import { modelBoundary } from '../support/mastra.js';
import { weatherPrompt } from '../../src/weather/observations.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const semanticOnly = process.env.TEMPLATE_RUNTIME_ONLY === '1';

it('local setup is repeatable and weather generation needs no payment credentials', async () => {
  const copy = await templateCopy(!semanticOnly);
  cleanups.push(copy.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const env = { ...sanitizedEnvironment(), OPENAI_API_KEY: 'controlled-not-live', OPENAI_BASE_URL: model.url };
  expect(Object.keys(env).some(key => key.startsWith('POLAR_'))).toBe(false);
  const setup = await command(copy.root, ['run', 'setup'], env);
  expect(setup.code).toBe(0);
  if (!semanticOnly) expect(setup.output).toContain('added');
  const manifest = await profileManifest(copy.root);
  const privateBytes = await readFile(join(copy.root, 'data/local-profiles.json'));
  const environmentBytes = await readFile(join(copy.root, '.env'));
  expect((await stat(join(copy.root, '.env'))).mode & 0o777).toBe(0o600);
  expect((await stat(join(copy.root, 'data/local-profiles.json'))).mode & 0o777).toBe(0o600);
  expect(manifest.ready).toBe(true);
  expect(new Set(Object.values(manifest.profiles).map(profile => profile!.actorId)).size).toBe(3);
  const server = await serve(copy.root, env);
  cleanups.push(server.close);
  const base = `/billing/workspaces/${manifest.profiles.owner!.workspaceId}`;
  const generated = await server.call(
    `${base}/agents/weather-agent/generate`,
    { prompt: weatherPrompt(observations) },
    'owner',
    'first-weather',
  );
  expect(generated).toMatchObject({
    status: 200,
    body: { result: { text: 'ok' }, billing: { executionStatus: 'completed', billedUnits: 3 } },
  });
  const generatedCli = await command(
    copy.root,
    [
      'run',
      'weather',
      '--',
      'generate',
      '--key',
      'first-weather',
      '--json',
      JSON.stringify(observations),
      '--url',
      server.url,
    ],
    env,
  );
  expect(generatedCli.output).toContain('\"replayed\": true');
  expect(generatedCli.output).toContain('\"billedUnits\": 3');
  expect(model.requests).toHaveLength(1);
  expect(model.requests[0].body.model).toBe('gpt-6-luna');
  expect(model.requests[0].path).toBe('/v1/responses');
  expect(JSON.stringify(model.requests[0].body.input)).toContain('Porto Alegre');
  expect(model.requests[0].body.max_output_tokens).toBe(400);
  expect(model.requests[0].body).not.toHaveProperty('max_tokens');
  expect(model.requests[0].body.reasoning).toMatchObject({ effort: 'none' });
  await assertNativeClosed(server);
  expect(model.requests).toHaveLength(1);
  await expect
    .poll(
      async () =>
        Number(
          (await query(copy.root, 'SELECT balance FROM commercial_meters WHERE key = ?', ['weather-credits']))[0]
            .balance,
        ),
      { timeout: 45000, interval: 100 },
    )
    .toBe(27);
  const history = await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id');
  const membership = await query(copy.root, 'SELECT * FROM memberships ORDER BY workspace_id, identity_id');
  expect(history.map(row => Number(row.units))).toEqual([3]);
  await server.close();
  await command(copy.root, ['run', 'setup'], env);
  expect(await readFile(join(copy.root, 'data/local-profiles.json'))).toEqual(privateBytes);
  expect(await readFile(join(copy.root, '.env'))).toEqual(environmentBytes);
  expect(await query(copy.root, 'SELECT * FROM memberships ORDER BY workspace_id, identity_id')).toEqual(membership);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  expect(
    await query(copy.root, 'SELECT key, balance FROM commercial_meters WHERE key = ?', ['weather-credits']),
  ).toMatchObject([{ balance: 27 }]);
  expect(await query(copy.root, 'SELECT COUNT(*) AS count FROM billing_accounts')).toMatchObject([{ count: 1 }]);
  if (!semanticOnly) await command(copy.root, ['run', 'build'], env);
  const restarted = await serve(copy.root, env, semanticOnly ? 'dev' : 'start');
  cleanups.push(restarted.close);
  const replay = await restarted.call(
    `${base}/agents/weather-agent/generate`,
    { prompt: weatherPrompt(observations) },
    'owner',
    'first-weather',
  );
  expect(replay).toMatchObject({
    status: 200,
    body: { result: { text: 'ok' }, billing: { billedUnits: 3, replayed: true } },
  });
  expect(model.requests).toHaveLength(1);
  await assertNativeClosed(restarted);
  const cli = await command(copy.root, ['run', 'weather', '--', 'account', '--url', restarted.url], env);
  expect(cli.output).toContain('weather-credits');
  for (const profile of Object.values(manifest.profiles)) expect(cli.output.includes(profile!.credential)).toBe(false);
  expect(cli.output).not.toMatch(/externalReference|providerAccount|workspace:/);
  await restarted.close();
  const path = join(copy.root, 'data/local-profiles.json');
  await rename(path, path + '.saved');
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  await rename(path + '.saved', path);
  await writeFile(path, 'corrupt private state', { mode: 0o600 });
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  expect(await readFile(path, 'utf8')).toBe('corrupt private state');
  await writeFile(path, privateBytes);
  expect((await command(copy.root, ['run', 'setup'], { ...env, BILLING_PROVIDER: 'polar' }, false)).code).not.toBe(0);
  expect((await command(copy.root, ['run', 'setup'], { ...env, BILLING_MODE: 'production' }, false)).code).not.toBe(0);
  await query(copy.root, 'UPDATE local_credentials SET active = 0 WHERE identity_id = ?', [
    manifest.profiles.member!.actorId,
  ]);
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  expect(await readFile(path)).toEqual(privateBytes);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  expect(model.requests).toHaveLength(1);
}, 1200000);

it('weather examples demonstrate shared billing suspension and organization isolation', async () => {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const env = { ...sanitizedEnvironment(), OPENAI_API_KEY: 'controlled-not-live', OPENAI_BASE_URL: model.url };
  await command(copy.root, ['run', 'setup'], env);
  let server = await serve(copy.root, env);
  cleanups.push(() => server.close());
  const manifest = await profileManifest(copy.root);
  const base = `/billing/workspaces/${manifest.profiles.owner!.workspaceId}`;
  for (const profile of ['owner', 'member'] as const) {
    const response = await server.call(
      `${base}/agents/weather-agent/generate`,
      { prompt: weatherPrompt(observations) },
      profile,
      `${profile}-weather`,
    );
    expect(response).toMatchObject({
      status: 200,
      body: { billing: { workspaceId: manifest.profiles.owner!.workspaceId, billedUnits: 3 } },
    });
  }
  await expect
    .poll(
      async () =>
        Number(
          (await query(copy.root, 'SELECT balance FROM commercial_meters WHERE key = ?', ['weather-credits']))[0]
            .balance,
        ),
      { timeout: 45000, interval: 100 },
    )
    .toBe(24);
  const callsBefore = model.requests.length;
  expect(
    (
      await server.call(
        `${base}/agents/weather-agent/generate`,
        { prompt: weatherPrompt(observations) },
        'outsider',
        'outsider',
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await server.call(
        `${base}/agents/weather-agent/generate`,
        { prompt: '{"observations":{"humidityPercent":101}}' },
        'owner',
        'invalid',
      )
    ).status,
  ).toBe(400);
  expect(model.requests).toHaveLength(callsBefore);
  const create = async (key: string) =>
    (await server.call(`${base}/workflows/weather-report/runs`, {}, 'owner', key)).body.executionId as string;
  const path = (id: string) => `${base}/workflows/weather-report/runs/${id}`;
  const id = await create('report');
  const started = await server.call(`${path(id)}/start`, { inputData: observations }, 'owner', 'report-start');
  expect(started).toMatchObject({
    status: 200,
    body: {
      result: { status: 'suspended', suspendedSteps: ['approval'] },
      billing: { settlementStatus: 'reserved', billedUnits: null },
    },
  });
  expect(model.requests).toHaveLength(callsBefore + 1);
  expect(
    await query(copy.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [id]),
  ).toMatchObject([{ units: 1, active: 1 }]);
  expect((await server.call(path(id), undefined, 'member')).status).toBe(403);
  expect((await server.call(path(id), undefined, 'outsider')).status).toBe(403);
  expect(
    (await server.call(`${path(id)}/resume`, { step: 'approval', resumeData: { approved: true } }, 'member', 'steal'))
      .status,
  ).toBe(403);
  await server.close();
  server = await serve(copy.root, env);
  expect((await server.call(path(id))).body.result.status).toBe('suspended');
  expect(model.requests).toHaveLength(callsBefore + 1);
  await query(copy.root, 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?', [
    manifest.profiles.owner!.workspaceId,
    manifest.profiles.owner!.actorId,
  ]);
  expect(
    (
      await server.call(
        `${path(id)}/resume`,
        { step: 'approval', resumeData: { approved: true } },
        'owner',
        'fresh-resume',
      )
    ).status,
  ).toBe(403);
  expect(model.requests).toHaveLength(callsBefore + 1);
  await query(copy.root, "INSERT INTO memberships (workspace_id, identity_id, role) VALUES (?, ?, 'owner')", [
    manifest.profiles.owner!.workspaceId,
    manifest.profiles.owner!.actorId,
  ]);
  const resumeBody = {
    step: 'approval',
    resumeData: { approved: true, observations: { ...observations, temperatureC: 22 } },
  };
  const completed = await server.call(`${path(id)}/resume`, resumeBody, 'owner', 'fresh-resume');
  expect(completed).toMatchObject({
    status: 200,
    body: {
      result: { status: 'completed', output: { observations: { temperatureC: 22 }, draft: 'ok', report: 'ok' } },
      billing: { billedUnits: 1 },
    },
  });
  expect((await server.call(`${path(id)}/resume`, resumeBody, 'owner', 'fresh-resume')).body.billing.replayed).toBe(
    true,
  );
  expect(model.requests).toHaveLength(callsBefore + 2);
  expect(
    model.requests
      .at(-1)!
      .body.input.map((message: any) =>
        typeof message.content === 'string'
          ? message.content
          : message.content.map((part: { text: string }) => part.text).join('\n'),
      )
      .join('\n'),
  ).toContain('"temperatureC":22');
  expect(await query(copy.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [id])).toMatchObject([
    { units: 1 },
  ]);
  expect(
    await query(copy.root, 'SELECT COUNT(*) AS count FROM billing_outbox WHERE execution_id = ?', [id]),
  ).toMatchObject([{ count: 1 }]);
  const canceled = await create('cancel');
  await server.call(`${path(canceled)}/start`, { inputData: observations }, 'owner', 'cancel-start');
  const canceledResponse = await server.call(`${path(canceled)}/cancel`, {}, 'owner', 'cancel-report');
  expect(canceledResponse).toMatchObject({
    status: 200,
    body: { result: { status: 'canceled' }, billing: { billedUnits: 0, settlementStatus: 'released' } },
  });
  await server.call(`${path(canceled)}/cancel`, {}, 'owner', 'cancel-report');
  const failed = await create('failed');
  await server.call(`${path(failed)}/start`, { inputData: observations }, 'owner', 'failed-start');
  await server.call(
    `${path(failed)}/resume`,
    {
      step: 'approval',
      resumeData: { approved: true, observations: { ...observations, conditions: '[model-error]' } },
    },
    'owner',
    'failed-resume',
  );
  expect((await server.call(path(failed))).body).toMatchObject({
    result: { status: 'failed' },
    billing: { billedUnits: 0, settlementStatus: 'released' },
  });
  for (const nonbillable of [failed, canceled]) {
    expect(
      await query(copy.root, 'SELECT COUNT(*) AS count FROM billing_outbox WHERE execution_id = ?', [nonbillable]),
    ).toMatchObject([{ count: 0 }]);
    expect(
      await query(copy.root, 'SELECT active FROM billing_reservations WHERE execution_id = ?', [nonbillable]),
    ).toMatchObject([{ active: 0 }]);
  }
  for (const nonbillable of [failed, canceled]) {
    const preserved = await query(copy.root, 'SELECT input FROM billing_workflow_runs WHERE id = ?', [nonbillable]);
    expect(JSON.stringify(preserved)).toContain('Porto Alegre');
    expect(
      await query(
        copy.root,
        "SELECT SUM(units) AS units FROM billing_measurements WHERE execution_id = ? AND measure = 'model-calls'",
        [nonbillable],
      ),
    ).toMatchObject([{ units: nonbillable === failed ? 2 : 1 }]);
    expect(
      await query(
        copy.root,
        "SELECT SUM(units) AS units FROM billing_measurements WHERE execution_id = ? AND measure = 'tokens'",
        [nonbillable],
      ),
    ).toMatchObject([{ units: 5 }]);
  }
  const beforeClosure = model.requests.length;
  await assertNativeClosed(server, id);
  expect(model.requests).toHaveLength(beforeClosure);
  const previousPolicy = await create('previous-policy');
  await server.call(`${path(previousPolicy)}/start`, { inputData: observations }, 'owner', 'previous-policy-start');
  await server.close();
  server = await serve(copy.root, { ...env, WEATHER_WORKFLOW_POLICY: 'tokens' });
  expect(
    (
      await server.call(
        `${path(previousPolicy)}/resume`,
        { step: 'approval', resumeData: { approved: true } },
        'owner',
        'previous-policy-resume',
      )
    ).body.billing,
  ).toMatchObject({ billedUnits: 1, policyVersion: 'weather-report-task-v1' });
  const usage = await create('usage');
  await server.call(`${path(usage)}/start`, { inputData: observations }, 'owner', 'usage-start');
  const usageResponse = await server.call(
    `${path(usage)}/resume`,
    { step: 'approval', resumeData: { approved: true } },
    'owner',
    'usage-resume',
  );
  expect(usageResponse).toMatchObject({
    status: 200,
    body: { result: { status: 'completed' }, billing: { billedUnits: 10, observedUnits: 10 } },
  });
  const usageCanceled = await create('usage-cancel');
  await server.call(`${path(usageCanceled)}/start`, { inputData: observations }, 'owner', 'usage-cancel-start');
  expect(
    (await server.call(`${path(usageCanceled)}/cancel`, {}, 'owner', 'usage-cancel-end')).body.billing.billedUnits,
  ).toBe(0);
  const usageFailed = await create('usage-failed');
  await server.call(`${path(usageFailed)}/start`, { inputData: observations }, 'owner', 'usage-failed-start');
  await server.call(
    `${path(usageFailed)}/resume`,
    {
      step: 'approval',
      resumeData: { approved: true, observations: { ...observations, conditions: '[model-error]' } },
    },
    'owner',
    'usage-failed-resume',
  );
  expect((await server.call(path(usageFailed))).body.billing).toMatchObject({ billedUnits: 0, observedUnits: 5 });
  expect(model.requests.filter(request => request.scenario === 'model-error')).toHaveLength(2);
  await expect
    .poll(
      async () =>
        Number(
          (await query(copy.root, 'SELECT consumed FROM commercial_meters WHERE key = ?', ['weather-tokens']))[0]
            .consumed,
        ),
      { timeout: 45000, interval: 100 },
    )
    .toBe(10);
}, 600000);
