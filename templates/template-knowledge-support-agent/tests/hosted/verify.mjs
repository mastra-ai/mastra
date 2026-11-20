import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createPortServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { startModelServer } from '../fixtures/model-server.ts';

const exec = promisify(execFile);
const template = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const lab = await mkdtemp(join(tmpdir(), 'support-hosted-proof-'));
const children = [];
const host = '127.0.0.1';
const source = 'docs:retailops#guides/network';
const confirmed = 'The terminal selected the guest network. After authorized selection, three checks succeeded.';
const caseSummary = 'Three hosted reference checks succeeded after authorized network selection.';
const keyFile = join(lab, 'issuer.key');
const certificate = join(lab, 'issuer.pem');
const coordination = join(lab, 'shared.writer.sqlite');
const issuer = 'https://identity.example.invalid';
const audience = 'knowledge-support';
const token = () => randomBytes(32).toString('base64url');
const [technician, reviewer, outsider, resourceSecret] = Array.from({ length: 4 }, token);

function bearerProfile(sub, tenantId, customerId, scope) {
  return {
    active: true,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iss: issuer,
    aud: audience,
    sub,
    tenant_id: tenantId,
    customer_id: customerId,
    scope,
  };
}

const profiles = new Map([
  [technician, bearerProfile('alex', 'retailops', 'store-42', 'support:technician')],
  [reviewer, bearerProfile('morgan', 'retailops', 'store-42', 'support:technician support:reviewer')],
  [outsider, bearerProfile('sam', 'fieldretail', 'store-42', 'support:technician')],
]);

async function freePort() {
  const listener = createPortServer().listen(0, host);
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise(done => listener.close(done));
  return port;
}

function start(program, args, env = process.env) {
  const child = spawn(program, args, { cwd: template, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', chunk => {
      output = (output + chunk).slice(-5000);
    });
  const exited = once(child, 'exit');
  exited.catch(() => undefined);
  const proc = { child, exited, output: () => output };
  children.push(proc);
  return proc;
}

async function stop(proc) {
  if (proc.child.exitCode === null && proc.child.signalCode === null) proc.child.kill();
  await proc.exited.catch(() => undefined);
}

async function ready(proc, url, access) {
  for (let attempt = 0; attempt < 120 && proc.child.exitCode === null; attempt++) {
    const response = await fetch(url, {
      headers: access ? { authorization: `Bearer ${access}` } : {},
      signal: AbortSignal.timeout(1000),
    }).catch(() => undefined);
    if (response?.ok) {
      await response.body?.cancel();
      return;
    }
    await response?.body?.cancel();
    await delay(100);
  }
  throw new Error(`Hosted proof service failed readiness at ${url}\n${proc.output()}`);
}

async function database(directory) {
  const port = await freePort();
  const url = `http://${host}:${port}`;
  const proc = start(process.env.SQLD_BIN ?? 'sqld', ['--http-listen-addr', `${host}:${port}`, '--db-path', directory]);
  await ready(proc, `${url}/health`);
  return { proc, url };
}

