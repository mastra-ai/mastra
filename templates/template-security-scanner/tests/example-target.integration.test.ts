import { createClient } from '@libsql/client';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import type { Policy, Profile, Target } from '../src/core/contracts.js';
import { dockerClient, ownerIdentity, OWNER_LABEL } from '../src/runtime/docker.js';
import { initializeExampleData } from '../example-target-api/store.js';
import {
  readExampleBoundary,
  reconcileExampleTransport,
  startExampleTransport,
} from '../example-target-api/transport.js';
import { setup } from '../src/runtime/setup.js';
import { buildDiscoveryImages, releaseDiscoveryImages } from '../src/discovery/images.js';
import { startControlPlane } from '../src/http/server.js';
import { terminal, type Scan, type Evidence } from '../src/discovery/contracts.js';

const settings = loadSettings({
  ...process.env,
  SCANNER_ENCRYPTION_KEY: undefined,
  CONTROL_BOOTSTRAP_SECRET: undefined,
});
const client = dockerClient(settings);
const kindFilter = {
  label: [`${OWNER_LABEL}=${ownerIdentity(settings)}`, 'dev.mastra.security-scanner.kind=example-target'],
};
const inventory = async () => ({
  containers: (await client.listContainers({ all: true, filters: kindFilter })).map(item => item.Id).sort(),
  networks: (await client.listNetworks({ filters: kindFilter })).map(item => item.Id).sort(),
  images: (await client.listImages({ all: true, filters: kindFilter })).map(item => item.Id).sort(),
});

