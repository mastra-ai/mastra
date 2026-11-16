import { createBillingApplication } from '../src/billing/application.js';
import { createImageAgent } from '../src/mastra/agents/image-agent.js';
import { imageAdapters } from '../src/images/image-adapters.js';
import { ImageService } from '../src/images/service.js';
import { ExecutionArtifacts } from '../src/billing/storage/artifacts.js';
import { billingConfigurationSchema } from '../src/billing/configuration/policy.js';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { setupLocal } from './setup.js';
import { createBillingApp } from '../src/billing/server/routes.js';
import { readImageProfile } from '../src/images/profile.js';
import { validatePng } from '../src/images/png-validation.js';

const proof = 'OpenAI image generation succeeds through the billed facade and private artifact store';
const directory = await mkdtemp(join(tmpdir(), 'image-openai-'));
const deadline = setTimeout(() => {
  console.error('OpenAI smoke exceeded its time limit; unverified.');
  process.exit(1);
}, 180000);
let application: Awaited<ReturnType<typeof createBillingApplication>> | undefined;
let server: ReturnType<typeof createServer> | undefined;
try {
  // Select only image credentials and profile overrides; payment state is not inherited.
  const environment = {
    MASTRA_PROJECT_ROOT: directory,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
    OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
    OPENAI_IMAGE_SIZE: process.env.OPENAI_IMAGE_SIZE,
    OPENAI_IMAGE_QUALITY: process.env.OPENAI_IMAGE_QUALITY,
  };
  const manifest = await setupLocal(environment);
  const images = new ImageService(environment, new ExecutionArtifacts(manifest.databaseUrl));
  const [adapter] = imageAdapters(images);
  const { resourcePolicies: _, ...configuration } = billingConfigurationSchema.parse({
    provider: 'local',
    resourcePolicies: [],
    billingKeys: { meters: [{ key: 'credits', unit: 'credits', funding: ['prepaid'] }] },
  });
  application = await createBillingApplication({
    environment,
    catalog: {
      configuration,
      artifacts: images,
      definitions: [
        {
          id: 'image-agent',
          kind: 'agent',
          create: () => createImageAgent(environment, images),
          ...adapter,
          operations: ['generate'],
          measurements: [],
          policy: { version: 'image-agent-v1', charge: { type: 'credits', meter: 'credits', units: 1 } },
        },
      ],
    },
  });
  const app = createBillingApp({
    organizations: application.organizations,
    execution: application.execution,
    commercial: application.runtime.commercial,
    artifacts: application.artifacts,
  });
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
  const url = `http://127.0.0.1:${address.port}/billing/workspaces/${owner.workspaceId}/agents/image-agent/generate`;
  const body = JSON.stringify({
    prompt: 'A small blue bird in a quiet forest, simple flat illustration without text.',
  });
  const request = async () => {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        authorization: `Bearer ${owner.credential}`,
        'content-type': 'application/json',
        'idempotency-key': 'live-image-once',
      },
      body,
      signal: AbortSignal.timeout(150000),
    });
    assert.equal(response.status, 200);
    return (await response.json()) as any;
  };
  const first = await request();
  assert.equal(first.billing.executionStatus, 'completed');
  assert.equal(first.billing.settlementStatus, 'settled');
  assert.equal(first.billing.billedUnits, 1);
  assert.equal(first.billing.replayed, false);
  assert.equal(first.result.object.artifacts.length, 1);
  const artifact = first.result.object.artifacts[0];
  const retrieved = await fetch(
    `http://127.0.0.1:${address.port}/billing/workspaces/${owner.workspaceId}/artifacts/${artifact.id}`,
    { headers: { authorization: `Bearer ${owner.credential}` }, redirect: 'error' },
  );
  assert.equal(retrieved.status, 200);
  const png = Buffer.from(await retrieved.arrayBuffer());
  validatePng(png);
  assert.equal(png.length, artifact.bytes);
  assert.equal(createHash('sha256').update(png).digest('hex'), artifact.sha256);
  const replay = await request();
  assert.deepEqual(replay.result, first.result);
  assert.equal(replay.billing.replayed, true);
  assert.equal(replay.billing.executionId, first.billing.executionId);
  await application.runtime.recovery.runOnce();
  const database = createClient({ url: manifest.databaseUrl });
  try {
    const slots = (
      await database.execute({
        sql: "SELECT artifact_id FROM image_slots WHERE execution_id = ? AND state = 'completed'",
        args: [first.billing.executionId],
      })
    ).rows;
    assert.deepEqual(
      slots.map(row => row.artifact_id),
      [artifact.id],
    );
    const artifacts = (
      await database.execute({
        sql: 'SELECT id FROM image_artifacts WHERE execution_id = ?',
        args: [first.billing.executionId],
      })
    ).rows;
    assert.deepEqual(
      artifacts.map(row => row.id),
      [artifact.id],
    );
    const operations = (
      await database.execute({
        sql: 'SELECT execution_id FROM billing_operations WHERE actor_id = ? AND workspace_id = ? AND key = ?',
        args: [owner.actorId, owner.workspaceId, 'live-image-once'],
      })
    ).rows;
    assert.deepEqual(
      operations.map(row => row.execution_id),
      [first.billing.executionId],
    );
    const balance = (
      await database.execute({
        sql: "SELECT m.balance FROM commercial_meters m JOIN billing_accounts a ON a.id = m.account_id WHERE m.key = 'credits' AND a.workspace_id = ?",
        args: [owner.workspaceId],
      })
    ).rows;
    assert.equal(Number(balance[0].balance), 29);
    const debits = (await database.execute('SELECT units FROM billing_ledger')).rows;
    assert.deepEqual(
      debits.map(row => Number(row.units)),
      [1],
    );
    console.log(
      JSON.stringify({
        proof,
        status: 'passed',
        imageProfile: readImageProfile(environment),
        textModel: 'openai/gpt-6-luna',
        textCallBound: 2,
        textOutputTokenBound: 400,
        imageCallBound: 1,
        artifactBytes: png.length,
        artifactSha256: artifact.sha256,
        artifactId: artifact.id,
        billedUnits: 1,
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