function request(worker, route, access, body) {
  return fetch(worker.url + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(access ? { authorization: `Bearer ${access}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(30000),
  });
}

async function json(response, expected = 200) {
  const received = await response;
  const body = await received.text();
  assert.equal(received.status, expected, body.slice(0, 2000));
  return JSON.parse(body);
}

const pageRoute = ref => `/api/knowledge/support/pages/${encodeURIComponent(ref)}`;
const runRoute = id => `/api/workflows/review/runs/${id}`;
const resumeRoute = id => `/api/workflows/review/resume-async?runId=${id}`;
const createThread = (worker, access) => {
  const { tenant_id, customer_id, sub } = profiles.get(access);
  return json(
    request(worker, '/api/memory/threads?agentId=support', access, {
      resourceId: JSON.stringify([tenant_id, customer_id, sub]),
    }),
  );
};
const turn = (worker, id, question) =>
  json(
    request(worker, '/api/agents/support/generate', technician, {
      messages: [{ role: 'user', content: question }],
      memory: { thread: id },
    }),
  );

let identityServer;
let model;
try {
  await exec(process.env.OPENSSL_BIN ?? 'openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    keyFile,
    '-out',
    certificate,
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ]);
  identityServer = createHttpsServer(
    { key: await readFile(keyFile), cert: await readFile(certificate) },
    async (req, res) => {
      if (
        req.method !== 'POST' ||
        req.url !== '/introspect' ||
        req.headers.authorization !== `Bearer ${resourceSecret}`
      ) {
        res.writeHead(401).end();
        return;
      }
      let body = '';
      for await (const chunk of req) body += chunk;
      const access = new URLSearchParams(body).get('token');
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify(profiles.get(access) ?? { active: false }));
    },
  ).listen(0, host);
  await once(identityServer, 'listening');
  const { port: identityPort } = identityServer.address();

  model = await startModelServer(body => {
    const messages = body.messages ?? [];
    const text = JSON.stringify(messages);
    if (text.includes('Review one confirmed customer outcome')) {
      assert.match(text, /three checks succeeded/u);
      return {
        content: JSON.stringify({
          action: 'page',
          target: null,
          title: 'Hosted Wi-Fi recovery',
          content: confirmed,
          record: {
            topicTags: ['connectivity'],
            observedOn: '2026-11-20',
            state: 'approved',
            summary: caseSummary,
            applicability: 'Use only after confirming the network selection.',
          },
          evidence: [],
          publicSource: null,
        }),
      };
    }
    assert.match(text, /pinned-knowledge/u);
    const userIndex = messages.findLastIndex(
      message => message.role === 'user' && !String(message.content).startsWith('<pinned-knowledge'),
    );
    const question = String(messages[userIndex]?.content);
    if (question.includes('previous case')) {
      assert.match(text, /Three hosted reference checks succeeded/u);
      return { content: caseSummary };
    }
    const tools = messages.slice(userIndex + 1).filter(message => message.role === 'tool');
    if (!tools.length) return { tool: { name: 'knowledge_read', arguments: { page: source } } };
    assert.match(JSON.stringify(tools), /squareup\.com/u);
    return { content: `Verify the intended Wi-Fi network [${source}].` };
  });
  const env = {
    ...process.env,
    SUPPORT_MODE: 'hosted',
    SUPPORT_EXAMPLE: 'retail-pos',
    SUPPORT_HOST: host,
    SUPPORT_DATABASE_AUTH_TOKEN: 'synthetic-hosted-db-token',
    SUPPORT_WRITER_LOCK_FILE: coordination,
    SUPPORT_OAUTH_INTROSPECTION_URL: `https://${host}:${identityPort}/introspect`,
    SUPPORT_OAUTH_INTROSPECTION_TOKEN: resourceSecret,
    SUPPORT_OAUTH_ISSUER: issuer,
    SUPPORT_OAUTH_AUDIENCE: audience,
    NODE_EXTRA_CA_CERTS: certificate,
    OPENAI_API_KEY: 'synthetic-hosted-proof',
    SUPPORT_MODEL_BASE_URL: model.url,
    MASTRA_TELEMETRY_DISABLED: '1',
  };
  delete env.SUPPORT_CREDENTIALS_FILE;
  delete env.SUPPORT_STUDIO_ROLE;

  async function worker(db) {
    const port = await freePort();
    const url = `http://${host}:${port}`;
    const proc = start(process.execPath, ['.mastra/output/index.mjs'], {
      ...env,
      PORT: String(port),
      SUPPORT_DATABASE_URL: db.url,
    });
    await ready(proc, `${url}/api/knowledge`, technician);
    return { proc, url };
  }

  const original = join(lab, 'primary');
  const db = await database(original);
  const seed = () =>
    exec('npm', ['run', 'knowledge:seed'], {
      cwd: template,
      env: { ...env, SUPPORT_DATABASE_URL: db.url },
      timeout: 30000,
    });
  const seeded = await seed();
  assert.match(seeded.stdout, /retail-pos-docs/u);
  const first = await worker(db);
  const second = await worker(db);
  assert.equal((await request(first, '/api/knowledge')).status, 401);
  assert.equal((await request(first, '/api/knowledge', token())).status, 401);
  const wrongAudience = token();
  profiles.set(wrongAudience, { ...profiles.get(technician), aud: 'different-service' });
  assert.equal((await request(first, '/api/knowledge', wrongAudience)).status, 401);
  assert.equal((await request(second, pageRoute(source), outsider)).status, 404);
  await json(request(second, pageRoute(source), technician));

  const draft = randomUUID();
  const generate = (worker, access) =>
    request(worker, '/api/agents/support/generate', access, {
      messages: [{ role: 'user', content: 'Draft Wi-Fi check' }],
      memory: { thread: draft },
    });
  const race = await Promise.all([generate(first, technician), generate(second, reviewer)]);
  assert.deepEqual(race.map(response => response.status).sort(), [200, 403]);
  await Promise.all(race.map(response => response.text()));

  const { id: thread } = await createThread(first, technician);
  assert.match((await turn(first, thread, 'Hosted Wi-Fi check')).text, /guides\/network/u);
  const messageRoute = `/api/memory/threads/${thread}/messages?agentId=support`;
  assert.match(JSON.stringify(await json(request(second, messageRoute, technician))), /Hosted Wi-Fi check/u);
  assert.equal((await request(second, messageRoute, outsider)).status, 403);
  const { confirmationReference } = await json(
    request(first, '/support/confirmations', technician, {
      threadId: thread,
      observation: 'The active device had selected the guest Wi-Fi network.',
      outcome: confirmed,
    }),
    201,
  );
  const { runId } = await json(request(first, '/api/workflows/review/create-run', reviewer, {}));
  const proposed = await json(
    request(first, `/api/workflows/review/start-async?runId=${runId}`, reviewer, {
      inputData: { confirmationReference, audience: 'private' },
    }),
  );
  assert.equal(proposed.status, 'suspended');
  const suspended = await json(request(second, runRoute(runId), reviewer));
  const proposal = suspended.steps['review-decision'].suspendPayload;
  const reference = `${proposal.destination.scope}#${proposal.destination.path}`;
  const approval = { decision: 'approve', revision: proposal.revision, reason: 'Verified the observed outcome.' };
  await stop(first.proc);

  const grant = profiles.get(reviewer);
  profiles.set(reviewer, { ...grant, scope: 'support:technician' });
  assert.equal(
    (
      await request(second, resumeRoute(runId), reviewer, {
        step: ['review-decision'],
        resumeData: approval,
      })
    ).status,
    403,
  );
  profiles.set(reviewer, grant);

  const sidecar = new DatabaseSync(coordination);
  sidecar.exec('BEGIN IMMEDIATE');
  try {
    await assert.rejects(seed, { code: 75 }, 'An admin seed sees the shared writer lock');
    const blocked = await json(
      request(second, resumeRoute(runId), reviewer, {
        step: ['review-decision'],
        resumeData: approval,
      }),
    );
    assert.equal(blocked.status, 'suspended');
    assert.equal((await request(second, pageRoute(reference), technician)).status, 404);
  } finally {
    sidecar.close();
  }
  const resumed = await json(
    request(second, resumeRoute(runId), reviewer, {
      step: ['publish-review'],
      resumeData: approval,
    }),
  );
  assert.equal(resumed.result.reference, reference);
  assert.equal(resumed.result.status, 'published');
  assert.deepEqual(resumed.result.decision, approval);

  const restarted = await worker(db);
  const published = await json(request(restarted, pageRoute(reference), technician));
  assert.match(JSON.stringify(published), /Three hosted reference checks succeeded/u);
  assert.equal((await request(restarted, pageRoute(reference), outsider)).status, 404);
  const { id: fresh } = await createThread(restarted, technician);
  assert.equal((await turn(restarted, fresh, 'Check the network from the previous case')).text, caseSummary);
  const beforeBackup = await json(request(second, runRoute(runId), reviewer));
  assert.deepEqual(beforeBackup.result.decision, approval);

  await stop(restarted.proc);
  await stop(second.proc);
  await stop(db.proc);
  const backup = join(lab, 'restored');
  await cp(original, backup, { recursive: true });
  const restoredDb = await database(backup);
  const restored = await worker(restoredDb);
  assert.match(
    JSON.stringify(await json(request(restored, pageRoute(reference), technician))),
    /Three hosted reference checks succeeded/u,
  );
  assert.match(JSON.stringify(await json(request(restored, messageRoute, technician))), /Hosted Wi-Fi check/u);
  const afterBackup = await json(request(restored, runRoute(runId), reviewer));
  assert.deepEqual(afterBackup.result, beforeBackup.result);
  const visibleRecords = JSON.stringify([
    afterBackup,
    await json(request(restored, messageRoute, technician)),
    published,
  ]);
  for (const secret of [technician, reviewer, outsider, resourceSecret]) assert.ok(!visibleRecords.includes(secret));
  console.log(
    'Hosted proof passed: two built workers, HTTPS identity, remote LibSQL, scope isolation, contention, approval after restart, history reuse, and restored Knowledge, Memory, and audit.',
  );
} finally {
  for (const proc of [...children].reverse()) await stop(proc);
  await model?.close();
  if (identityServer) await new Promise(done => identityServer.close(done));
  await rm(lab, { recursive: true, force: true });
}
