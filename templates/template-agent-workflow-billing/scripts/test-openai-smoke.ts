import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { setupLocal } from './setup.js';
import { createWeatherApplication } from '../src/mastra/setup.js';
import { createBillingApp } from '../src/server/billing.js';
import { weatherPrompt } from '../src/weather/observations.js';

const proof = 'weather agent produces a report through the billed local gateway';
const directory = await mkdtemp(join(tmpdir(), 'weather-openai-'));
const deadline = setTimeout(() => {
  console.error('OpenAI smoke exceeded its time limit; unverified.');
  process.exit(1);
}, 120000);
let application: Awaited<ReturnType<typeof createWeatherApplication>> | undefined;
let server: ReturnType<typeof createServer> | undefined;
try {
  // Select only the requested model key. No payment credentials or existing databases are inherited.
  const environment = {
    MASTRA_PROJECT_ROOT: directory,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  };
  const manifest = await setupLocal(environment);
  application = await createWeatherApplication(environment);
  const app = createBillingApp(
    application.organizations,
    application.execution,
    application.runtime.commercial,
    application.runtime.recovery,
  );
  server = createServer(async (request, response) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const result = await app.fetch(
        new Request(`http://127.0.0.1${request.url}`, {
          method: request.method,
          headers: request.headers as Record<string, string>,
          ...(['GET', 'HEAD'].includes(request.method!) ? {} : { body: Buffer.concat(chunks) }),
        }),
      );
      const headers: Record<string, string> = {};
      result.headers.forEach((value, key) => {
        headers[key] = value;
      });
      response.writeHead(result.status, headers);
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(500);
      response.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  const owner = manifest.profiles.owner!;
  const url = `http://127.0.0.1:${address.port}/billing/workspaces/${owner.workspaceId}/agents/weather-agent/generate`;
  const body = JSON.stringify({
    prompt: weatherPrompt({
      location: 'Porto Alegre',
      observedAt: '2026-11-08T12:00:00Z',
      temperatureC: 24,
      feelsLikeC: 26,
      humidityPercent: 70,
      windKph: 18,
      precipitationChancePercent: 60,
      conditions: 'Cloudy; showers possible',
    }),
  });
  const request = async () => {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${owner.credential}`,
        'content-type': 'application/json',
        'idempotency-key': 'live-weather-once',
      },
      body,
      signal: AbortSignal.timeout(90000),
    });
    assert.equal(response.status, 200);
    return (await response.json()) as any;
  };
  const first = await request();
  assert.equal(first.billing.executionStatus, 'completed');
  assert.equal(first.billing.billedUnits, 3);
  assert.equal(first.billing.replayed, false);
  assert(first.result.text.length >= 40 && /Porto Alegre|24|showers|rain/i.test(first.result.text));
  const replay = await request();
  assert.equal(replay.result.text, first.result.text);
  assert.equal(replay.billing.replayed, true);
  await application.runtime.recovery.runOnce();
  const database = createClient({ url: manifest.databaseUrl });
  try {
    const measurements = (
      await database.execute({
        sql: 'SELECT measure, SUM(units) AS units FROM billing_measurements WHERE execution_id = ? GROUP BY measure',
        args: [first.billing.executionId],
      })
    ).rows;
    const measured = Object.fromEntries(measurements.map(row => [String(row.measure), Number(row.units)]));
    assert.equal(measured['model-calls'], 1);
    assert(measured.tokens > 0);
    const balance = (await database.execute("SELECT balance FROM commercial_meters WHERE key = 'weather-credits'"))
      .rows;
    assert.equal(Number(balance[0].balance), 27);
    const debits = (await database.execute('SELECT units FROM billing_ledger')).rows;
    assert.deepEqual(
      debits.map(row => Number(row.units)),
      [3],
    );
    console.log(
      JSON.stringify({
        proof,
        status: 'passed',
        model: 'openai/gpt-6-luna',
        billedUnits: 3,
        actualTokens: measured.tokens,
        modelCalls: measured['model-calls'],
        replayedWithoutNewCall: true,
      }),
    );
  } finally {
    database.close();
  }
} finally {
  clearTimeout(deadline);
  if (server) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server!.close(() => resolve()));
  }
  await application?.close();
  await rm(directory, { recursive: true, force: true });
}
