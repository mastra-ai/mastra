import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createPortServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { startModelServer } from '../fixtures/model-server.ts';

const exec = promisify(execFile);
const template = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const lab = await mkdtemp(join(tmpdir(), 'support-hosted-proof-'));
const children = [];
const clusters = [];
const backend = process.env.SUPPORT_TEST_BACKEND ?? 'libsql';
assert.ok(['libsql', 'postgres'].includes(backend), 'SUPPORT_TEST_BACKEND must be libsql or postgres');
const postgresBin = process.env.POSTGRES_BIN;
const postgres = (command, args) => exec(postgresBin ? join(postgresBin, command) : command, args, { timeout: 30000 });
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

function waitForExit(proc) {
  return Promise.race([
    proc.exited,
    delay(10000, undefined, { ref: false }).then(() => {
      throw new Error(`Hosted proof process did not exit: ${proc.output()}`);
    }),
  ]);
}

async function stop(proc) {
  if (proc.child.exitCode === null && proc.child.signalCode === null) {
    proc.child.kill();
    const exited = await Promise.race([
      proc.exited.then(
        () => true,
        () => true,
      ),
      delay(5000, false, { ref: false }),
    ]);
    if (!exited) proc.child.kill('SIGKILL');
  }
  await waitForExit(proc);
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
  if (backend === 'postgres') {
    await postgres('initdb', ['-D', directory, '-A', 'trust', '-U', 'support', '--no-locale', '--encoding=UTF8']);
    clusters.push(directory);
    await postgres('pg_ctl', [
      '-D',
      directory,
      '-l',
      `${directory}.log`,
      '-o',
      `-h ${host} -p ${port} -k ${lab}`,
      '-t',
      '20',
      '-w',
      'start',
    ]);
    const base = `postgresql://support@${host}:${port}`;
    await postgres('createdb', ['--maintenance-db', `${base}/postgres`, 'support']);
    return {
      url: `${base}/support`,
      async restore() {
        const backup = join(lab, 'support.dump');
        await postgres('pg_dump', ['--dbname', `${base}/support`, '--format=custom', '--file', backup]);
        await postgres('createdb', ['--maintenance-db', `${base}/postgres`, 'restored_support']);
        await postgres('pg_restore', ['--dbname', `${base}/restored_support`, '--no-owner', '--exit-on-error', backup]);
        return { url: `${base}/restored_support` };
      },
    };
  }
  const url = `http://${host}:${port}`;
  const proc = start(process.env.SQLD_BIN ?? 'sqld', ['--http-listen-addr', `${host}:${port}`, '--db-path', directory]);
  await ready(proc, `${url}/health`);
  return {
    proc,
    url,
    async restore() {
      await stop(proc);
      const restored = join(lab, 'restored');
      await cp(directory, restored, { recursive: true });
      return database(restored);
    },
  };
}

async function stopPostgres(directory) {
  const running = async () => {
    try {
      await postgres('pg_ctl', ['-D', directory, 'status']);
      return true;
    } catch (error) {
      if (error.code !== 3) throw error;
      return false;
    }
  };
  // pg_ctl reports the postmaster even while startup is still in progress.
  if (!(await running())) return;
  try {
    await postgres('pg_ctl', ['-D', directory, '-m', 'fast', '-t', '20', '-w', 'stop']);
  } catch (error) {
    if (await running()) throw error;
  }
}

