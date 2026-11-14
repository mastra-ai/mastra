import { createClient } from '@libsql/client';
import { drainWithInstanceHeld } from '../../src/runtime/operations.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Settings } from '../../src/config/settings.js';
import { setup } from '../../src/runtime/setup.js';
import { dockerClient, ownerIdentity, INPUT_LABEL, OWNER_LABEL } from '../../src/runtime/docker.js';
import { buildDiscoveryImages } from '../../src/discovery/images.js';
import { acquireInstance } from '../../src/discovery/instance.js';
import { control, readRuntimeFile, stageFiles } from '../../src/discovery/io.js';
import { ownedLabBoundary } from '../../src/discovery/lab.js';

const stateSchema = z
  .object({
    version: z.literal(1),
    pid: z.number().int().positive(),
    token: z.string().uuid(),
    owner: z.string().min(1).max(100),
    phase: z.enum(['PREPARING', 'RUNNING', 'DEBT']),
    networkId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    fixtureId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    images: z
      .array(
        z
          .object({
            id: z
              .string()
              .regex(/^sha256:[a-f0-9]{64}$/)
              .optional(),
            tag: z.string().regex(/^security-scanner\/(?:gateway|firewall):[a-z0-9-]+$/),
            hash: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .strict(),
      )
      .max(2),
  })
  .strict();
type State = z.infer<typeof stateSchema>;
const statePath = (settings: Settings) => join(settings.dataDirectory, 'owned-lab-runtime.json');
async function save(settings: Settings, state: State) {
  const path = statePath(settings),
    temporary = `${path}.${randomUUID()}`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(stateSchema.parse(state)));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}
/** Read the owned lab receipt after validating its private file boundary. */
async function previous(settings: Settings) {
  try {
    const path = statePath(settings),
      stat = await lstat(path);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.uid !== process.getuid?.() ||
      (stat.mode & 0o777) !== 0o600 ||
      stat.size > 8192
    )
      throw new Error('OWNED_LAB_RECEIPT_UNSAFE');
    return stateSchema.parse(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
/** Remove only the lab resources attributed to the validated runtime receipt. */
async function cleanup(settings: Settings, state: State) {
  const client = dockerClient(settings);
  if (state.owner !== ownerIdentity(settings)) throw new Error('OWNED_LAB_OWNER_CHANGED');
  let complete = true;
  try {
    const fixture = client.getContainer(state.fixtureId ?? `scanner-lab-${state.token}`),
      observed = await fixture.inspect();
    if (
      observed.Config.Labels?.[OWNER_LABEL] !== state.owner ||
      observed.Config.Labels?.['dev.mastra.security-scanner.lab'] !== state.token ||
      !state.images.some(image => image.id === observed.Image)
    )
      throw new Error('OWNED_LAB_FIXTURE_CHANGED');
    await fixture.remove({ force: true, v: true });
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) complete = false;
  }
  try {
    const network = client.getNetwork(state.networkId ?? `scanner-lab-${state.token}`),
      observed = await network.inspect();
    if (
      observed.Labels?.[OWNER_LABEL] !== state.owner ||
      observed.Labels?.['dev.mastra.security-scanner.lab'] !== state.token ||
      !observed.Internal
    )
      throw new Error('OWNED_LAB_NETWORK_CHANGED');
    await network.remove();
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode !== 404) complete = false;
  }
  for (const image of state.images)
    try {
      const observed = await client.getImage(image.id ?? image.tag).inspect();
      if (observed.Config.Labels?.[OWNER_LABEL] !== state.owner || observed.Config.Labels?.[INPUT_LABEL] !== image.hash)
        throw new Error('OWNED_LAB_IMAGE_CHANGED');
      if ((await client.listContainers({ all: true, filters: { ancestor: [observed.Id] } })).length) {
        complete = false;
        continue;
      }
      await client.getImage(observed.Id).remove({ force: false, noprune: true });
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode !== 404) complete = false;
    }
  if (complete) await rm(statePath(settings), { force: true });
  else {
    await save(settings, { ...state, phase: 'DEBT' });
    throw new Error('OWNED_LAB_CLEANUP_DEBT');
  }
}

