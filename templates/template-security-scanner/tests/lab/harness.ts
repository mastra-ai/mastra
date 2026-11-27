import { createClient } from '@libsql/client';
import { randomBytes, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { z } from 'zod';
import { readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { loadSettings } from '../../src/config/settings.js';
import type { Policy, Profile, Target } from '../../src/core/contracts.js';
import { startControlPlane } from '../../src/http/server.js';
import { setup } from '../../src/runtime/setup.js';
import { dockerClient, ownerIdentity } from '../../src/runtime/docker.js';
import { buildDiscoveryImages, releaseDiscoveryImages } from '../../src/discovery/images.js';
import { ownedLabBoundary } from '../../src/discovery/driver.js';
import { stageFiles, control, readRuntimeFile } from '../../src/discovery/io.js';
import { SecretGuard } from '../../src/discovery/parser.js';
import { terminal, type Scan } from '../../src/discovery/contracts.js';
import type { InvestigationModels } from '../../src/investigation/models.js';
import type { AdvisorySource } from '../../src/advisory/source.js';

const root = resolve(import.meta.dirname, '../..');
const cleanup: Array<() => Promise<void>> = [];
/** Close every registered discovery lab while collecting cleanup failures. */
export async function closeDiscoveryLabs() {
  const failures: unknown[] = [];
  for (const close of cleanup.splice(0).reverse())
    try {
      await close();
    } catch (error) {
      failures.push(error);
    }
  if (failures.length) throw new AggregateError(failures, 'DISCOVERY_LAB_CLEANUP_FAILED');
}
export function registerLabCleanup(close: () => Promise<void>) {
  cleanup.push(close);
}
/** Create the isolated Docker lab and protected application used by discovery journeys. */
export async function startDiscoveryLab(
  options: {
    processMode?: boolean;
    investigationModels?: InvestigationModels;
    investigationEnabled?: boolean;
    advisorySource?: AdvisorySource;
  } = {},
) {
  const name = `discovery-${randomUUID()}`;
  const bootstrap = randomBytes(32).toString('base64url');
  const settings = loadSettings(
    {
      DATABASE_URL: `file:./data/${name}.db`,
      CONTROL_BOOTSTRAP_SECRET: bootstrap,
      SCANNER_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
      SCANNER_DISCOVERY_ENABLED: 'true',
      SCANNER_INVESTIGATION_ENABLED:
        (options.investigationEnabled ?? Boolean(options.investigationModels)) ? 'true' : 'false',
    },
    root,
  );
  cleanup.push(async () => {
    for (const path of [settings.databasePath, settings.mastraDatabasePath])
      for (const suffix of ['', '-wal', '-shm']) await rm(path + suffix, { force: true });
  });
  await setup(settings);
  const client = dockerClient(settings),
    images = await buildDiscoveryImages(settings);
  cleanup.push(() => releaseDiscoveryImages(client, settings, images));
  const token = randomUUID(),
    labels = {
      'dev.mastra.security-scanner.lab': token,
      'dev.mastra.security-scanner.owner': ownerIdentity(settings),
      'dev.mastra.security-scanner.test-run': process.env.SCANNER_TEST_RUN_ID ?? randomUUID(),
    };
  const network = await client.createNetwork({
    Name: `scanner-lab-${token}`,
    Internal: true,
    Driver: 'bridge',
    Labels: labels,
  });
  cleanup.push(() => network.remove());
  const fixture = await client.createContainer({
    name: `scanner-lab-${token}`,
    Image: images.gateway,
    Entrypoint: [],
    Cmd: ['python', '/workspace/server.py'],
    Labels: { ...labels, 'dev.mastra.security-scanner.test-image': images.gateway },
    User: '10001:10001',
    HostConfig: {
      NetworkMode: network.id,
      CapDrop: ['ALL'],
      SecurityOpt: ['no-new-privileges:true'],
      Memory: 536870912,
      MemorySwap: 536870912,
      PidsLimit: 128,
      LogConfig: { Type: 'none', Config: {} },
    },
  });
  cleanup.push(() => fixture.remove({ force: true, v: true }));
  const privateValues = {
    viewer: randomBytes(24).toString('hex') + '==',
    admin: randomBytes(24).toString('hex'),
    member: randomBytes(24).toString('hex'),
  };
  const profiles = {
    public: { name: null, value: '' },
    viewer: { name: 'x-api-key', value: privateValues.viewer },
    admin: { name: 'authorization', value: `Bearer ${privateValues.admin}` },
    member: { name: 'cookie', value: `session=${privateValues.member}` },
  };
  const inspected = await network.inspect();
  const subnet = inspected.IPAM?.Config?.[0]?.Subnet;
  if (!subnet) throw new Error('LAB_NETWORK_MISSING');
  const fixtureIp = subnet.split('/')[0]!.split('.').slice(0, 3).concat('10').join('.');
  await network.disconnect({ Container: fixture.id });
  await network.connect({ Container: fixture.id, EndpointConfig: { IPAMConfig: { IPv4Address: fixtureIp } } });
  await stageFiles(
    fixture,
    {
      'server.py': { bytes: await readFile(resolve(root, 'tests/lab/server.py')) },
      'profiles.json': { bytes: Buffer.from(JSON.stringify(profiles)) },
      'check.headers': { bytes: Buffer.alloc(0) },
      'policy.json': {
        bytes: Buffer.from(
          JSON.stringify({
            profiles: { '8080': { role: 'public', header_file: '/workspace/check.headers' } },
            headers: { public: null },
            guard_files: [],
            identities: {},
            credential_origins: { public: null },
            origins: [['http', 'allowed.lab', 18080]],
            allowed_paths: ['/'],
            excluded_paths: ['/excluded'],
            methods: ['GET', 'HEAD'],
            lab_ips: [fixtureIp],
            resolver_ip: fixtureIp,
            budget: { requests: 80, response_bytes: 262144, concurrent: 2, seconds: 120 },
          }),
        ),
      },
      'network.json': { bytes: Buffer.from(JSON.stringify({ allowedIp: fixtureIp, deniedIp: '192.0.2.255' })) },
    },
    true,
  );
  await fixture.start();
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const ready = await control(fixture, [
        'python',
        '-c',
        'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:18090/stats",timeout=1).read().decode())',
      ]);
      if (ready.success) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const diagnostic = await control(fixture, [
    'python',
    '-c',
    `import importlib.util,json,traceback
try:
 s=importlib.util.spec_from_file_location('policy_check','/opt/scanner/policy.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.Gateway().load(None);print(json.dumps({'status':'ready'}))
except Exception as e:
 frames=traceback.extract_tb(e.__traceback__);print(json.dumps({'status':'failed','type':type(e).__name__,'lines':[f.lineno for f in frames if f.filename.endswith('/policy.py')]}))`,
  ]);
  const loaded = JSON.parse(diagnostic.stdout) as { status: string; type?: string; lines?: number[] };
  if (loaded.status !== 'ready') console.error(JSON.stringify({ policyDiagnostic: loaded }));
  expect(loaded.status).toBe('ready');
  const boundary = await ownedLabBoundary(
    client,
    fixture.id,
    network.id,
    token,
    await readRuntimeFile(fixture, '/workspace/lab-root.pem'),
  );
  const startProcess = async () => {
    const child = fork(resolve(root, 'tests/lab/control-process.ts'), [], {
      execArgv: ['--import', 'tsx'],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { HOME: process.env.HOME, PATH: process.env.PATH },
    });
    const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
    const url = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('CONTROL_PROCESS_START_TIMEOUT'));
      }, 15000);
      child.once('message', message => {
        clearTimeout(timer);
        const data = message as { url?: string };
        if (data.url && /^http:\/\/127\.0\.0\.1:\d+$/.test(data.url)) resolve(data.url);
        else reject(new Error('CONTROL_PROCESS_START_FAILED'));
      });
      child.once('exit', () => {
        clearTimeout(timer);
        reject(new Error('CONTROL_PROCESS_EXITED'));
      });
      child.send({
        root,
        environment: {
          DATABASE_URL: settings.DATABASE_URL,
          CONTROL_BOOTSTRAP_SECRET: bootstrap,
          SCANNER_ENCRYPTION_KEY: settings.SCANNER_ENCRYPTION_KEY!,
          SCANNER_DISCOVERY_ENABLED: 'true',
        },
        fixtureId: fixture.id,
        networkId: network.id,
        token,
        ca: boundary.upstreamCa!.toString('base64'),
      });
    });
    let stopped = false;
    return {
      url,
      /** Ask the owned child server to close, bounding its shutdown before process termination. */
      close: async () => {
        if (stopped) return;
        stopped = true;
        child.send('close');
        const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
        try {
          await exited;
        } finally {
          clearTimeout(timer);
        }
        if (child.exitCode !== 0) throw new Error('CONTROL_PROCESS_SHUTDOWN_FAILED');
      },
      crash: async () => {
        stopped = true;
        child.kill('SIGKILL');
        await exited;
      },
    };
  };
  let activeSettings = settings;
  /** Start the lab control plane in the explicitly selected child-process or in-process mode. */
  const start = () =>
    options.processMode
      ? startProcess()
      : startControlPlane(activeSettings, 0, undefined, boundary, options.advisorySource, options.investigationModels);
  let running = await start();
  cleanup.push(() => running.close());
  let cookie = '',
    csrf = '';
  const login = async () => {
    const response = await fetch(`${running.url}/api/session`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: bootstrap }),
    });
    expect(response.status).toBe(201);
    cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken;
  };
  await login();
  const exported: string[] = [];
  /** Send a real session-protected lab API request with optional JSON body and revision. */
  const request = async (path: string, method = 'GET', body?: unknown, revision?: number) => {
    const response = await fetch(`${running.url}${path}`, {
      method,
      headers: {
        origin: running.url,
        cookie,
        'x-csrf-token': csrf,
        'content-type': 'application/json',
        ...(revision ? { 'if-match': `"${revision}"` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = (response.status === 204 ? {} : await response.json()) as Record<string, unknown>;
    exported.push(JSON.stringify(data));
    return { status: response.status, data };
  };
  /** Read actual owned target-fixture request counters through its container command channel. */
  const stats = async () => {
    const result = await control(fixture, [
      'python',
      '-c',
      'import urllib.request; print(urllib.request.urlopen("http://127.0.0.1:18090/stats",timeout=1).read().decode())',
    ]);
    if (!result.success) throw new Error('LAB_STATS_UNAVAILABLE');
    return JSON.parse(result.stdout) as Record<string, number>;
  };
  /** Poll a persisted scan until it reaches a terminal state within the journey deadline. */
  const wait = async (id: string) => {
    for (let attempt = 0; attempt < 1800; attempt++) {
      const response = await request(`/api/scans/${id}`);
      expect(response.status).toBe(200);
      const scan = response.data as unknown as Scan;
      if (terminal(scan.state) || scan.cleanup === 'DEBT') return scan;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('SCAN_DID_NOT_FINISH');
  };
  const restart = async () => {
    await running.close();
    running = await start();
    await login();
  };
  /** Crash the owned child control plane and restart it with its persisted state. */
  const crashRestart = async () => {
    if (!('crash' in running)) throw new Error('PROCESS_MODE_REQUIRED');
    await running.crash();
    running = await start();
    await login();
  };
  return {
    settings,
    url: () => running.url,
    bootstrapSecret: bootstrap,
    request,
    async query(sql: string) {
      const database = createClient({ url: settings.databaseUrl });
      try {
        return (await database.execute(sql)).rows;
      } finally {
        database.close();
      }
    },
    stats,
    wait,
    restart,
    stop: () => running.close(),
    /** Restart the in-process fixture with the selected key to exercise credential-loss recovery. */
    async restartWithKey(key?: string) {
      if (options.processMode) throw new Error('IN_PROCESS_KEY_RECOVERY_REQUIRED');
      await running.close();
      activeSettings = { ...settings, SCANNER_ENCRYPTION_KEY: key };
      running = await start();
      await login();
    },
    crashRestart,
    privateValues,
    exported,
    client,
    images,
    fixture,
    boundary,
  };
}

export type DiscoveryLab = Awaited<ReturnType<typeof startDiscoveryLab>>;
/** Run one discovery scenario with bounded execution and owned-resource cleanup. */
export async function discoveryCase(
  lab: DiscoveryLab,
  options: {
    path?: string;
    origin?: string;
    origins?: string[];
    limits?: Policy['scanLimits'];
    authenticated?: boolean;
    profileExpiresAt?: string;
  } = {},
) {
  const limits = options.limits ?? {
    maxRequests: 40,
    maxDurationSeconds: 60,
    maxResponseBytes: 262144,
    maxConcurrency: 2,
  };
  const origin = options.origin ?? 'http://allowed.lab:18080';
  const policyResponse = await lab.request('/api/policies', 'POST', {
    name: 'Controlled discovery',
    permittedMethods: ['GET', 'HEAD'],
    scanLimits: limits,
    retention: { evidenceDays: 1, approvedBy: 'lab-operator' },
  });
  expect(policyResponse.status).toBe(201);
  const policy = policyResponse.data as unknown as Policy;
  const created = await lab.request('/api/targets', 'POST', {
    name: 'Owned boundary',
    entryUrl: origin + (options.path ?? '/catalog'),
    approvedOrigins: options.origins ?? [origin],
    allowedPaths: ['/'],
    excludedPaths: ['/excluded'],
    permittedMethods: ['GET', 'HEAD'],
    environment: 'lab',
    authorizationEvidenceRef: 'approval:owned-discovery-lab',
    authorizationConfirmed: true,
    policyId: policy.id,
    policyRevision: policy.revision,
    schedule: { enabled: false, timezone: 'UTC' },
    scanLimits: limits,
    authProfileIds: [],
  });
  expect(created.status).toBe(201);
  let target = created.data as unknown as Target;
  const createdProfile = await lab.request(
    `/api/targets/${target.id}/profiles`,
    'POST',
    options.authenticated
      ? {
          kind: 'header',
          role: 'viewer',
          name: 'Account viewer',
          identityEndpoint: origin + '/identity',
          expectedIdentity: 'viewer-account',
          ...(options.profileExpiresAt ? { expiresAt: options.profileExpiresAt } : {}),
          credential: { name: 'x-api-key', value: lab.privateValues.viewer },
        }
      : { kind: 'public', role: 'public', name: 'Public inventory' },
    target.revision,
  );
  expect(createdProfile.status).toBe(201);
  const profile = createdProfile.data as unknown as Profile;
  target = (await lab.request(`/api/targets/${target.id}`)).data as unknown as Target;
  const admit = async (mode: 'http' | 'headless' = 'http') => {
    const current = (await lab.request(`/api/targets/${target.id}`)).data as unknown as Target;
    const selected = (await lab.request(`/api/targets/${target.id}/profiles/${profile.id}`)).data as unknown as Profile;
    const request = {
      targetRevision: current.revision,
      policyRevision: policy.revision,
      mode,
      idempotencyKey: randomUUID(),
      profiles: [
        {
          targetRevision: current.revision,
          policyRevision: policy.revision,
          profileId: profile.id,
          profileRevision: selected.revision,
          credentialRevision: selected.credentialRevision,
        },
      ],
    };
    const response = await lab.request(`/api/targets/${target.id}/scans`, 'POST', request);
    return { ...response, request };
  };
  return { target, policy, profile, admit };
}

/** Execute a bounded command in the owned target fixture container. */
export async function fixtureCommand(lab: DiscoveryLab, path: string) {
  if (
    !/^\/(?:dns\?mode=(?:allow|mixed|denied|rebind|mapped|cname|malformed|timeout|many)|expire\?role=viewer|ssrf-pair\?mode=(?:hold|release))$/.test(
      path,
    )
  )
    throw new Error('UNKNOWN_LAB_CONTROL');
  const result = await control(lab.fixture, [
    'python',
    '-c',
    `import urllib.request;urllib.request.urlopen("http://127.0.0.1:18090${path}",timeout=2).read()`,
  ]);
  expect(result.success).toBe(true);
}

/** Read actual Chromium control evidence from the owned sandbox. */
export async function observeBrowserControls(lab: DiscoveryLab, scanId: string, signal: AbortSignal) {
  const observed = new Map<string, number>(),
    guard = new SecretGuard(Object.values(lab.privateValues));
  try {
    while (!signal.aborted) {
      const entries = await lab.client.listContainers({
        filters: { label: [`dev.mastra.security-scanner.scan=${scanId}`, 'mastra.sandbox=true'] },
      });
      for (const entry of entries) {
        const profileId = entry.Labels['dev.mastra.security-scanner.profile'];
        if (!profileId || observed.has(profileId)) continue;
        const container = lab.client.getContainer(entry.Id);
        let processes;
        try {
          processes = await control(container, ['/bin/sh', '/workspace/browser-inspect.sh'], 1000);
        } catch (error) {
          if ([404, 409].includes((error as { statusCode?: number }).statusCode ?? 0)) continue;
          throw error;
        }
        if (!processes.success) continue;
        expect(guard.unsafe(processes.stdout)).toBe(false);
        const roots = processes.stdout
          .split('PROCESS\0')
          .slice(1)
          .map(value => value.split('\0').filter(Boolean));
        const ports = roots
          .filter(args => args[0]?.endsWith('/leakless'))
          .map(args => Number(args[2]?.replace('127.0.0.1:', '')));
        if (!ports.length) continue;
        expect(ports).toHaveLength(1);
        const port = z.number().int().min(40000).max(40031).parse(ports[0]);
        const scan = (await lab.request(`/api/scans/${scanId}`)).data as unknown as Scan;
        const profile = (await lab.request(`/api/targets/${scan.targetId}/profiles/${profileId}`))
          .data as unknown as Profile;
        const role = z.enum(['viewer', 'admin', 'member', 'public']).parse(profile.role);
        const result = await control(lab.fixture, [
          'python',
          '-c',
          `import urllib.request;urllib.request.urlopen("http://127.0.0.1:18090/control?role=${role}&port=${port}",timeout=2).read()`,
        ]);
        expect(result.success).toBe(true);
        observed.set(profileId, port);
      }
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return observed;
  } finally {
    guard.clear();
  }
}

/** Start an owned host listener to detect forbidden gateway egress. */
export async function hostGatewayCanary(lab: DiscoveryLab) {
  const counts = { tcp: 0, http: 0 };
  const server = createServer((request, response) => {
    counts.http++;
    response.writeHead(request.url === '/owned-host-canary' ? 200 : 404, {
      'content-type': 'text/plain',
      connection: 'close',
    });
    response.end('owned-host-canary');
  });
  server.on('connection', socket => {
    counts.tcp++;
    socket.setTimeout(2000, () => socket.destroy());
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', resolve);
  });
  registerLabCleanup(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close(error => (error ? reject(error) : resolve()));
      }),
  );
  const bound = server.address();
  if (!bound || typeof bound === 'string') throw new Error('HOST_CANARY_NOT_LISTENING');
  const command = [
    'python',
    '-c',
    'import socket,http.client,json,sys;host=socket.gethostbyname("host.docker.internal");c=http.client.HTTPConnection(host,int(sys.argv[1]),timeout=2);c.request("GET","/owned-host-canary");r=c.getresponse();print(json.dumps({"host":host,"status":r.status,"body":r.read(64).decode()}));c.close()',
    String(bound.port),
  ];
  let positive = await control(lab.fixture, command, 4000);
  if (!positive.success) {
    // The fixture's internal-only bridge may have no host route. Give this
    // positive control a separate owned bridge, then remove it before scanning.
    const token = randomUUID(),
      network = await lab.client.createNetwork({
        Name: `scanner-lab-${token}`,
        Internal: false,
        Driver: 'bridge',
        Labels: {
          'dev.mastra.security-scanner.lab': token,
          'dev.mastra.security-scanner.owner': ownerIdentity(lab.settings),
          'dev.mastra.security-scanner.test-run': process.env.SCANNER_TEST_RUN_ID ?? randomUUID(),
        },
      });
    registerLabCleanup(() => network.remove());
    await network.connect({ Container: lab.fixture.id });
    try {
      positive = await control(lab.fixture, command, 4000);
    } finally {
      await network.disconnect({ Container: lab.fixture.id });
    }
  }
  if (!positive.success) throw new Error('OWNED_HOST_CANARY_UNREACHABLE');
  const observed = z
    .object({ host: z.ipv4(), status: z.literal(200), body: z.literal('owned-host-canary') })
    .strict()
    .parse(JSON.parse(positive.stdout));
  expect(counts.tcp).toBeGreaterThan(0);
  expect(counts.http).toBeGreaterThan(0);
  return { address: observed.host, port: bound.port, counts: () => ({ ...counts }) };
}
