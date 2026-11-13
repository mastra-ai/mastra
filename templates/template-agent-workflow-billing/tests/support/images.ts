import { createServer } from 'node:http';
import { once } from 'node:events';
import { deflateSync } from 'node:zlib';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client/node';
import { crc32 } from '../../src/images/png-validation.js';
import { setupLocal } from '../../scripts/setup.js';
import { createBillingApplication } from '../../src/billing/application.js';
import { imageBillingCatalog } from '../../src/mastra/image-billing.js';
import { createBillingApp } from '../../src/billing/server/routes.js';
import { billingSocket } from './http.js';

export function pngFixture(width = 1024, height = 1024) {
  const chunk = (kind: string, data: Buffer) => {
    const bytes = Buffer.alloc(data.length + 12);
    bytes.writeUInt32BE(data.length);
    bytes.write(kind, 4, 'ascii');
    data.copy(bytes, 8);
    bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
    return bytes;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 3 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export async function imageBoundary() {
  const png = pngFixture();
  const images: Record<string, any>[] = [],
    models: Record<string, any>[] = [];
  let mode: 'success' | 'fake' | 'duplicate' | 'lost' | 'malformed' | 'partial' | 'stall' | 'oversized' | 'refusal' =
    'success';
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  let imageStarted = new Promise<void>(resolve => {
    started = resolve;
  });
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    if (request.url === '/v1/images/generations') {
      images.push(body);
      started?.();
      if (mode === 'stall')
        await new Promise<void>(resolve => {
          release = resolve;
        });
      if (mode === 'lost') {
        response.destroy();
        return;
      }
      if (mode === 'refusal' || (mode === 'partial' && images.length % 3 === 2)) {
        response.writeHead(400, { 'content-type': 'application/json' });
        response.end('{"error":{"message":"Controlled refusal"}}');
        return;
      }
      if (mode === 'oversized') {
        response.writeHead(200, { 'content-type': 'application/json', 'content-length': String(13 * 1024 * 1024) });
        response.end('{}');
        return;
      }
      response.writeHead(200, { 'content-type': 'application/json' });
      const [width, height] = String(body.size).split('x').map(Number);
      const generatedPng = pngFixture(width, height);
      response.end(
        JSON.stringify({
          data: [
            {
              b64_json:
                mode === 'malformed' ? Buffer.from('not a png').toString('base64') : generatedPng.toString('base64'),
            },
          ],
        }),
      );
      return;
    }
    models.push({ path: request.url!, body });
    const hasToolResult = body.input.some((item: any) => item.type === 'function_call_output');
    const tool = !hasToolResult && mode !== 'fake';
    const output = tool
      ? Array.from({ length: mode === 'duplicate' ? 2 : 1 }, (_, index) => ({
          type: 'function_call',
          id: `fc-${models.length}-${index}`,
          call_id: `call-${models.length}-${index}`,
          name: 'generateImage',
          arguments: '{}',
          status: 'completed',
        }))
      : [
          {
            id: `msg-${models.length}`,
            type: 'message',
            role: 'assistant',
            status: 'completed',
            content: [{ type: 'output_text', text: 'I generated three images at /tmp/forged.png.', annotations: [] }],
          },
        ];
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        id: `resp-${models.length}`,
        object: 'response',
        created_at: 1,
        status: 'completed',
        model: body.model,
        output,
        usage: {
          input_tokens: 3,
          input_tokens_details: { cached_tokens: 0 },
          output_tokens: 2,
          output_tokens_details: { reasoning_tokens: 0 },
          total_tokens: 5,
        },
      }),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No image boundary address');
  return {
    url: `http://127.0.0.1:${address.port}/v1`,
    png,
    images,
    models,
    mode: (selected: typeof mode) => {
      mode = selected;
      imageStarted = new Promise<void>(resolve => {
        started = resolve;
      });
    },
    started: () => imageStarted,
    release: () => release?.(),
    close: async () => {
      release?.();
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    },
  };
}
export async function imageFixture(
  options: { ttl?: number; executionMs?: number; environment?: NodeJS.ProcessEnv } = {},
) {
  const root = await mkdtemp(join(tmpdir(), 'billed-images-'));
  const boundary = await imageBoundary();
  const environment = {
    BILLING_PROJECT_ROOT: root,
    MASTRA_PROJECT_ROOT: root,
    BILLING_MODE: 'local',
    BILLING_PROVIDER: 'local',
    OPENAI_API_KEY: 'controlled',
    OPENAI_BASE_URL: boundary.url,
    ...options.environment,
  };
  const manifest = await setupLocal(environment);
  const catalog = imageBillingCatalog(
    environment,
    Object.values(manifest.profiles).map(profile => profile!.workspaceId),
  );
  if (options.ttl) Object.assign(catalog.definitions[1].policy, { suspendedReservationTtlMs: options.ttl });
  if (options.executionMs)
    for (const resource of catalog.definitions)
      Object.assign(resource.policy, {
        reservationBudget: {
          lifetimeMs: 3600000,
          executionMs: options.executionMs,
          finalizationMs: 1000,
          expiryMarginMs: 1000,
        },
      });
  let application = await createBillingApplication({ environment, catalog });
  let socket = await billingSocket(
    createBillingApp({
      organizations: application.organizations,
      execution: application.execution,
      commercial: application.runtime.commercial,
      artifacts: application.artifacts,
    }),
  );
  const database = createClient({ url: manifest.databaseUrl, intMode: 'bigint' });
  const owner = manifest.profiles.owner!,
    member = manifest.profiles.member!,
    outsider = manifest.profiles.outsider!;
  const base = `/billing/workspaces/${owner.workspaceId}`;
  const call = async (path: string, body?: unknown, key = 'image-once', profile = owner) => {
    const response = await fetch(`${socket.url}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        authorization: `Bearer ${profile.credential}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  return {
    root,
    environment,
    manifest,
    owner,
    member,
    outsider,
    boundary,
    base,
    database,
    call,
    application: () => application,
    url: () => socket.url,
    generate: (key = 'image-once', prompt = 'A blue bird in a quiet forest') =>
      call(`${base}/agents/image-agent/generate`, { prompt }, key),
    start: async (key: string, brief = 'A blue bird in a quiet forest') => {
      const created = await call(`${base}/workflows/image-kit/runs`, {}, key);
      const id = created.body.executionId;
      return {
        id,
        response: await call(`${base}/workflows/image-kit/runs/${id}/start`, { inputData: { brief } }, `${key}-start`),
      };
    },
    resume: (id: string, approved = true, key = 'approve-once') =>
      call(`${base}/workflows/image-kit/runs/${id}/resume`, { step: 'approval', resumeData: { approved } }, key),
    stop: async () => {
      await socket.close();
      await application.close();
    },
    restart: async () => {
      await socket.close();
      await application.close();
      application = await createBillingApplication({ environment, catalog });
      socket = await billingSocket(
        createBillingApp({
          organizations: application.organizations,
          execution: application.execution,
          commercial: application.runtime.commercial,
          artifacts: application.artifacts,
        }),
      );
    },
    close: async () => {
      database.close();
      await socket.close();
      await application.close();
      await boundary.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