/** Start the bundled example target in the selected mode and await its local readiness. */
async function launchExample(mode: 'vulnerable' | 'protected') {
  const child = spawn('npm', ['run', 'example-target', ...(mode === 'protected' ? ['--', '--mode=protected'] : [])], {
    cwd: settings.root,
    detached: true,
    env: { ...process.env, PATH: process.env.PATH },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '',
    stderrBytes = 0;
  child.stdout!.on('data', (chunk: Buffer) => {
    stdout = `${stdout}${chunk.toString()}`.slice(-16384);
  });
  child.stderr!.on('data', (chunk: Buffer) => {
    stderrBytes += chunk.length;
  });
  const exit = new Promise<void>(resolve => child.once('exit', () => resolve()));
  let output:
    | {
        mode: string;
        hostUrl: string;
        scannerUrl: string;
        openApiUrl: string;
        routes: string[];
        users: [{ id: string; apiKey: string }, { id: string; apiKey: string }];
      }
    | undefined;
  for (let attempt = 0; attempt < 300; attempt++) {
    const line = stdout.split('\n').find(item => item.startsWith('{"mode":'));
    if (line) {
      try {
        output = JSON.parse(line);
      } catch {
        throw new Error('EXAMPLE_CLI_OUTPUT_INVALID');
      }
      break;
    }
    if (child.exitCode !== null || stderrBytes > 65536) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!output) {
    if (child.pid)
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    await exit;
    throw new Error('EXAMPLE_CLI_START_FAILED');
  }
  return { output, close: () => closeChild(exit), crash: () => crashChild(exit) };
}
async function crashChild(exit: Promise<void>) {
  const receipt = JSON.parse(await readFile(join(settings.root, 'data/example-target/transport.json'), 'utf8')) as {
    pid: number;
  };
  process.kill(receipt.pid, 'SIGKILL');
  await exit;
}
/** Stop the example process using its owned receipt and await child termination. */
async function closeChild(exit: Promise<void>) {
  const receipt = JSON.parse(await readFile(join(settings.root, 'data/example-target/transport.json'), 'utf8')) as {
    pid: number;
  };
  process.kill(receipt.pid, 'SIGTERM');
  await exit;
  for (let attempt = 0; attempt < 150; attempt++) {
    const present = await readFile(join(settings.root, 'data/example-target/transport.json'))
      .then(() => true)
      .catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      });
    if (!present && (await inventory()).containers.length === 0) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('EXAMPLE_CLI_CLEANUP_INCOMPLETE');
}

describe('local Hono example target', () => {
  it('publishes one stable private seed when first initialization overlaps', async () => {
    for (let attempt = 0; attempt < 20; attempt++) {
      const root = await mkdtemp(join(tmpdir(), 'scanner-example-seed-'));
      try {
        const [left, right] = await Promise.all([initializeExampleData(root), initializeExampleData(root)]);
        expect(JSON.stringify(left) === JSON.stringify(right)).toBe(true);
        const db = createClient({ url: `file:${join(root, 'data/example-target/db/example.db')}` });
        try {
          const users = await db.execute('SELECT id, key_verifier FROM example_users');
          expect(users.rows).toHaveLength(2);
          expect(JSON.stringify(users.rows).includes(left.users[0].key)).toBe(false);
          expect(JSON.stringify(users.rows).includes(left.users[1].key)).toBe(false);
        } finally {
          db.close();
        }
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  }, 30_000);

  it('keeps two independent users after restart and changes only owner-order authorization', async () => {
    const before = await inventory();
    expect(before).toEqual({ containers: [], networks: [], images: [] });
    const seed = await initializeExampleData(settings.root);
    const dbPath = join(settings.root, 'data/example-target/db/example.db');
    const db = createClient({ url: `file:${dbPath}` });
    try {
      const rows = await db.execute('SELECT id, key_verifier FROM example_users ORDER BY rowid');
      expect(rows.rows).toHaveLength(2);
      for (const user of seed.users) {
        expect(JSON.stringify(rows.rows).includes(user.key)).toBe(false);
        expect(rows.rows.some(row => row.id === user.id)).toBe(true);
      }
    } finally {
      db.close();
    }
    const privateFile = await stat(join(settings.root, 'data/example-target/private-seed.json'));
    expect(privateFile.mode & 0o777).toBe(0o600);
    expect(seed.users[0].key !== seed.users[1].key).toBe(true);

    /** Read an example API resource with an optional API-key header and return its response data. */
    const request = async (base: string, path: string, key?: string) => {
      const response = await fetch(`${base}${path}`, { headers: key ? { 'x-api-key': key } : {} });
      return { status: response.status, body: (await response.json()) as unknown };
    };
    const a = seed.users[0],
      b = seed.users[1];
    let vulnerable: Awaited<ReturnType<typeof startExampleTransport>> | undefined;
    try {
      vulnerable = await startExampleTransport(settings, 'vulnerable');
      const boundary = await readExampleBoundary(settings);
      expect(boundary?.address).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
      const [
        aList,
        bList,
        aDetail,
        crossDetail,
        aReceipt,
        crossReceipt,
        publicProducts,
        aProducts,
        bProducts,
        openApi,
        unauthenticated,
      ] = await Promise.all([
        request(vulnerable.baseUrl, '/api/orders', a.key),
        request(vulnerable.baseUrl, '/api/orders', b.key),
        request(vulnerable.baseUrl, '/api/orders/ord-a-1001', a.key),
        request(vulnerable.baseUrl, '/api/orders/ord-a-1001', b.key),
        request(vulnerable.baseUrl, '/api/orders/ord-a-1001/receipt', a.key),
        request(vulnerable.baseUrl, '/api/orders/ord-a-1001/receipt', b.key),
        request(vulnerable.baseUrl, '/api/products'),
        request(vulnerable.baseUrl, '/api/products', a.key),
        request(vulnerable.baseUrl, '/api/products', b.key),
        request(vulnerable.baseUrl, '/openapi.json'),
        request(vulnerable.baseUrl, '/api/orders'),
      ]);
      expect(aList).toMatchObject({ status: 200, body: { orders: [{ id: 'ord-a-1001' }, { id: 'ord-a-1002' }] } });
      expect(bList).toMatchObject({ status: 200, body: { orders: [{ id: 'ord-b-2001' }] } });
      expect(aDetail.status).toBe(200);
      expect(crossDetail.status).toBe(200);
      expect(aReceipt.status).toBe(200);
      expect(crossReceipt.status).toBe(403);
      expect(unauthenticated.status).toBe(401);
      expect(publicProducts).toEqual(aProducts);
      expect(publicProducts).toEqual(bProducts);
      expect(openApi.status).toBe(200);
      const openText = JSON.stringify(openApi.body);
      expect(openText).toContain('/api/orders/{id}/receipt');
      for (const user of seed.users) {
        expect(openText.includes(user.id)).toBe(false);
        expect(openText.includes(user.key)).toBe(false);
      }
      expect(openText).not.toContain('Private order');

      const r = vulnerable.receipt;
      const [target, relay, network, access, image] = await Promise.all([
        client.getContainer(r.containerId!).inspect(),
        client.getContainer(r.relayContainerId!).inspect(),
        client.getNetwork(r.networkId!).inspect(),
        client.getNetwork(r.accessNetworkId!).inspect(),
        client.getImage(r.imageId!).inspect(),
      ]);
      expect(network.Internal).toBe(true);
      expect(Object.keys(target.NetworkSettings.Networks)).toEqual([network.Name]);
      expect(access.Internal).toBe(false);
      expect(Object.keys(relay.NetworkSettings.Networks).sort()).toEqual([network.Name, access.Name].sort());
      expect(relay.NetworkSettings.Ports?.['18080/tcp']?.[0]?.HostIp).toBe('127.0.0.1');
      expect(target.HostConfig.LogConfig?.Type).toBe('none');
      expect(relay.HostConfig.LogConfig?.Type).toBe('none');
      const metadata = JSON.stringify({
        target: target.Config,
        relay: relay.Config,
        image: image.Config,
        history: await client.getImage(r.imageId!).history(),
      });
      for (const user of seed.users) expect(metadata.includes(user.key)).toBe(false);
    } finally {
      await vulnerable?.close();
    }
    expect(await inventory()).toEqual(before);

    const seedAfterRestart = await initializeExampleData(settings.root);
    expect(JSON.stringify(seedAfterRestart) === JSON.stringify(seed)).toBe(true);
    let protectedTarget: Awaited<ReturnType<typeof startExampleTransport>> | undefined;
    try {
      protectedTarget = await startExampleTransport(settings, 'protected');
      expect((await request(protectedTarget.baseUrl, '/api/orders/ord-a-1001', a.key)).status).toBe(200);
      expect((await request(protectedTarget.baseUrl, '/api/orders/ord-a-1001', b.key)).status).toBe(403);
      expect((await request(protectedTarget.baseUrl, '/api/orders/ord-a-1001/receipt', b.key)).status).toBe(403);
      expect((await request(protectedTarget.baseUrl, '/api/products')).status).toBe(200);
    } finally {
      await protectedTarget?.close();
    }
    expect(await inventory()).toEqual(before);
    expect(
      (await readFile(join(settings.root, 'data/example-target/private-seed.json'), 'utf8')) === JSON.stringify(seed),
    ).toBe(true);
  }, 180_000);

  it('prints a working CLI handoff and observes products through the scanner gateway', async () => {
    const before = await inventory();
    expect(before).toEqual({ containers: [], networks: [], images: [] });
    const seed = await initializeExampleData(settings.root);
    let example: Awaited<ReturnType<typeof launchExample>> | undefined;
    let runtime: Awaited<ReturnType<typeof startControlPlane>> | undefined;
    let images: Awaited<ReturnType<typeof buildDiscoveryImages>> | undefined;
    const databaseName = `example-gateway-${randomUUID()}`;
    const scannerSettings = loadSettings(
      {
        DATABASE_URL: `file:./data/${databaseName}.db`,
        CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url'),
        SCANNER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
        SCANNER_DISCOVERY_ENABLED: 'true',
        SCANNER_INVESTIGATION_ENABLED: 'false',
      },
      settings.root,
    );
    try {
      example = await launchExample('vulnerable');
      expect(example.output.mode).toBe('vulnerable');
      expect(example.output.users[0].id === seed.users[0].id).toBe(true);
      expect(example.output.users[1].id === seed.users[1].id).toBe(true);
      expect(example.output.users[0].apiKey === seed.users[0].key).toBe(true);
      expect(example.output.users[1].apiKey === seed.users[1].key).toBe(true);
      expect(example.output.routes).toEqual(
        expect.arrayContaining([
          'GET /api/orders',
          'GET /api/orders/{id}',
          'GET /api/orders/{id}/receipt',
          'GET /api/products',
          'GET /openapi.json',
        ]),
      );
      expect(example.output.openApiUrl).toBe(`${example.output.scannerUrl}/openapi.json`);
      expect((await fetch(`${example.output.hostUrl}/api/products`)).status).toBe(200);
      const competing = spawn('npm', ['run', 'example-target'], {
        cwd: settings.root,
        env: { ...process.env, PATH: process.env.PATH },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let competingOutput = '';
      const captureCompeting = (chunk: Buffer) => {
        competingOutput = `${competingOutput}${chunk.toString()}`.slice(-8192);
      };
      competing.stdout!.on('data', captureCompeting);
      competing.stderr!.on('data', captureCompeting);
      const competingExit = await new Promise<number | null>(resolve => competing.once('exit', resolve));
      expect(competingExit).not.toBe(0);
      expect(competingOutput.includes('EXAMPLE_INSTANCE_ACTIVE')).toBe(true);
      expect((await fetch(`${example.output.hostUrl}/api/products`)).status).toBe(200);
      const boundary = await readExampleBoundary(scannerSettings);
      expect(example.output.scannerUrl).toBe(`http://${boundary!.address}:18080`);
      const wrongPlatform = settings.DOCKER_PLATFORM === 'linux/arm64' ? 'linux/amd64' : 'linux/arm64';
      const dev = spawn('npm', ['run', 'dev'], {
        cwd: settings.root,
        detached: true,
        env: {
          ...process.env,
          PATH: process.env.PATH,
          DOCKER_PLATFORM: wrongPlatform,
          DATABASE_URL: `file:./data/example-preflight-${randomUUID()}.db`,
          CONTROL_BOOTSTRAP_SECRET: randomBytes(32).toString('base64url'),
          SCANNER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
          SCANNER_DISCOVERY_ENABLED: 'false',
          SCANNER_INVESTIGATION_ENABLED: 'false',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let devOutput = '';
      const capture = (chunk: Buffer) => {
        devOutput = `${devOutput}${chunk.toString()}`.slice(-8192);
      };
      dev.stdout!.on('data', capture);
      dev.stderr!.on('data', capture);
      const devTimer = setTimeout(() => {
        if (dev.pid) process.kill(-dev.pid, 'SIGTERM');
      }, 20_000);
      const devExit = await new Promise<number | null>(resolve => dev.once('exit', resolve));
      clearTimeout(devTimer);
      expect(devExit).not.toBe(0);
      expect(devOutput).toContain('UNSUPPORTED_PLATFORM');
      expect(devOutput).not.toContain('Local API:');

      const evidenceHome = join(settings.root, 'data/example-target/build-evidence');
      const lockBytes = await readFile(join(evidenceHome, 'package-lock.json'));
      const provenance = JSON.parse(await readFile(join(evidenceHome, 'provenance.json'), 'utf8')) as {
        baseDigest: string;
        lockHash: string;
        sourceHash: string;
        imageId: string;
      };
      const receipt = JSON.parse(await readFile(join(settings.root, 'data/example-target/transport.json'), 'utf8')) as {
        baseDigest: string;
        lockHash: string;
        sourceHash: string;
        imageId: string;
      };
      expect({
        baseDigest: receipt.baseDigest,
        lockHash: receipt.lockHash,
        sourceHash: receipt.sourceHash,
        imageId: receipt.imageId,
      }).toEqual({
        baseDigest: provenance.baseDigest,
        lockHash: provenance.lockHash,
        sourceHash: provenance.sourceHash,
        imageId: provenance.imageId,
      });
      expect(provenance.lockHash).toBe(createHash('sha256').update(lockBytes).digest('hex'));
      expect(provenance.baseDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
      const built = await client.getImage(receipt.imageId).inspect();
      expect(built.Config.Labels?.['dev.mastra.security-scanner.example-base']).toBe(provenance.baseDigest);
      expect(built.Config.Labels?.['dev.mastra.security-scanner.example-lock']).toBe(provenance.lockHash);
      expect(built.Config.Labels?.['dev.mastra.security-scanner.input']).toBe(provenance.sourceHash);

      await setup(scannerSettings);
      images = await buildDiscoveryImages(scannerSettings);
      runtime = await startControlPlane(scannerSettings, 0, undefined, boundary);
      const base = runtime.url;
      const login = await fetch(`${base}/api/session`, {
        method: 'POST',
        headers: { origin: base, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: scannerSettings.CONTROL_BOOTSTRAP_SECRET }),
      });
      expect(login.status).toBe(201);
      const cookie = login.headers.get('set-cookie')?.split(';')[0];
      const csrf = ((await login.json()) as { csrfToken: string }).csrfToken;
      expect(cookie).toBeTruthy();
      /** Send an authenticated JSON request to the isolated example control plane with optional revision. */
      const call = async (path: string, method = 'GET', body?: unknown, revision?: number) => {
        const response = await fetch(`${base}${path}`, {
          method,
          headers: {
            origin: base,
            cookie: cookie!,
            'x-csrf-token': csrf,
            'content-type': 'application/json',
            ...(revision ? { 'if-match': `"${revision}"` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, data: (await response.json()) as Record<string, unknown> };
      };
      const limits = { maxRequests: 30, maxDurationSeconds: 60, maxResponseBytes: 131072, maxConcurrency: 1 };
      const policyResponse = await call('/api/policies', 'POST', {
        name: 'Example gateway',
        permittedMethods: ['GET', 'HEAD'],
        scanLimits: limits,
        retention: { evidenceDays: 1, approvedBy: 'example-operator' },
      });
      expect(policyResponse.status).toBe(201);
      const policy = policyResponse.data as unknown as Policy;
      const targetResponse = await call('/api/targets', 'POST', {
        name: 'Owned example products',
        entryUrl: `${example.output.scannerUrl}/api/products`,
        approvedOrigins: [example.output.scannerUrl],
        allowedPaths: ['/api'],
        excludedPaths: [],
        permittedMethods: ['GET', 'HEAD'],
        environment: 'lab',
        authorizationEvidenceRef: 'operator:owned-example',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
        authProfileIds: [],
      });
      expect(targetResponse.status).toBe(201);
      const target = targetResponse.data as unknown as Target;
      const profileResponse = await call(
        `/api/targets/${target.id}/profiles`,
        'POST',
        { kind: 'public', role: 'public', name: 'Public products' },
        target.revision,
      );
      expect(profileResponse.status).toBe(201);
      const profile = profileResponse.data as unknown as Profile;
      const current = (await call(`/api/targets/${target.id}`)).data as unknown as Target;
      const admission = await call(`/api/targets/${target.id}/scans`, 'POST', {
        targetRevision: current.revision,
        policyRevision: policy.revision,
        mode: 'http',
        idempotencyKey: randomUUID(),
        profiles: [
          {
            targetRevision: current.revision,
            policyRevision: policy.revision,
            profileId: profile.id,
            profileRevision: profile.revision,
            credentialRevision: profile.credentialRevision,
          },
        ],
      });
      expect(admission.status).toBe(202);
      const scanId = String(admission.data.id);
      let scan: Scan | undefined;
      for (let attempt = 0; attempt < 900; attempt++) {
        scan = (await call(`/api/scans/${scanId}`)).data as unknown as Scan;
        if (terminal(scan.state) || scan.cleanup === 'DEBT') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(scan?.state).toBe('COMPLETED');
      expect(scan?.cleanup).toBe('COMPLETE');
      const inventoryResponse = await call(`/api/scans/${scanId}/inventory?limit=100`);
      expect(inventoryResponse.status).toBe(200);
      const evidence = (inventoryResponse.data.items ?? []) as Evidence[];
      expect(
        evidence.some(
          item =>
            item.observation.origin === new URL(example!.output.scannerUrl).origin &&
            item.observation.path === '/api/products' &&
            item.observation.status === 200 &&
            item.observation.provenance === 'upstream-response',
        ),
      ).toBe(true);

      const restResponse = await call('/api/targets', 'POST', {
        name: 'Example REST orders',
        entryUrl: `${example.output.scannerUrl}/api/orders`,
        approvedOrigins: [example.output.scannerUrl],
        allowedPaths: ['/api', '/openapi.json'],
        excludedPaths: [],
        permittedMethods: ['GET', 'HEAD'],
        environment: 'lab',
        authorizationEvidenceRef: 'operator:owned-example',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
        authProfileIds: [],
        application: {
          kind: 'rest_api',
          version: 1,
          discoveryModes: ['openapi', 'observed_json'],
          openApiUrl: example.output.openApiUrl,
        },
      });
      expect(restResponse.status).toBe(201);
      const restTarget = restResponse.data as unknown as Target;
      const registered: Profile[] = [];
      for (const [index, user] of example.output.users.entries()) {
        const fresh = (await call(`/api/targets/${restTarget.id}`)).data as unknown as Target;
        const response = await call(
          `/api/targets/${restTarget.id}/profiles`,
          'POST',
          {
            kind: 'api_key_header',
            name: `Example user ${index + 1}`,
            role: 'user',
            credential: { value: user.apiKey },
          },
          fresh.revision,
        );
        expect(response.status).toBe(201);
        expect(JSON.stringify(response.data)).not.toContain(user.apiKey);
        registered.push(response.data as unknown as Profile);
      }
      const beforeRules = (await call(`/api/targets/${restTarget.id}`)).data as unknown as Target;
      const { id: _id, owner: _owner, revision: _revision, ...replacement } = beforeRules;
      const confirmedRevision = beforeRules.revision + 1;
      /** Build an operator route rule with the selected audience and optional object policy. */
      const rule = (pathTemplate: string, audience: 'user' | 'public', objectPolicy?: 'owner' | 'shared') => ({
        version: 1,
        method: 'GET',
        pathTemplate,
        source: 'operator',
        operatorRevision: confirmedRevision,
        audience,
        ...(objectPolicy ? { objectPolicy } : {}),
        expectedUnauthorizedStatus: audience === 'public' ? [] : [401, 403],
      });
      const updated = await call(
        `/api/targets/${restTarget.id}`,
        'PUT',
        {
          ...replacement,
          authenticationDrivers: registered.map(profile => ({
            kind: 'api_key_header',
            version: 1,
            profileId: profile.id,
            credentialOrigins: [example!.output.scannerUrl],
            secretRef: profile.id,
            headerName: 'x-api-key',
            accessCheckPath: '/api/orders',
            refresh: 'reregister',
          })),
          routeAccessRules: [
            rule('/api/orders', 'user', 'owner'),
            rule('/api/orders/{id}', 'user', 'owner'),
            rule('/api/orders/{id}/receipt', 'user', 'owner'),
            rule('/api/products', 'public'),
          ],
        },
        beforeRules.revision,
      );
      expect(updated.status).toBe(200);
      const confirmedTarget = updated.data as unknown as Target;
      const admissionRest = await call(`/api/targets/${restTarget.id}/scans`, 'POST', {
        targetRevision: confirmedTarget.revision,
        policyRevision: policy.revision,
        mode: 'http',
        idempotencyKey: randomUUID(),
        profiles: registered.map(profile => ({
          targetRevision: confirmedTarget.revision,
          policyRevision: policy.revision,
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        })),
      });
      expect(admissionRest.status).toBe(202);
      let restScan: Scan | undefined;
      for (let attempt = 0; attempt < 900; attempt++) {
        restScan = (await call(`/api/scans/${admissionRest.data.id}`)).data as unknown as Scan;
        if (terminal(restScan.state) || restScan.cleanup === 'DEBT') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(
        restScan?.state,
        JSON.stringify({
          reason: restScan?.reason,
          roles: restScan?.roles.map(role => role.identity),
          counters: restScan?.networkCounters,
        }),
      ).toBe('COMPLETED');
      expect(restScan?.roles.map(role => role.identity)).toEqual(['READY', 'READY']);
      expect(restScan?.networkCounters['credential-injected']).toBe(restScan?.networkCounters.authorized);
      expect(restScan?.networkCounters['credential-deferred']).toBeGreaterThan(0);
      expect(restScan?.networkCounters['numeric-pins']).toBeGreaterThan(0);
      expect(restScan?.networkCounters['peer-verified']).toBeGreaterThan(0);
      const currentProfiles: Array<{ identity: Record<string, number | string> }> = [];
      for (const profile of registered) {
        const checked = (await call(`/api/targets/${restTarget.id}/profiles/${profile.id}`)).data as {
          identity: Record<string, number | string>;
        };
        expect(checked.identity).toMatchObject({ status: 'READY', reason: 'ACCESS_CHECK_SUCCEEDED' });
        currentProfiles.push(checked);
      }
      const restInventory = await call(`/api/scans/${admissionRest.data.id}/inventory?limit=100`);
      const restEvidence = (restInventory.data.items ?? []) as Evidence[];
      expect(
        restEvidence.filter(
          item => item.observation.path === '/api/orders' && item.observation.provenance === 'upstream-response',
        ),
      ).toHaveLength(2);
      expect(restEvidence.some(item => item.observation.path === '/api/orders/ord-a-1001')).toBe(true);
      expect(restEvidence.some(item => item.observation.path === '/api/orders/ord-b-2001')).toBe(true);
      expect(
        restEvidence.some(
          item =>
            item.observation.path === '/api/orders/ord-a-1001/receipt' &&
            item.observation.linkedFrom === '/api/orders/ord-a-1001',
        ),
      ).toBe(true);
      expect(
        restEvidence.some(
          item =>
            item.observation.path === '/api/orders/ord-b-2001/receipt' &&
            item.observation.linkedFrom === '/api/orders/ord-b-2001',
        ),
      ).toBe(true);
      expect(
        restEvidence
          .filter(item => item.observation.path.startsWith('/api/orders/ord-a-'))
          .every(item => item.observation.profileId === registered[0]!.id),
      ).toBe(true);
      expect(
        restEvidence
          .filter(item => item.observation.path.startsWith('/api/orders/ord-b-'))
          .every(item => item.observation.profileId === registered[1]!.id),
      ).toBe(true);
      expect(
        restEvidence.filter(
          item => item.observation.path === '/api/products' && item.observation.provenance === 'upstream-response',
        ),
      ).toHaveLength(2);
      const retained = JSON.stringify({ restScan, restEvidence, target: confirmedTarget, profiles: registered });
      for (const user of example.output.users) expect(retained).not.toContain(user.apiKey);

      await runtime.close();
      runtime = await startControlPlane(scannerSettings, 0);
      const unownedBase = runtime.url;
      const unownedLogin = await fetch(`${unownedBase}/api/session`, {
        method: 'POST',
        headers: { origin: unownedBase, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: scannerSettings.CONTROL_BOOTSTRAP_SECRET }),
      });
      expect(unownedLogin.status).toBe(201);
      const unownedCookie = unownedLogin.headers.get('set-cookie')?.split(';')[0];
      const unownedCsrf = ((await unownedLogin.json()) as { csrfToken: string }).csrfToken;
      const denied = await fetch(`${unownedBase}/api/targets/${restTarget.id}/scans`, {
        method: 'POST',
        headers: {
          origin: unownedBase,
          cookie: unownedCookie!,
          'x-csrf-token': unownedCsrf,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          targetRevision: confirmedTarget.revision,
          policyRevision: policy.revision,
          mode: 'http',
          idempotencyKey: randomUUID(),
          profiles: currentProfiles.map(item => ({
            targetRevision: item.identity.targetRevision,
            policyRevision: item.identity.policyRevision,
            profileId: item.identity.profileId,
            profileRevision: item.identity.profileRevision,
            credentialRevision: item.identity.credentialRevision,
          })),
        }),
      });
      expect(denied.status).toBe(403);
      expect(await denied.json()).toMatchObject({ code: 'INSECURE_AUTH_TRANSPORT' });

      /** Call the separate unowned control plane to verify that owned-lab authorization is required. */
      const noLabCall = async (path: string, method = 'GET', body?: unknown, revision?: number) => {
        const response = await fetch(`${unownedBase}${path}`, {
          method,
          headers: {
            origin: unownedBase,
            cookie: unownedCookie!,
            'x-csrf-token': unownedCsrf,
            'content-type': 'application/json',
            ...(revision ? { 'if-match': `"${revision}"` } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        return { status: response.status, data: (await response.json()) as Record<string, unknown> };
      };
      const privateOrigin = 'https://127.0.0.1';
      const privateResponse = await noLabCall('/api/targets', 'POST', {
        name: 'Private DNS negative',
        entryUrl: `${privateOrigin}/api/orders`,
        approvedOrigins: [privateOrigin],
        allowedPaths: ['/api'],
        excludedPaths: [],
        permittedMethods: ['GET'],
        environment: 'staging',
        authorizationEvidenceRef: 'owned-negative-proof',
        authorizationConfirmed: true,
        policyId: policy.id,
        policyRevision: policy.revision,
        schedule: { enabled: false, timezone: 'UTC' },
        scanLimits: limits,
        authProfileIds: [],
        application: { kind: 'rest_api', version: 1, discoveryModes: ['observed_json'] },
      });
      expect(privateResponse.status).toBe(201);
      const privateTarget = privateResponse.data as unknown as Target;
      const privateProfileResponse = await noLabCall(
        `/api/targets/${privateTarget.id}/profiles`,
        'POST',
        {
          kind: 'api_key_header',
          name: 'Private negative user',
          role: 'user',
          credential: { value: seed.users[0].key },
        },
        privateTarget.revision,
      );
      expect(privateProfileResponse.status).toBe(201);
      const privateProfile = privateProfileResponse.data as unknown as Profile;
      const privateCurrent = (await noLabCall(`/api/targets/${privateTarget.id}`)).data as unknown as Target;
      const { id: _privateId, owner: _privateOwner, revision: _privateRevision, ...privateInput } = privateCurrent;
      const privateUpdate = await noLabCall(
        `/api/targets/${privateTarget.id}`,
        'PUT',
        {
          ...privateInput,
          authenticationDrivers: [
            {
              kind: 'api_key_header',
              version: 1,
              profileId: privateProfile.id,
              secretRef: privateProfile.id,
              credentialOrigins: [privateOrigin],
              headerName: 'x-api-key',
              accessCheckPath: '/api/orders',
              refresh: 'reregister',
            },
          ],
          routeAccessRules: [
            {
              version: 1,
              method: 'GET',
              pathTemplate: '/api/orders',
              source: 'operator',
              operatorRevision: privateCurrent.revision + 1,
              audience: 'user',
              objectPolicy: 'owner',
              expectedUnauthorizedStatus: [401, 403],
            },
          ],
        },
        privateCurrent.revision,
      );
      expect(privateUpdate.status).toBe(200);
      const privateConfirmed = privateUpdate.data as unknown as Target;
      const privateAdmission = await noLabCall(`/api/targets/${privateTarget.id}/scans`, 'POST', {
        targetRevision: privateConfirmed.revision,
        policyRevision: policy.revision,
        mode: 'http',
        idempotencyKey: randomUUID(),
        profiles: [
          {
            targetRevision: privateConfirmed.revision,
            policyRevision: policy.revision,
            profileId: privateProfile.id,
            profileRevision: privateProfile.revision,
            credentialRevision: privateProfile.credentialRevision,
          },
        ],
      });
      expect(privateAdmission.status).toBe(202);
      let privateScan: Scan | undefined;
      for (let attempt = 0; attempt < 300; attempt++) {
        privateScan = (await noLabCall(`/api/scans/${privateAdmission.data.id}`)).data as unknown as Scan;
        if (terminal(privateScan.state) || privateScan.cleanup === 'DEBT') break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      expect(privateScan?.cleanup).toBe('COMPLETE');
      expect(privateScan?.networkCounters['denied-dns']).toBeGreaterThan(0);
      expect(privateScan?.networkCounters['credential-injected'] ?? 0).toBe(0);
      expect(privateScan?.networkCounters['numeric-pins'] ?? 0).toBe(0);
    } finally {
      await runtime?.close();
      if (images) await releaseDiscoveryImages(client, scannerSettings, images);
      await example?.close();
      for (const path of [scannerSettings.databasePath, scannerSettings.mastraDatabasePath])
        for (const suffix of ['', '-wal', '-shm']) await rm(path + suffix, { force: true });
    }
    expect(await inventory()).toEqual(before);
  }, 300_000);

  it('allows one direct transport to recover a crashed example despite a reused PID', async () => {
    const before = await inventory();
    expect(before).toEqual({ containers: [], networks: [], images: [] });
    const seed = await initializeExampleData(settings.root);
    const original = await launchExample('vulnerable');
    let recovered: Awaited<ReturnType<typeof startExampleTransport>> | undefined;
    try {
      expect((await fetch(`${original.output.hostUrl}/api/products`)).status).toBe(200);
      await original.crash();
      expect((await inventory()).containers).toHaveLength(2);
      const path = join(settings.root, 'data/example-target/transport.json');
      const stale = JSON.parse(await readFile(path, 'utf8')) as { pid: number };
      await writeFile(path, JSON.stringify({ ...stale, pid: process.pid }), { mode: 0o600 });
      const attempts = await Promise.allSettled([
        startExampleTransport(settings, 'protected'),
        startExampleTransport(settings, 'protected'),
      ]);
      const winners = attempts
        .filter(
          (item): item is PromiseFulfilledResult<Awaited<ReturnType<typeof startExampleTransport>>> =>
            item.status === 'fulfilled',
        )
        .map(item => item.value);
      recovered = winners[0];
      expect(winners.length).toBe(1);
      expect(attempts.filter(item => item.status === 'rejected')).toHaveLength(1);
      expect(recovered?.receipt.mode).toBe('protected');
      expect(
        (await readFile(join(settings.root, 'data/example-target/private-seed.json'), 'utf8')) === JSON.stringify(seed),
      ).toBe(true);
      const cross = await fetch(`${recovered!.baseUrl}/api/orders/ord-a-1001`, {
        headers: { 'x-api-key': seed.users[1].key },
      });
      expect(cross.status).toBe(403);
      const own = await fetch(`${recovered!.baseUrl}/api/orders/ord-a-1001`, {
        headers: { 'x-api-key': seed.users[0].key },
      });
      expect(own.status).toBe(200);
      const during = await inventory();
      expect(during.containers).toHaveLength(2);
      expect(during.networks).toHaveLength(2);
      expect(during.images).toHaveLength(1);
    } finally {
      await recovered?.close();
      const path = join(settings.root, 'data/example-target/transport.json');
      const remaining = await readFile(path, 'utf8').catch(error => {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      });
      if (remaining) await reconcileExampleTransport(settings);
    }
    expect(await inventory()).toEqual(before);
  }, 180_000);
});