// Local operation uses a real fixture and real application. No scripted model
// or finding response is connected; providers require the normal explicit opt-in.
/** Start or reconcile the isolated target fixture from its persisted ownership state. */
export async function startOwnedFixture(settings: Settings, signal?: AbortSignal) {
  signal?.throwIfAborted();
  await setup(settings, signal);
  const release = await acquireInstance(settings);
  let state: State | undefined;
  try {
    const old = await previous(settings);
    if (old) {
      let alive = true;
      try {
        process.kill(old.pid, 0);
      } catch (error) {
        alive = (error as NodeJS.ErrnoException).code !== 'ESRCH';
      }
      if (alive) throw new Error('OWNED_LAB_INSTANCE_ACTIVE');
      const db = createClient({ url: settings.databaseUrl });
      let canDrain = false;
      try {
        canDrain =
          (await db.execute("SELECT 1 FROM sqlite_master WHERE name='scanner_verification_jobs' AND type='table'")).rows
            .length > 0;
      } finally {
        db.close();
      }
      if (canDrain) await drainWithInstanceHeld(settings, 'PROCESS_INTERRUPTED');
      await cleanup(settings, old);
      if (canDrain) await drainWithInstanceHeld(settings, 'PROCESS_INTERRUPTED');
    }
    const client = dockerClient(settings),
      token = randomUUID();
    state = { version: 1, pid: process.pid, token, owner: ownerIdentity(settings), phase: 'PREPARING', images: [] };
    await save(settings, state);
    const current = state;
    const images = await buildDiscoveryImages(
      settings,
      signal,
      async (id, hash) => {
        const image = current.images.find(item => item.hash === hash);
        if (!image) throw new Error('OWNED_LAB_IMAGE_INTENT_MISSING');
        image.id = id;
        await save(settings, current);
      },
      async (tag, hash) => {
        current.images.push({ tag, hash });
        await save(settings, current);
      },
    );
    signal?.throwIfAborted();
    const labels = { 'dev.mastra.security-scanner.lab': token, [OWNER_LABEL]: current.owner };
    const network = await client.createNetwork({
      Name: `scanner-lab-${token}`,
      Internal: true,
      Driver: 'bridge',
      Labels: labels,
    });
    current.networkId = network.id;
    await save(settings, current);
    const fixture = await client.createContainer({
      name: `scanner-lab-${token}`,
      Image: images.gateway,
      Entrypoint: [],
      Cmd: ['python', '/workspace/server.py'],
      Labels: labels,
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
    current.fixtureId = fixture.id;
    await save(settings, current);
    const inspected = await network.inspect(),
      subnet = inspected.IPAM?.Config?.[0]?.Subnet;
    if (!subnet) throw new Error('OWNED_LAB_NETWORK_MISSING');
    const address = subnet.split('/')[0]!.split('.').slice(0, 3).concat('10').join('.');
    await network.disconnect({ Container: fixture.id });
    await network.connect({ Container: fixture.id, EndpointConfig: { IPAMConfig: { IPv4Address: address } } });
    const profiles = {
      public: { name: null, value: '' },
      viewer: { name: 'x-api-key', value: randomBytes(24).toString('hex') },
      member: { name: 'cookie', value: `session=${randomBytes(24).toString('hex')}` },
      admin: { name: 'authorization', value: `Bearer ${randomBytes(24).toString('hex')}` },
    };
    await stageFiles(
      fixture,
      {
        'server.py': { bytes: await readFile(join(settings.root, 'tests/lab/server.py')) },
        'profiles.json': { bytes: Buffer.from(JSON.stringify(profiles)) },
        'network.json': { bytes: Buffer.from(JSON.stringify({ allowedIp: address, deniedIp: '192.0.2.255' })) },
      },
      true,
    );
    signal?.throwIfAborted();
    await fixture.start();
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      signal?.throwIfAborted();
      const result = await control(
        fixture,
        [
          'python',
          '-c',
          'import urllib.request;print(urllib.request.urlopen("http://127.0.0.1:18090/stats",timeout=1).status)',
        ],
        2000,
      ).catch(() => null);
      if (result?.success) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error('OWNED_LAB_NOT_READY');
    const boundary = await ownedLabBoundary(
      client,
      fixture.id,
      network.id,
      token,
      await readRuntimeFile(fixture, '/workspace/lab-root.pem'),
    );
    current.phase = 'RUNNING';
    await save(settings, current);
    images.certutil.fill(0);
    return { boundary, token, close: () => cleanup(settings, current) };
  } catch (error) {
    if (state) await cleanup(settings, state);
    throw error;
  } finally {
    await release();
  }
}