async function verifyInterruptedSeed(databaseUrl, env, [first, second]) {
  const dataset = join(lab, 'revised-dataset');
  await cp(join(template, 'knowledge-datasets/retail-pos'), dataset, { recursive: true });
  const manifestPath = join(dataset, 'docs-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const page of manifest.pages.slice(0, 2)) page.title += ' (revised)';
  await writeFile(manifestPath, JSON.stringify(manifest));
  const args = [
    '--input-type=module',
    '-e',
    `import { datasets } from './src/examples/datasets.ts';
    import { seedDataset } from './src/mastra/knowledge/seed.ts';
    await seedDataset({ ...datasets['retail-pos-docs'], directory: process.env.PROOF_REVISED_DATASET });`,
  ];
  const workerEnv = { ...env, SUPPORT_DATABASE_URL: databaseUrl, PROOF_REVISED_DATASET: dataset };
  const admin = new Client({ connectionString: databaseUrl });
  await admin.connect();
  try {
    const snapshot = async () =>
      (
        await admin.query('SELECT id, name, version FROM mastra_knowledge_pages WHERE id = ANY($1) ORDER BY id', [
          [first.id, second.id],
        ])
      ).rows;
    const original = await snapshot();
    await admin.query('BEGIN');
    try {
      await admin.query('SELECT id FROM mastra_knowledge_pages WHERE id = $1 FOR UPDATE', [second.id]);
      const interrupted = start(process.execPath, args, workerEnv);
      let lockOwner;
      for (let attempt = 0; attempt < 100 && interrupted.child.exitCode === null; attempt++) {
        const { rows } = await admin.query(`SELECT pid FROM pg_locks
          WHERE locktype = 'advisory' AND objsubid = 2 AND granted
          AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND EXISTS (SELECT 1 FROM pg_locks waiting
            WHERE NOT waiting.granted AND pg_backend_pid() = ANY(pg_blocking_pids(waiting.pid)))`);
        if (rows.length) {
          lockOwner = rows[0].pid;
          break;
        }
        await delay(50);
      }
      assert.ok(lockOwner, `Revised seed did not reach the blocked page: ${interrupted.output()}`);
      const terminated = await admin.query('SELECT pg_terminate_backend($1, 5000) AS terminated', [lockOwner]);
      assert.equal(terminated.rows[0].terminated, true);
      await admin.query('ROLLBACK');
      const [code] = await waitForExit(interrupted);
      assert.equal(code, 1, interrupted.output());
      assert.deepEqual(await snapshot(), original, 'Losing the writer session must roll back the entire seed');
      await exec(process.execPath, args, { cwd: template, env: workerEnv, timeout: 30000 });
      const retried = await snapshot();
      assert.equal(retried.length, 2);
      for (const [index, row] of retried.entries()) {
        assert.equal(row.name, original[index].name + ' (revised)');
        assert.equal(row.version, original[index].version + 1);
      }
    } finally {
      await admin.query('ROLLBACK');
    }
  } finally {
    await admin.end();
  }
}

async function holdWriterLock(env, url) {
  const proc = start(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { withWriterLock } from './src/mastra/knowledge/writer-lock.ts'; import { setInterval } from 'node:timers/promises'; await withWriterLock(async () => { console.log('writer-held'); for await (const _ of setInterval(1000)) {} });",
    ],
    { ...env, SUPPORT_DATABASE_URL: url },
  );
  for (let attempt = 0; attempt < 100 && proc.child.exitCode === null; attempt++) {
    if (proc.output().includes('writer-held')) return proc;
    await delay(100);
  }
  throw new Error(`Writer lock holder failed: ${proc.output()}`);
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
let proofFailed = false;
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
  if (backend === 'postgres') {
    delete env.SUPPORT_WRITER_LOCK_FILE;
    delete env.SUPPORT_DATABASE_AUTH_TOKEN;
  }

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
  if (backend === 'postgres') {
    const report = JSON.parse(seeded.stdout.slice(seeded.stdout.indexOf('{')));
    await verifyInterruptedSeed(db.url, env, report.pages);
  }
  const first = await worker(db);
  const second = await worker(db);
  assert.equal((await request(first, '/api/knowledge')).status, 401);
  assert.equal((await request(first, '/api/knowledge', token())).status, 401);
  const wrongAudience = token();
  profiles.set(wrongAudience, { ...profiles.get(technician), aud: 'different-service' });
  assert.equal((await request(first, '/api/knowledge', wrongAudience)).status, 401);
  const oversizedIdentity = token();
  profiles.set(oversizedIdentity, { ...profiles.get(technician), padding: '界'.repeat(22000) });
  assert.equal((await request(first, '/api/knowledge', oversizedIdentity)).status, 401);

  assert.equal((await request(second, pageRoute(source), outsider)).status, 404);
  await json(request(second, pageRoute(source), technician));

  const generate = (worker, access, draft) =>
    request(worker, '/api/agents/support/generate', access, {
      messages: [{ role: 'user', content: 'Draft Wi-Fi check' }],
      memory: { thread: draft },
    });
  // Repeated first-use races protect against one worker overwriting another actor's thread binding.
  for (let attempt = 0; attempt < 20; attempt++) {
    const draft = randomUUID();
    const race = await Promise.all([generate(first, technician, draft), generate(second, reviewer, draft)]);
    assert.deepEqual(race.map(response => response.status).sort(), [200, 403]);
    const winner = race[0].status === 200 ? technician : reviewer;
    const loser = winner === technician ? reviewer : technician;
    await Promise.all(race.map(response => response.text()));
    const route = `/api/memory/threads/${draft}?agentId=support`;
    const saved = await json(request(second, route, winner));
    const { tenant_id, customer_id, sub } = profiles.get(winner);
    assert.equal(saved.resourceId, JSON.stringify([tenant_id, customer_id, sub]));
    assert.equal((await request(first, route, loser)).status, 403);
  }

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

  const holder = await holdWriterLock(env, db.url);
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
    await stop(holder);
  }
  await seed(); // The database session/OS lock is released when its owner exits.
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
  const restoredDb = await db.restore();
  const restored = await worker(restoredDb);
  const restoredPage = await json(request(restored, pageRoute(reference), technician));
  assert.match(JSON.stringify(restoredPage), /Three hosted reference checks succeeded/u);
  const restoredMemory = await json(request(restored, messageRoute, technician));
  assert.match(JSON.stringify(restoredMemory), /Hosted Wi-Fi check/u);
  assert.equal((await request(restored, pageRoute(reference), outsider)).status, 404);
  assert.equal((await request(restored, messageRoute, outsider)).status, 403);
  if (backend === 'postgres')
    assert.ok(
      !(await readdir(lab)).some(name => name.startsWith('shared.writer')),
      'PostgreSQL uses no shared lock file',
    );
  const afterBackup = await json(request(restored, runRoute(runId), reviewer));
  assert.deepEqual(afterBackup.result, beforeBackup.result);
  const visibleRecords = JSON.stringify([afterBackup, restoredMemory, restoredPage, published]);
  for (const secret of [technician, reviewer, outsider, resourceSecret]) assert.ok(!visibleRecords.includes(secret));
  console.log(
    `Hosted proof passed (${backend}): two built workers, HTTPS identity, scope isolation, contention and owner exit${backend === 'postgres' ? ', interrupted seed rollback' : ''}, approval after restart, history reuse, and restored Knowledge, Memory, and audit.`,
  );
} catch (error) {
  proofFailed = true;
  throw error;
} finally {
  const errors = [];
  const cleanup = async operation => {
    try {
      await operation();
    } catch (error) {
      errors.push(error);
    }
  };
  for (const proc of [...children].reverse()) await cleanup(() => stop(proc));
  for (const directory of clusters) await cleanup(() => stopPostgres(directory));
  await cleanup(() => model?.close());
  if (identityServer)
    await cleanup(
      () => new Promise((resolve, reject) => identityServer.close(error => (error ? reject(error) : resolve()))),
    );
  await cleanup(() => rm(lab, { recursive: true, force: true }));
  if (errors.length) {
    const failure = new AggregateError(errors, 'Hosted proof cleanup failed');
    if (!proofFailed) throw failure;
    console.error(failure);
  }
}
