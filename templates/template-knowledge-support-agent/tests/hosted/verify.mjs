import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { EventEmitter, once } from 'node:events';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import { createConnection, createServer as createPortServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { startModelServer } from '../fixtures/model-server.ts';

const exec = promisify(execFile);
const template = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const lab = await mkdtemp(join(tmpdir(), 'support-hosted-proof-'));
const children = [];
const clusters = [];
const provider = process.env.SUPPORT_TEST_PROVIDER;
assert.ok(!provider || ['turso', 'neon', 'postgres'].includes(provider), 'Choose turso, neon, or postgres');
const backend = provider
  ? provider === 'turso'
    ? 'libsql'
    : 'postgres'
  : (process.env.SUPPORT_TEST_BACKEND ?? 'libsql');
assert.ok(['libsql', 'postgres'].includes(backend), 'SUPPORT_TEST_BACKEND must be libsql or postgres');
const postgresBin = process.env.POSTGRES_BIN;
const postgres = (command, args, env = process.env) =>
  exec(postgresBin ? join(postgresBin, command) : command, args, { env, timeout: 30000 });
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
const platformOrg = 'org-hosted-proof';
const [platformMember, secondPlatformMember, platformAdmin, platformViewer, foreignPlatformUser] = Array.from(
  { length: 5 },
  token,
);

const platformUsers = new Map(
  [
    [platformMember, 'member', 'member', platformOrg],
    [secondPlatformMember, 'colleague', 'member', platformOrg],
    [platformAdmin, 'reviewer', 'admin', platformOrg],
    [platformViewer, 'viewer', 'viewer', platformOrg],
    [foreignPlatformUser, 'outsider', 'admin', 'org-other'],
  ].map(([credential, id, role, organizationId]) => [
    credential,
    { user: { id, firstName: id, lastName: 'Example' }, role, organizationId, memberOrgIds: [organizationId] },
  ]),
);

function databaseEnv({ url, authToken }) {
  if (provider === 'turso') return { TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken };
  if (provider) return { DATABASE_URL: url };
  return { SUPPORT_DATABASE_URL: url, ...(authToken ? { SUPPORT_DATABASE_AUTH_TOKEN: authToken } : {}) };
}

function bearerProfile(sub, tenantId, customerId, scope) {
  return {
    active: true,
    token_use: 'access',
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

class PortCollision extends Error {}
const addressInUse = /EADDRINUSE|address already in use/iu;

async function bindWithRetry(launch) {
  for (let retries = 4; ; retries--) {
    try {
      return await launch(await freePort());
    } catch (error) {
      if (!(error instanceof PortCollision) || retries === 0) throw error;
    }
  }
}

function start(program, args, env = process.env, cwd = template, ipc = false) {
  const child = spawn(program, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe', ...(ipc ? ['ipc'] : [])] });
  let boundPort;
  child.on('message', message => {
    if (message?.type === 'server-ready') boundPort = message.port;
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', chunk => {
      output = (output + chunk).slice(-5000);
    });
  const exited = once(child, 'close');
  exited.catch(() => undefined);
  const proc = { child, exited, output: () => output, boundPort: () => boundPort };
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

async function ready(proc, url, check) {
  for (let attempt = 0; attempt < 120 && proc.child.exitCode === null && proc.child.signalCode === null; attempt++) {
    if (await check().catch(() => false)) return;
    await delay(100);
  }
  if (proc.child.exitCode !== null || proc.child.signalCode !== null) await waitForExit(proc);
  const message = `Hosted proof service failed readiness at ${url}\n${proc.output()}`;
  if (addressInUse.test(proc.output())) throw new PortCollision(message);
  throw new Error(message);
}

function querySqld(url, authToken) {
  return fetch(`${url}/v2/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${authToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql: 'SELECT 1' } }, { type: 'close' }] }),
    signal: AbortSignal.timeout(1000),
  });
}

async function database(directory) {
  if (backend === 'postgres') {
    const password = token();
    const passwordFile = `${directory}.password`;
    await writeFile(passwordFile, `${password}\n`, { mode: 0o600, flag: 'wx' });
    try {
      await postgres('initdb', [
        '-D',
        directory,
        '-A',
        'scram-sha-256',
        '-U',
        'support',
        '--no-locale',
        '--encoding=UTF8',
        '--pwfile',
        passwordFile,
      ]);
    } finally {
      await rm(passwordFile, { force: true });
    }
    clusters.push(directory);
    const port = await bindWithRetry(async port => {
      const log = `${directory}-${port}.log`;
      try {
        await postgres('pg_ctl', [
          '-D',
          directory,
          '-l',
          log,
          '-o',
          `-h ${host} -p ${port} -k ''`,
          '-t',
          '20',
          '-w',
          'start',
        ]);
      } catch (error) {
        if (addressInUse.test(await readFile(log, 'utf8').catch(() => '')))
          throw new PortCollision(`PostgreSQL port ${port} is already in use`, { cause: error });
        throw error;
      }
      return port;
    });
    const base = `postgresql://support@${host}:${port}`;
    const pgEnv = { ...process.env, PGHOSTADDR: host, PGPASSWORD: password };
    const authenticatedUrl = name => `postgresql://support:${password}@${host}:${port}/${name}`;
    const unauthenticated = new Client({ host, port, database: 'postgres', user: 'support', password: token() });
    try {
      await assert.rejects(unauthenticated.connect(), { code: '28P01' });
    } finally {
      await unauthenticated.end();
    }
    await postgres('createdb', ['--maintenance-db', `${base}/postgres`, 'support'], pgEnv);
    return {
      url: authenticatedUrl('support'),
      async restore() {
        const backup = join(lab, 'support.dump');
        await postgres('pg_dump', ['--dbname', `${base}/support`, '--format=custom', '--file', backup], pgEnv);
        await postgres('createdb', ['--maintenance-db', `${base}/postgres`, 'restored_support'], pgEnv);
        await postgres(
          'pg_restore',
          ['--dbname', `${base}/restored_support`, '--no-owner', '--exit-on-error', backup],
          pgEnv,
        );
        return { url: authenticatedUrl('restored_support') };
      },
    };
  }
  // sqld 0.24 reports the configured address rather than the assigned port when passed :0.
  // Each instance proves readiness with a key that no other proof instance accepts.
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwtKey = `${directory}.jwt.pem`;
  await writeFile(jwtKey, publicKey.export({ format: 'pem', type: 'spki' }));
  const claims = [JSON.stringify({ alg: 'EdDSA', typ: 'JWT' }), JSON.stringify({ a: 'rw' })]
    .map(value => Buffer.from(value).toString('base64url'))
    .join('.');
  const authToken = `${claims}.${sign(null, Buffer.from(claims), privateKey).toString('base64url')}`;
  const { proc, url } = await bindWithRetry(async port => {
    const url = `http://${host}:${port}`;
    const proc = start(process.env.SQLD_BIN ?? 'sqld', [
      '--http-listen-addr',
      `${host}:${port}`,
      '--db-path',
      directory,
      '--auth-jwt-key-file',
      jwtKey,
    ]);
    try {
      await ready(proc, url, async () => {
        const response = await querySqld(url, authToken);
        if (response.ok) return (await response.json()).results?.[0]?.type === 'ok';
        await response.body?.cancel();
        return false;
      });
      const denied = await querySqld(url, token());
      assert.equal(denied.status, 401);
      await denied.body?.cancel();
    } catch (error) {
      await stop(proc);
      if (addressInUse.test(proc.output())) throw new PortCollision(`sqld port ${port} is already in use`);
      throw error;
    }
    return { proc, url };
  });
  return {
    proc,
    url,
    authToken,
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

async function verifyInterruptedSeed(db, env, [first, second]) {
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
  const workerEnv = { ...env, ...databaseEnv(db), PROOF_REVISED_DATASET: dataset };
  const admin = new Client({ connectionString: db.url });
  await admin.connect();
  try {
    const {
      rows: [{ id: firstPageArgument }],
    } = await admin.query('SELECT quote_literal($1::text) AS id', [first.id]);
    // Sequence increments remain visible even when the writer transaction rolls back.
    await admin.query(`
      CREATE SEQUENCE public.support_seed_first_page_updates;
      CREATE FUNCTION public.observe_support_seed_update() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.id = TG_ARGV[0] AND NEW.name = OLD.name || ' (revised)' AND NEW.version = OLD.version + 1 THEN
          PERFORM nextval('public.support_seed_first_page_updates');
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER observe_support_seed_update AFTER UPDATE ON public.mastra_knowledge_pages
      FOR EACH ROW EXECUTE FUNCTION public.observe_support_seed_update(${firstPageArgument});
    `);
    const snapshot = async () =>
      (
        await admin.query('SELECT id, name, version FROM mastra_knowledge_pages WHERE id = ANY($1) ORDER BY id', [
          [first.id, second.id],
        ])
      ).rows;
    const original = await snapshot();

    async function startBlockedSeed(expectedUpdates) {
      const seedSession = `support-seed-${randomUUID()}`;
      const proc = start(process.execPath, args, { ...workerEnv, PGAPPNAME: seedSession });
      let lockOwner;
      for (let attempt = 0; attempt < 100 && proc.child.exitCode === null; attempt++) {
        // Refresh session activity while the admin transaction holds the blocking row lock.
        await admin.query('SELECT pg_stat_clear_snapshot()');
        const { rows } = await admin.query(
          `SELECT held.pid FROM pg_locks held
          JOIN pg_stat_activity session ON session.pid = held.pid
          WHERE held.locktype = 'advisory' AND held.objsubid = 2 AND held.granted
          AND held.database = (SELECT oid FROM pg_database WHERE datname = current_database())
          AND session.application_name = $1
          AND pg_backend_pid() = ANY(pg_blocking_pids(held.pid))`,
          [seedSession],
        );
        if (rows.length) {
          lockOwner = rows[0].pid;
          break;
        }
        await delay(50);
      }
      assert.ok(lockOwner, `Revised seed did not reach the blocked page: ${proc.output()}`);
      const { rows } = await admin.query(
        'SELECT CASE WHEN is_called THEN last_value::int ELSE 0 END AS updates FROM public.support_seed_first_page_updates',
      );
      assert.equal(
        rows[0].updates,
        expectedUpdates,
        'The seed must update the first page before blocking on the second',
      );
      return { proc, lockOwner };
    }

    await admin.query('BEGIN');
    try {
      await admin.query('SELECT id FROM mastra_knowledge_pages WHERE id = $1 FOR UPDATE', [second.id]);
      const { proc: interrupted, lockOwner } = await startBlockedSeed(1);
      const terminated = await admin.query('SELECT pg_terminate_backend($1, 5000) AS terminated', [lockOwner]);
      assert.equal(terminated.rows[0].terminated, true);
      const [code] = await waitForExit(interrupted);
      assert.equal(code, 1, interrupted.output());
      assert.deepEqual(await snapshot(), original, 'Losing the writer session must roll back the entire seed');
      const { proc: blocked } = await startBlockedSeed(2);
      const [timedOut] = await waitForExit(blocked);
      assert.equal(timedOut, 1, blocked.output());
      assert.match(blocked.output(), /canceling statement due to lock timeout/u);
      assert.deepEqual(await snapshot(), original, 'Lock timeout must roll back the entire seed');
      await admin.query('ROLLBACK');
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
    try {
      await admin.query(`
        DROP TRIGGER IF EXISTS observe_support_seed_update ON public.mastra_knowledge_pages;
        DROP FUNCTION IF EXISTS public.observe_support_seed_update();
        DROP SEQUENCE IF EXISTS public.support_seed_first_page_updates;
      `);
    } finally {
      await admin.end();
    }
  }
}

async function holdWriterLock(env, db) {
  const proc = start(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { withWriterLock } from './src/mastra/knowledge/writer-lock.ts'; import { setInterval } from 'node:timers/promises'; await withWriterLock(async () => { console.log('writer-held'); for await (const _ of setInterval(1000)) {} });",
    ],
    { ...env, ...databaseEnv(db) },
  );
  for (let attempt = 0; attempt < 100 && proc.child.exitCode === null; attempt++) {
    if (proc.output().includes('writer-held')) return proc;
    await delay(100);
  }
  throw new Error(`Writer lock holder failed: ${proc.output()}`);
}

async function postgresProxy(db, onClientData) {
  const destination = new URL(db.url);
  const proxy = createPortServer();
  const pairs = new Map();
  proxy.on('connection', downstream => {
    const upstream = createConnection({ host: destination.hostname, port: Number(destination.port) });
    pairs.set(downstream, upstream);
    downstream.on('error', () => upstream.destroy());
    upstream.on('error', () => downstream.destroy());
    downstream.on('close', () => upstream.destroy());
    upstream.on('close', () => {
      downstream.destroy();
      pairs.delete(downstream);
    });
    if (onClientData) downstream.on('data', chunk => onClientData(downstream, upstream, chunk));
    downstream.pipe(upstream).pipe(downstream);
  });
  proxy.listen(0, host);
  await once(proxy, 'listening');
  const proxyUrl = new URL(destination);
  proxyUrl.port = String(proxy.address().port);
  return {
    url: proxyUrl.href,
    pairs,
    async close() {
      for (const [downstream, upstream] of pairs) {
        downstream.destroy();
        upstream.destroy();
      }
      await new Promise(resolve => proxy.close(resolve));
    },
  };
}

async function verifyStalledPostgresWriter(db, env) {
  const proxy = await postgresProxy(db);
  const writerName = `support-stalled-writer-${randomUUID()}`;
  const imports = "import { withWriterLock } from './src/mastra/knowledge/writer-lock.ts';";
  const proc = start(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `${imports}
      import assert from 'node:assert/strict';
      import { once } from 'node:events';
      import { isRetryablePublicationError } from './src/mastra/review/publication-errors.ts';
      await withWriterLock(async ({ postgres }) => {
        const ready = once(process, 'message');
        process.send('writer-held');
        await ready;
        await postgres.query('SELECT 1');
      }).then(
        () => assert.fail('The stalled query unexpectedly succeeded'),
        error => {
          assert.equal(error.name, 'WriterSessionLostError');
          assert.equal(error.commitState, 'not-committed');
          assert.ok(isRetryablePublicationError(error));
        }
      );
      process.disconnect();`,
    ],
    { ...env, ...databaseEnv(proxy), PGAPPNAME: writerName },
    template,
    true,
  );
  try {
    const [message] = await Promise.race([
      once(proc.child, 'message', { signal: AbortSignal.timeout(5000) }),
      proc.exited.then(() => {
        throw new Error(`Stalled writer exited before acquiring its lock: ${proc.output()}`);
      }),
    ]);
    assert.equal(message, 'writer-held');
    const observer = new Client({
      connectionString: proxy.url,
      application_name: 'support-proxy-observer',
      connectionTimeoutMillis: 5000,
      query_timeout: 5000,
    });
    try {
      await observer.connect();
      const { rows } = await observer.query('SELECT client_port FROM pg_stat_activity WHERE application_name = $1', [
        writerName,
      ]);
      assert.equal(rows.length, 1, 'Identify the PostgreSQL writer session behind the proxy');
      const upstream = [...proxy.pairs.values()].find(socket => socket.localPort === rows[0].client_port);
      assert.ok(upstream, 'The stalled writer must have an open upstream connection');
      // Keep the writer's TCP connection open while suppressing its next PostgreSQL reply.
      upstream.pause();
      assert.equal((await observer.query('SELECT 1 AS available')).rows[0].available, 1);
    } finally {
      await observer.end();
    }
    proc.child.send('query');
    const [code] = await Promise.race([
      proc.exited,
      delay(16000, undefined, { ref: false }).then(() => {
        throw new Error('The stalled PostgreSQL writer did not exit');
      }),
    ]);
    assert.equal(code, 0, proc.output());
    await exec(
      process.execPath,
      ['--input-type=module', '-e', `${imports} await withWriterLock(({ postgres }) => postgres.query('SELECT 1'));`],
      { cwd: template, env: { ...env, ...databaseEnv(db) }, timeout: 5000 },
    );
  } finally {
    await Promise.all([stop(proc), proxy.close()]);
  }
}

async function postgresProxyWithheldCommit(db, statement) {
  const marker = Buffer.from(statement);
  const commit = Buffer.from([0x51, 0, 0, 0, 11, ...Buffer.from('COMMIT'), 0]);
  const sockets = new WeakMap();
  const commitSent = Promise.withResolvers();
  const proxy = await postgresProxy(db, (downstream, upstream, chunk) => {
    const state = sockets.get(downstream) ?? { tail: Buffer.alloc(0), matched: false };
    const bytes = Buffer.concat([state.tail, chunk]);
    state.matched ||= bytes.includes(marker);
    state.tail = Buffer.from(bytes.subarray(1 - Math.max(marker.length, commit.length)));
    sockets.set(downstream, state);
    if (state.matched && bytes.includes(commit)) {
      // Forward COMMIT and hold its reply until an independent session confirms it took effect.
      upstream.pause();
      commitSent.resolve(downstream);
    }
  });
  return { ...proxy, commitSent: commitSent.promise };
}

async function verifyPostgresCommitState(db, env) {
  const channel = 'support_commit_reply';
  const proxy = await postgresProxyWithheldCommit(db, `NOTIFY ${channel}`);
  const observer = new Client({ connectionString: db.url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  let proc;
  try {
    await observer.connect();
    await observer.query(`LISTEN ${channel}`);
    const notification = once(observer, 'notification', { signal: AbortSignal.timeout(8000) });
    proc = start(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import assert from 'node:assert/strict';
        import { withWriterLock } from './src/mastra/knowledge/writer-lock.ts';
        await assert.rejects(
          withWriterLock(({ postgres }) => postgres.none('NOTIFY ${channel}')),
          { name: 'WriterSessionLostError', commitState: 'unknown' }
        );`,
      ],
      { ...env, ...databaseEnv(proxy) },
    );
    // PostgreSQL delivers NOTIFY only after the transaction commits.
    const [downstream, [notice]] = await Promise.race([
      Promise.all([proxy.commitSent, notification]),
      proc.exited.then(() => {
        throw new Error(`Writer exited before the COMMIT reply was withheld: ${proc.output()}`);
      }),
    ]);
    assert.equal(notice.channel, channel);
    downstream.destroy();
    const [code] = await waitForExit(proc);
    assert.equal(code, 0, proc.output());
  } finally {
    await Promise.all([proxy.close(), observer.end(), proc && stop(proc)]);
  }
}

async function verifyLostPostgresPublicationReply(db, worker, runId, proposal, approval, reference) {
  const proxy = await postgresProxyWithheldCommit(db, 'INSERT INTO public.support_review_publications');
  const observer = new Client({ connectionString: db.url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  let proxyWorker;
  let publication;
  try {
    await observer.connect();
    proxyWorker = await worker(proxy);
    publication = request(proxyWorker, resumeRoute(runId), reviewer, {
      step: ['publish-review'],
      resumeData: approval,
    });
    const downstream = await Promise.race([
      proxy.commitSent,
      publication.then(response => {
        throw new Error(`Publication returned HTTP ${response.status} before its COMMIT reply was withheld`);
      }),
      delay(8000, undefined, { ref: false }).then(() => {
        throw new Error('Publication did not send COMMIT through the proxy');
      }),
    ]);
    let rows = [];
    for (let attempt = 0; !rows.length && attempt < 80; attempt++) {
      ({ rows } = await observer
        .query('SELECT reference FROM public.support_review_publications WHERE proposal_id = $1 AND revision = $2', [
          proposal.id,
          approval.revision,
        ])
        .catch(error => {
          if (error.code === '42P01') return { rows: [] };
          throw error;
        }));
      if (!rows.length) await delay(25);
    }
    assert.deepEqual(rows, [{ reference }], 'The receipt must be durable before dropping the reply');
    downstream.destroy();
    assert.equal((await json(publication)).status, 'suspended');
  } finally {
    await proxy.close();
    await Promise.allSettled([observer.end(), proxyWorker && stop(proxyWorker.proc), publication]);
  }
}

function request(worker, route, access, body, headers = {}) {
  return fetch(worker.url + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      ...(access ? { authorization: `Bearer ${access}` } : {}),
      'content-type': 'application/json',
      ...headers,
    },
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

async function verifyPlatformSignIn(db, worker, env, identityUrl) {
  const environment = {
    ...env,
    MASTRA_ORGANIZATION_ID: platformOrg,
    MASTRA_SHARED_API_URL: identityUrl,
    MASTRA_PLATFORM_STUDIO_AUTH: 'disabled',
  };
  for (const name of Object.keys(environment)) {
    if (name.startsWith('SUPPORT_OAUTH_')) delete environment[name];
  }

  const platform = await worker(db, { environment, access: platformMember });
  const studioRequest = (server, route, account, body, headers = {}) =>
    request(server, route, undefined, body, {
      'x-mastra-client-type': 'studio',
      ...(account ? { cookie: `__Host-wos-session=${account}` } : {}),
      ...headers,
    });
  const studio = (...args) => studioRequest(platform, ...args);
  const { url: signIn } = await json(studio('/api/auth/sso/login'));
  assert.equal(new URL(signIn).origin, identityUrl);
  assert.equal(new URL(signIn).searchParams.get('organization_id'), platformOrg);
  assert.equal((await studio('/api/knowledge')).status, 401);
  assert.equal((await studio('/api/knowledge', foreignPlatformUser)).status, 401);
  await json(studio('/api/knowledge', undefined, undefined, { authorization: `bEaReR ${platformMember}` }));
  assert.equal(await json(studio('/api/auth/me', foreignPlatformUser)), null);
  assert.equal((await json(studio('/api/auth/me', platformMember))).id, 'member');
  await json(studio(pageRoute(source), platformViewer));
  assert.equal((await studio(pageRoute('tenant:fieldretail#policies/safe-changes'), platformAdmin)).status, 404);

  const thread = randomUUID();
  const question = {
    messages: [{ role: 'user', content: 'Check the Wi-Fi network' }],
    memory: { thread },
  };
  const generate = '/api/agents/support/generate';
  assert.equal((await studio(generate, platformViewer, question)).status, 403);
  const result = await json(studio(generate, platformMember, question));
  assert.match(result.text, /guides\/network/u);
  const route = `/api/memory/threads/${thread}?agentId=support`;
  assert.equal((await studio(route, secondPlatformMember)).status, 403);
  const ownThread = await json(studio(route, platformMember));
  assert.equal(
    ownThread.resourceId,
    JSON.stringify(['retailops', 'store-42', JSON.stringify(['mastra-platform', platformOrg, 'member'])]),
  );
  const confirmation = { threadId: thread, observation: 'The guest network was selected.', outcome: confirmed };
  assert.equal(
    (await studio('/support/confirmations', platformMember, confirmation, { 'content-type': 'text/plain' })).status,
    403,
  );
  assert.equal(
    (await studio('/support/confirmations', platformMember, confirmation, { 'sec-fetch-site': 'same-site' })).status,
    403,
  );
  const { confirmationReference } = await json(
    studio('/support/confirmations', platformMember, confirmation, { 'sec-fetch-site': 'same-origin' }),
    201,
  );
  const reviewRoute = '/api/workflows/review/create-run';
  assert.equal((await studio(reviewRoute, platformMember, {})).status, 403);
  const { runId } = await json(studio(reviewRoute, platformAdmin, {}));
  const proposed = await json(
    studio(`/api/workflows/review/start-async?runId=${runId}`, platformAdmin, {
      inputData: { confirmationReference, audience: 'private' },
    }),
  );
  assert.equal(proposed.status, 'suspended');
  await stop(platform.proc);

  const preload = join(lab, 'injected-studio-auth.mjs');
  await writeFile(
    preload,
    `import { MastraAuthStudio } from ${JSON.stringify(import.meta.resolve('@mastra/auth-studio'))};
import * as bundle from ${JSON.stringify(pathToFileURL(join(template, '.mastra/output/mastra.mjs')).href)};
const mastra = Object.values(bundle).find(value => typeof value?.setStudio === 'function');
mastra.setStudio({ auth: new MastraAuthStudio() });
`,
  );
  const injected = await worker(db, { environment, access: platformMember, preload });
  const denied = await json(studioRequest(injected, '/api/agents', platformMember), 403);
  assert.match(denied.error, /MASTRA_PLATFORM_STUDIO_AUTH/u);
  await stop(injected.proc);
  console.log(
    'Mastra sign-in proof passed: organization and customer scope, distinct conversations, review access, cookie POST protection, and injected Studio auth guard.',
  );
}

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
  const incompleteProbe = new EventEmitter();
  identityServer = createHttpsServer(
    { key: await readFile(keyFile), cert: await readFile(certificate) },
    async (req, res) => {
      if (req.method === 'GET' && (req.url === '/auth/me' || req.url === '/auth/verify')) {
        const credential =
          req.url === '/auth/me'
            ? req.headers.cookie?.match(/^wos-session=(.+)$/u)?.[1]
            : req.headers.authorization?.slice(7);
        const user = platformUsers.get(credential);
        if (!user) res.writeHead(401).end();
        else res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(user));
        return;
      }
      if (
        req.method !== 'POST' ||
        req.url !== '/introspect' ||
        req.headers.authorization !== `Bearer ${resourceSecret}`
      ) {
        res.writeHead(401).end();
        return;
      }
      let body = '';
      const isProbe = req.headers['x-support-incomplete-probe'] === 'true';
      try {
        for await (const chunk of req) {
          if (isProbe && !body) incompleteProbe.emit('chunk');
          body += chunk;
        }
      } catch {
        if (isProbe && !req.complete) incompleteProbe.emit('incomplete');
        if (!req.destroyed && !res.destroyed) res.writeHead(400).end();
        return;
      }
      if (!req.complete || res.destroyed) {
        if (isProbe && !req.complete) incompleteProbe.emit('incomplete');
        return;
      }
      const access = new URLSearchParams(body).get('token');
      res
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify(profiles.get(access) ?? { active: false }));
    },
  ).listen(0, host);
  await once(identityServer, 'listening');
  const { port: identityPort } = identityServer.address();

  // A worker can disconnect after introspection starts but before its POST body is complete.
  const probeDeadline = AbortSignal.timeout(5000);
  const interrupted = httpsRequest({
    host,
    port: identityPort,
    ca: await readFile(certificate),
    method: 'POST',
    path: '/introspect',
    signal: probeDeadline,
    headers: {
      authorization: `Bearer ${resourceSecret}`,
      expect: '100-continue',
      'content-length': '100',
      'x-support-incomplete-probe': 'true',
    },
  });
  const accepted = once(interrupted, 'continue');
  interrupted.flushHeaders();
  await accepted;
  interrupted.on('error', () => {});
  const firstChunk = once(incompleteProbe, 'chunk', { signal: probeDeadline });
  interrupted.write('token=');
  await firstChunk;
  const incomplete = once(incompleteProbe, 'incomplete', { signal: probeDeadline });
  interrupted.destroy();
  await incomplete;

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
  for (const name of [
    'DATABASE_PROVIDER',
    'DATABASE_URL',
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'SUPPORT_DATABASE_URL',
    'SUPPORT_DATABASE_AUTH_TOKEN',
    'SUPPORT_SEED_ON_STARTUP',
  ])
    delete env[name];
  if (provider) {
    delete env.SUPPORT_MODE;
    delete env.SUPPORT_HOST;
    env.MASTRA_ENVIRONMENT_ID = 'reference-hosted-env';
    env.DATABASE_PROVIDER = provider;
  }
  if (backend === 'postgres') delete env.SUPPORT_WRITER_LOCK_FILE;

  async function worker(db, { seedOnStartup = false, environment = env, access = technician, preload } = {}) {
    // The bundled server's IPC message reports the configured port, so use it to confirm a nonzero bind.
    return bindWithRetry(async port => {
      const url = `http://${host}:${port}`;
      const proc = start(
        process.execPath,
        [...(preload ? ['--import', preload] : []), 'index.mjs'],
        {
          ...environment,
          PORT: String(port),
          ...databaseEnv(db),
          ...(seedOnStartup ? { SUPPORT_SEED_ON_STARTUP: 'true' } : {}),
        },
        join(template, '.mastra/output'),
        true,
      );
      try {
        await ready(proc, url, async () => {
          if (proc.boundPort() !== port) return false;
          const response = await fetch(`${url}/api/knowledge`, {
            headers: { authorization: `Bearer ${access}` },
            signal: AbortSignal.timeout(1000),
          });
          await response.body?.cancel();
          return response.ok;
        });
      } catch (error) {
        await stop(proc);
        throw error;
      }
      return { proc, url };
    });
  }

  const original = join(lab, 'primary');
  const db = await database(original);
  const seed = () =>
    exec(process.execPath, ['scripts/seed-knowledge.ts'], {
      cwd: template,
      env: { ...env, ...databaseEnv(db) },
      timeout: 30000,
    });
  // VPC PostgreSQL must seed a fresh database from the deploy artifact before serving support requests.
  const bootstrapped = provider === 'postgres' ? await worker(db, { seedOnStartup: true }) : undefined;
  if (bootstrapped) await json(request(bootstrapped, pageRoute('tenant:retailops#policies/safe-changes'), technician));
  const seeded = await seed();
  assert.match(seeded.stdout, /retail-pos-docs/u);
  if (backend === 'postgres') {
    const report = JSON.parse(seeded.stdout.slice(seeded.stdout.indexOf('{')));
    await verifyInterruptedSeed(db, env, report.pages);
    await verifyStalledPostgresWriter(db, env);
    await verifyPostgresCommitState(db, env);
  }
  const first = bootstrapped ?? (await worker(db));
  const second = await worker(db);
  assert.equal((await request(first, '/api/knowledge')).status, 401);
  assert.equal((await request(first, '/api/knowledge', token())).status, 401);
  const wrongAudience = token();
  profiles.set(wrongAudience, { ...profiles.get(technician), aud: 'different-service' });
  assert.equal((await request(first, '/api/knowledge', wrongAudience)).status, 401);
  for (const tokenUse of [undefined, 'refresh', 'id']) {
    const unsupported = token();
    profiles.set(unsupported, { ...profiles.get(technician), token_use: tokenUse, token_type: 'Bearer' });
    assert.equal((await request(first, '/api/knowledge', unsupported)).status, 401);
  }
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
    assert.equal(race.filter(response => response.status === 200).length, 1);
    const refused = race.find(response => response.status !== 200);
    assert.ok(refused && (refused.status === 403 || refused.status === 503));
    if (refused.status === 503) assert.equal(refused.headers.get('Retry-After'), '1');
    const winner = race[0].status === 200 ? technician : reviewer;
    const loser = winner === technician ? reviewer : technician;
    await Promise.all(race.map(response => response.text()));
    const route = `/api/memory/threads/${draft}?agentId=support`;
    const saved = await json(request(second, route, winner));
    const { tenant_id, customer_id, sub } = profiles.get(winner);
    assert.equal(saved.resourceId, JSON.stringify([tenant_id, customer_id, sub]));
    assert.equal((await request(first, route, loser)).status, 403);
    assert.equal((await generate(first, loser, draft)).status, 403);
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

  const draftThread = randomUUID();
  const generateRoute = '/api/agents/support/generate';
  const firstTurn = {
    messages: [{ role: 'user', content: 'Check the network connection' }],
    memory: { thread: draftThread },
  };
  const holder = await holdWriterLock(env, db);
  try {
    const beforeTurn = model.requests.length;
    const busy = await request(second, generateRoute, technician, firstTurn);
    assert.equal(busy.headers.get('Retry-After'), '1');
    assert.match((await json(busy, 503)).error, /writer is busy/u);
    assert.equal(model.requests.length, beforeTurn, 'The busy draft claim must stop before provider execution');
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
  assert.match((await json(request(second, generateRoute, technician, firstTurn))).text, /Wi-Fi network/u);
  const denied = await request(second, generateRoute, reviewer, firstTurn);
  assert.equal(denied.headers.get('Retry-After'), null);
  assert.equal(denied.status, 403, 'A different technician cannot claim the existing thread');
  if (backend === 'postgres') {
    await verifyLostPostgresPublicationReply(db, worker, runId, proposal, approval, reference);
    const committed = await json(request(second, pageRoute(reference), technician));
    assert.equal(committed.page.version, 1);
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
  const { runId: duplicateRunId } = await json(request(second, '/api/workflows/review/create-run', reviewer, {}));
  const duplicate = await json(
    request(second, `/api/workflows/review/start-async?runId=${duplicateRunId}`, reviewer, {
      inputData: { confirmationReference, audience: 'private' },
    }),
  );
  assert.equal(duplicate.status, 'suspended');
  const duplicateRun = await json(request(second, runRoute(duplicateRunId), reviewer));
  assert.equal(duplicateRun.steps['review-decision'].suspendPayload.candidate.action, 'duplicate');

  const restarted = await worker(db);
  const published = await json(request(restarted, pageRoute(reference), technician));
  assert.equal(published.page.version, 1);
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
  if (provider === 'postgres') {
    await stop(restored.proc);
    await verifyPlatformSignIn(restoredDb, worker, env, `https://${host}:${identityPort}`);
  }
  console.log(
    `Hosted proof passed (${provider ?? backend}): two built workers, HTTPS identity, scope isolation, contention and owner exit${backend === 'postgres' ? ', interrupted seed rollback' : ''}, approval after restart, history reuse, and restored Knowledge, Memory, and audit.`,
  );
} catch (error) {
  proofFailed = true;
  throw error;
} finally {
  const errors = [];
  const cleanup = async operation => {
    try {
      await operation();
      return true;
    } catch (error) {
      errors.push(error);
      return false;
    }
  };
  for (const proc of [...children].reverse()) await cleanup(() => stop(proc));
  let postgresStopped = true;
  for (const directory of clusters) {
    if (!(await cleanup(() => stopPostgres(directory)))) postgresStopped = false;
  }
  await cleanup(() => model?.close());
  if (identityServer)
    await cleanup(
      () => new Promise((resolve, reject) => identityServer.close(error => (error ? reject(error) : resolve()))),
    );
  if (postgresStopped) await cleanup(() => rm(lab, { recursive: true, force: true }));
  if (errors.length) {
    const failure = new AggregateError(
      errors,
      postgresStopped ? 'Hosted proof cleanup failed' : `Hosted proof cleanup failed. Lab retained at ${lab}`,
    );
    if (!proofFailed) throw failure;
    console.error(failure);
  }
}
