import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { diagnostic, loadSettings, RuntimeDiagnostic } from '../src/config/settings.js';
import { startControlPlane } from '../src/http/server.js';
import { startOwnedFixture } from '../tests/lab/runtime.js';

let fixture: Awaited<ReturnType<typeof startOwnedFixture>> | undefined;
let server: Awaited<ReturnType<typeof startControlPlane>> | undefined;
let closing: Promise<void> | undefined;
const close = () =>
  (closing ??= (async () => {
    const results = await Promise.allSettled([server?.close()]);
    results.push(...(await Promise.allSettled([fixture?.close()])));
    if (results.some(item => item.status === 'rejected')) {
      console.error(JSON.stringify({ code: 'OWNED_LAB_CLEANUP_DEBT' }));
      process.exitCode = 1;
    }
  })());
const stopController = new AbortController();
let ready = false,
  stopping = false;
/** Abort lab startup and begin cleanup when the owned runtime is ready. */
const stop = () => {
  stopping = true;
  stopController.abort();
  if (ready) void close();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const settings = loadSettings({ ...process.env, DATABASE_URL: 'file:./data/owned-lab.db' });
  if (!settings.CONTROL_BOOTSTRAP_SECRET)
    throw new RuntimeDiagnostic('LAB_SESSION_REQUIRED', 'Set CONTROL_BOOTSTRAP_SECRET before starting the owned lab.');
  fixture = await startOwnedFixture(settings, stopController.signal);
  stopController.signal.throwIfAborted();
  server = await startControlPlane(settings, settings.PORT, undefined, fixture.boundary);
  stopController.signal.throwIfAborted();
  ready = true;
  const response = await fetch(`${server.url}/api/session`, {
    method: 'POST',
    headers: { origin: server.url, 'content-type': 'application/json' },
    body: JSON.stringify({ secret: settings.CONTROL_BOOTSTRAP_SECRET }),
  });
  if (response.status !== 201) throw new Error('LAB_SESSION_FAILED');
  const cookie = response.headers.get('set-cookie')?.split(';')[0],
    csrf = z
      .object({ csrfToken: z.string() })
      .passthrough()
      .parse(await response.json()).csrfToken;
  if (!cookie) throw new Error('LAB_COOKIE_MISSING');
  const idSchema = z.object({ id: z.string().uuid(), revision: z.number().int().positive() }).passthrough();
  /** Create a lab control-plane record with the current session and optional revision binding. */
  const create = async (path: string, body: unknown, revision?: number) => {
    const result = await fetch(`${server!.url}${path}`, {
      method: 'POST',
      headers: {
        origin: server!.url,
        cookie,
        'x-csrf-token': csrf,
        'content-type': 'application/json',
        ...(revision ? { 'if-match': `"${revision}"` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (result.status !== 201) throw new Error('LAB_PROVISION_FAILED');
    return idSchema.parse(await result.json());
  };
  const limits = { maxRequests: 100, maxDurationSeconds: 120, maxResponseBytes: 524288, maxConcurrency: 2 };
  const policy = await create('/api/policies', {
    name: `Owned lab ${randomUUID().slice(0, 8)}`,
    permittedMethods: ['GET', 'HEAD'],
    scanLimits: limits,
  });
  const target = await create('/api/targets', {
    name: `Owned lab ${fixture.token.slice(0, 8)}`,
    entryUrl: 'http://allowed.lab:18080/owned/catalog',
    approvedOrigins: ['http://allowed.lab:18080'],
    allowedPaths: ['/owned'],
    excludedPaths: [],
    permittedMethods: ['GET', 'HEAD'],
    environment: 'lab',
    authorizationEvidenceRef: 'operator:owned-local-lab',
    authorizationConfirmed: true,
    policyId: policy.id,
    policyRevision: policy.revision,
    schedule: { enabled: false, timezone: 'UTC' },
    scanLimits: limits,
    authProfileIds: [],
  });
  await create(
    `/api/targets/${target.id}/profiles`,
    { kind: 'public', role: 'public', name: 'Public lab inventory' },
    target.revision,
  );
  console.log(
    JSON.stringify({
      url: server.url,
      targetId: target.id,
      database: 'data/owned-lab.db',
      discoveryRequested: settings.SCANNER_DISCOVERY_ENABLED,
      investigationRequested: settings.SCANNER_INVESTIGATION_ENABLED,
      defaultExperience: 'public discovery; no scripted findings or model responses',
    }),
  );
} catch (error) {
  if (!stopping) {
    const code = error instanceof Error && /^(?:OWNED_)?LAB_[A-Z_]+$/.test(error.message) ? error.message : null;
    console.error(JSON.stringify(code ? { code } : diagnostic(error)));
    process.exitCode = 1;
  }
  await close();
}
