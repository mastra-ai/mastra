import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cp, mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect } from 'vitest';
import { z } from 'zod';
import { loadSettings } from '../../src/config/settings.js';
import { targetSchema } from '../../src/core/contracts.js';
import { control } from '../../src/discovery/io.js';
import { operationStatus } from '../../src/runtime/operations.js';
import { dockerClient, ownerIdentity } from '../../src/runtime/docker.js';

const sourceRoot = resolve(import.meta.dirname, '../..');
/** Reserve and release a loopback port for the isolated setup journey. */
async function freePort() {
  const listener = createServer();
  await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('PORT_UNAVAILABLE');
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close(error => (error ? reject(error) : resolve())));
  return port;
}
/** Verify installation, setup and a public scan using only the owned local lab. */
export async function cleanSetupAndPublicLab() {
  const temporary = await mkdtemp(join(tmpdir(), 'scanner-clean-'));
  const root = join(temporary, 'application'),
    home = join(temporary, 'home');
  await mkdir(root, { mode: 0o700 });
  await mkdir(home, { mode: 0o700 });
  const bootstrap = randomBytes(32).toString('base64url'),
    key = randomBytes(32).toString('hex');
  const configuration = loadSettings({}, root),
    client = dockerClient(configuration),
    owner = ownerIdentity(configuration);
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: home,
    NPM_CONFIG_USERCONFIG: join(temporary, 'npmrc'),
    NPM_CONFIG_GLOBALCONFIG: join(temporary, 'global-npmrc'),
    NPM_CONFIG_CACHE: join(temporary, 'npm-cache'),
    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org',
    DOCKER_HOST: `unix://${configuration.DOCKER_SOCKET}`,
    CONTROL_BOOTSTRAP_SECRET: bootstrap,
    SCANNER_ENCRYPTION_KEY: key,
    SCANNER_DISCOVERY_ENABLED: 'true',
    SCANNER_INVESTIGATION_ENABLED: 'false',
    SCANNER_ADVISORY_SYNC_ENABLED: 'false',
    PORT: String(await freePort()),
  };
  await writeFile(env.NPM_CONFIG_USERCONFIG!, '', { mode: 0o600 });
  await writeFile(env.NPM_CONFIG_GLOBALCONFIG!, '', { mode: 0o600 });
  let child: ReturnType<typeof spawn> | undefined;
  const commands: Array<{ command: string; elapsedMs: number }> = [];
  /** Run the isolated npm command and measure its exit, output bounds and elapsed time. */
  const command = async (args: string[], timeout: number) => {
    const started = Date.now(),
      processChild = spawn('npm', args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let bytes = 0,
      output = '';
    const timer = setTimeout(() => processChild.kill('SIGKILL'), timeout);
    for (const stream of [processChild.stdout, processChild.stderr])
      stream!.on('data', (value: Buffer) => {
        bytes += value.length;
        if (bytes > 8388608) processChild.kill('SIGKILL');
        if (output.length < 65536) output += value.toString();
      });
    const code = await new Promise<number | null>((resolve, reject) => {
      processChild.once('error', reject);
      processChild.once('exit', resolve);
    });
    clearTimeout(timer);
    if (code !== 0)
      throw new Error(
        `CLEAN_SETUP_${args[0]}_FAILED:${output.replaceAll(bootstrap, '[REDACTED]').replaceAll(key, '[REDACTED]').slice(-1500)}`,
      );
    commands.push({ command: `npm ${args.join(' ')}`, elapsedMs: Date.now() - started });
  };
  try {
    for (const name of [
      'src',
      'scripts',
      'tests',
      'docker',
      'references',
      'docs',
      'web',
      'package.json',
      'tsconfig.json',
      'vitest.config.ts',
      '.env.example',
      '.nvmrc',
      '.gitignore',
      'README.md',
      'CONTRIBUTING.md',
    ])
      await cp(join(sourceRoot, name), join(root, name), {
        recursive: true,
        /** Exclude generated console assets and Python caches from the clean setup copy. */
        filter: path => !path.includes('/web/dist') && !path.includes('/__pycache__'),
      });
    // A fresh public-registry install has no source lockfile, user npmrc, cached
    // dependencies, registry credential or cloud service in its environment.
    await command(['install', '--workspaces=false'], 300000);
    await command(['run', 'setup'], 300000);
    await command(['run', 'build:console'], 60000);
    const launch = async () => {
      const started = Date.now();
      child = spawn(process.execPath, ['--import', 'tsx', 'scripts/lab.ts'], {
        cwd: root,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const exited = new Promise<number | null>(resolve => child!.once('exit', resolve));
      let buffered = '',
        total = 0,
        errors = '';
      const ready = await new Promise<{ url: string; targetId: string }>((resolveReady, reject) => {
        const timer = setTimeout(() => {
          child!.kill('SIGKILL');
          reject(new Error('CLEAN_LAB_START_TIMEOUT'));
        }, 300000);
        child!.stdout!.on('data', (value: Buffer) => {
          total += value.length;
          if (total > 8388608) {
            child!.kill('SIGKILL');
            return;
          }
          buffered += value.toString();
          const lines = buffered.split('\n');
          buffered = lines.pop() ?? '';
          for (const line of lines) {
            try {
              const parsed = z
                .object({ url: z.url(), targetId: z.string().uuid() })
                .passthrough()
                .safeParse(JSON.parse(line));
              if (parsed.success) {
                clearTimeout(timer);
                resolveReady(parsed.data);
              }
            } catch {}
          }
        });
        child!.stderr!.on('data', (value: Buffer) => {
          total += value.length;
          if (errors.length < 65536) errors += value.toString();
          if (total > 8388608) child!.kill('SIGKILL');
        });
        child!.once('exit', () => {
          clearTimeout(timer);
          reject(
            new Error(
              `CLEAN_LAB_EXITED:${errors.replaceAll(bootstrap, '[REDACTED]').replaceAll(key, '[REDACTED]').slice(-1500)}`,
            ),
          );
        });
        child!.once('error', reject);
      });
      commands.push({ command: 'npm run lab', elapsedMs: Date.now() - started });
      return { ready, exited };
    };
    let execution = await launch(),
      ready = execution.ready,
      exited = execution.exited;
    let cookie = '',
      csrf = '';
    const authenticate = async () => {
      const login = await fetch(`${ready.url}/api/session`, {
        method: 'POST',
        headers: { origin: ready.url, 'content-type': 'application/json' },
        body: JSON.stringify({ secret: bootstrap }),
      });
      expect(login.status).toBe(201);
      cookie = login.headers.get('set-cookie')!.split(';')[0]!;
      csrf = z
        .object({ csrfToken: z.string() })
        .passthrough()
        .parse(await login.json()).csrfToken;
    };
    await authenticate();
    /** Call the freshly installed local control plane using its real session and optional revision. */
    const request = async (
      path: string,
      body?: unknown,
      method = body === undefined ? 'GET' : 'POST',
      revision?: number,
    ) => {
      const result = await fetch(`${ready.url}${path}`, {
        method,
        headers: {
          origin: ready.url,
          cookie,
          'x-csrf-token': csrf,
          'content-type': 'application/json',
          ...(revision ? { 'if-match': `"${revision}"` } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: result.status, data: await result.json() };
    };
    const target = z
      .object({ revision: z.number(), policyRevision: z.number() })
      .passthrough()
      .parse((await request(`/api/targets/${ready.targetId}`)).data);
    const profiles = z
      .object({
        items: z.array(z.object({ id: z.string().uuid(), revision: z.number(), credentialRevision: z.number() })),
      })
      .passthrough()
      .parse((await request(`/api/targets/${ready.targetId}/profiles`)).data);
    const profile = profiles.items[0]!;
    const scan = await request(`/api/targets/${ready.targetId}/scans`, {
      targetRevision: target.revision,
      policyRevision: target.policyRevision,
      mode: 'http',
      idempotencyKey: randomBytes(16).toString('hex'),
      profiles: [
        {
          targetRevision: target.revision,
          policyRevision: target.policyRevision,
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        },
      ],
    });
    expect(scan.status).toBe(202);
    const scanId = z.object({ id: z.string().uuid() }).passthrough().parse(scan.data).id;
    let completed = false;
    for (let attempt = 0; attempt < 1800; attempt++) {
      const state = z
        .object({ state: z.string(), cleanup: z.string() })
        .passthrough()
        .parse((await request(`/api/scans/${scanId}`)).data);
      if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED', 'AUTH_REQUIRED'].includes(state.state)) {
        expect(state.state).toBe('COMPLETED');
        expect(state.cleanup).toBe('COMPLETE');
        completed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    expect(completed).toBe(true);
    const inventory = z
      .object({ items: z.array(z.unknown()) })
      .passthrough()
      .parse((await request(`/api/scans/${scanId}/inventory`)).data);
    expect(inventory.items.length).toBeGreaterThan(1);
    const receiptSchema = z
      .object({ fixtureId: z.string(), networkId: z.string(), token: z.string(), phase: z.string() })
      .passthrough();
    const oldReceipt = receiptSchema.parse(
      JSON.parse(await readFile(join(root, 'data/owned-lab-runtime.json'), 'utf8')),
    );
    const targetBody = targetSchema.parse(
      Object.fromEntries(Object.keys(targetSchema.shape).map(name => [name, target[name]])),
    );
    const updated = await request(
      `/api/targets/${ready.targetId}`,
      { ...targetBody, entryUrl: 'http://allowed.lab:18080/owned/stream' },
      'PUT',
      target.revision,
    );
    expect(updated.status).toBe(200);
    const current = z.object({ revision: z.number(), policyRevision: z.number() }).passthrough().parse(updated.data);
    const interrupted = await request(`/api/targets/${ready.targetId}/scans`, {
      targetRevision: current.revision,
      policyRevision: current.policyRevision,
      mode: 'http',
      idempotencyKey: randomBytes(16).toString('hex'),
      profiles: [
        {
          targetRevision: current.revision,
          policyRevision: current.policyRevision,
          profileId: profile.id,
          profileRevision: profile.revision,
          credentialRevision: profile.credentialRevision,
        },
      ],
    });
    expect(interrupted.status).toBe(202);
    const interruptedId = z.object({ id: z.string().uuid() }).passthrough().parse(interrupted.data).id;
    let inFlight = false;
    for (let attempt = 0; attempt < 200; attempt++) {
      const result = await control(client.getContainer(oldReceipt.fixtureId), [
        'python',
        '-c',
        'import urllib.request;print(urllib.request.urlopen("http://127.0.0.1:18090/stats",timeout=1).read().decode())',
      ]);
      if (result.success && Number(JSON.parse(result.stdout)['stream-contacts'] ?? 0) > 0) {
        inFlight = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    expect(inFlight).toBe(true);
    child!.kill('SIGKILL');
    await exited;
    child = undefined;
    expect(await operationStatus(configuration)).toMatchObject({
      state: 'DEBT',
      detail: 'OWNED_LAB_PROCESS_INTERRUPTED',
    });
    execution = await launch();
    ready = execution.ready;
    exited = execution.exited;
    await authenticate();
    await expect(client.getContainer(oldReceipt.fixtureId).inspect()).rejects.toMatchObject({ statusCode: 404 });
    await expect(client.getNetwork(oldReceipt.networkId).inspect()).rejects.toMatchObject({ statusCode: 404 });
    expect((await request(`/api/scans/${interruptedId}`)).data).toMatchObject({
      state: 'FAILED',
      reason: 'PROCESS_INTERRUPTED',
      cleanup: 'COMPLETE',
      budget: { exhausted: true, reason: 'unknown' },
    });
    const newReceipt = receiptSchema.parse(
      JSON.parse(await readFile(join(root, 'data/owned-lab-runtime.json'), 'utf8')),
    );
    expect(newReceipt.token).not.toBe(oldReceipt.token);
    expect(newReceipt.phase).toBe('RUNNING');
    const stopTimer = setTimeout(() => child!.kill('SIGKILL'), 15000);
    child!.kill('SIGTERM');
    const code = await exited;
    clearTimeout(stopTimer);
    expect(code).toBe(0);
    child = undefined;
    expect(
      await client.listContainers({ all: true, filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] } }),
    ).toEqual([]);
    expect(await client.listNetworks({ filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] } })).toEqual(
      [],
    );
    expect(
      await client.listImages({ all: true, filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] } }),
    ).toEqual([]);
    return {
      commands,
      ownedRootIdentity: { path: root, owner },
      inventoryCount: inventory.items.length,
      providerEnabled: false,
      advisoryScheduleEnabled: false,
      observedExternalProviderRequests: null,
    };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await new Promise<void>(resolve => child!.once('exit', () => resolve()));
    }
    // This root is freshly allocated for this proof. Cleanup only its exact
    // owner label and preserve images with any remaining consumer.
    for (const container of await client.listContainers({
      all: true,
      filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] },
    }))
      await client.getContainer(container.Id).remove({ force: true, v: true });
    for (const network of await client.listNetworks({
      filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] },
    }))
      await client.getNetwork(network.Id).remove();
    for (const image of await client.listImages({
      all: true,
      filters: { label: [`dev.mastra.security-scanner.owner=${owner}`] },
    })) {
      if (!(await client.listContainers({ all: true, filters: { ancestor: [image.Id] } })).length)
        await client.getImage(image.Id).remove({ force: false, noprune: true });
    }
    await rm(temporary, { recursive: true, force: true });
  }
}
