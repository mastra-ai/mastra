import { createClient } from '@libsql/client';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import { AdvisoryStore } from '../src/advisory/store.js';
import { AdvisorySource } from '../src/advisory/source.js';
import type { AdvisoryModels } from '../src/advisory/triage.js';
import { detailSchema, materialHash, versionApplicability } from '../src/advisory/contracts.js';
import { startControlPlane } from '../src/http/server.js';
import { ReferenceCatalog } from '../src/knowledge/catalog.js';
import { PlaybookRegistry, categories, type Category } from '../src/knowledge/playbooks.js';
import { periodicAdvisoryLifecycle } from './lab/advisory-schedule.js';

const bootstrap = 'owned_local_intelligence_fixture_bootstrap_secret';
const key = 'ab'.repeat(32);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

type Detail = {
  id: string;
  aliases: string[];
  status: 'published' | 'withdrawn' | 'rejected' | 'provisional';
  title: string;
  originalDescription: string;
  affected: { vendor: string; product: string; ranges: unknown[]; versions?: string[] }[];
  sources: { name: string; url: string; license: string }[];
  modifiedAt: string;
  summary?: { text: string; model: string; promptVersion: string };
  severity?: string;
  exposure?: 'Actively exploited' | 'Default setups' | 'Specific setups only' | 'Unclear' | null;
  publishedAt?: string | null;
  context?: Record<string, unknown> | null;
};
function detail(id: string, description = 'Owned fixture vulnerability', aliases: string[] = []): Detail {
  return {
    id,
    aliases,
    status: 'published',
    title: `Local advisory ${id}`,
    originalDescription: description,
    affected: [{ vendor: 'Owned', product: 'Portal', ranges: [{ unsupported: 'range semantics' }] }],
    sources: [{ name: 'Owned fixture', url: 'https://example.invalid/advisory', license: 'fixture' }],
    modifiedAt: '2026-10-29T12:00:00.000Z',
  };
}
type Wire = {
  status?: number;
  body?: unknown;
  contentType?: string;
  location?: string;
  truncatedBody?: boolean;
  beforeSend?: () => Promise<void>;
};
/** Serve controlled advisory pages and details over real loopback HTTP while recording requests. */
async function startAdvisoryFixture() {
  const pages = new Map<string, Wire>();
  const details = new Map<string, Wire>();
  const requests: string[] = [];
  const statusWire: Wire = { body: { polling: {}, history: {}, backfill: {}, storage: {} } };
  let callbackCount = 0;
  const server = createServer(async (request, response) => {
    const path = request.url ?? '/';
    requests.push(path);
    if (path === '/owned-callback') {
      callbackCount++;
      response.writeHead(204).end();
      return;
    }
    const selected =
      path === '/api/v1/status'
        ? statusWire
        : path.startsWith('/api/v1/entries/')
          ? details.get(decodeURIComponent(path.slice('/api/v1/entries/'.length)))
          : path.startsWith('/public/entries/')
            ? details.get(path)
            : pages.get(path);
    if (!selected) {
      response.writeHead(404).end();
      return;
    }
    await selected.beforeSend?.();
    if (selected.truncatedBody) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.write('{"partial":');
      setImmediate(() => response.destroy());
      return;
    }
    response.writeHead(selected.status ?? 200, {
      'content-type': selected.contentType ?? 'application/json',
      ...(selected.location ? { location: selected.location } : {}),
    });
    response.end(JSON.stringify(selected.body ?? {}));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('FIXTURE_ADDRESS_MISSING');
  const url = `http://127.0.0.1:${address.port}`;
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  );
  return {
    url,
    pages,
    details,
    requests,
    statusWire,
    callbackCount: () => callbackCount,
    /** Register the local advisory page response for the selected cursor and next-page token. */
    page(cursor: string | null, ids: string[], nextCursor: string | null) {
      pages.set(`/api/v1/entries${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, {
        body: { entries: ids.map(id => ({ id })), nextCursor },
      });
    },
    setDetail(value: Detail) {
      details.set(value.id, { body: value });
    },
  };
}

/** Wait until the persisted advisory backoff permits the next real synchronization attempt. */
async function waitForAdvisoryRetry(app: Awaited<ReturnType<typeof startHarness>>) {
  const status = await app.request<{ nextRetryAt?: string | null }>('/api/advisories/status');
  const nextRetryAt = status.body.nextRetryAt;
  if (!nextRetryAt) return;
  const delay = Math.max(0, Date.parse(nextRetryAt) - Date.now() + 25);
  expect(Number.isFinite(delay)).toBe(true);
  expect(delay).toBeLessThanOrEqual(15_000);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function startHarness(
  fixture: Awaited<ReturnType<typeof startAdvisoryFixture>>,
  advisoryModels?: AdvisoryModels,
) {
  const root = await mkdtemp(join(tmpdir(), 'scanner-intelligence-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const settings = loadSettings({ CONTROL_BOOTSTRAP_SECRET: bootstrap, SCANNER_ENCRYPTION_KEY: key }, root);
  const source = new AdvisorySource(fixture.url, true);
  let running = await startControlPlane(
    settings,
    0,
    undefined,
    undefined,
    source,
    undefined,
    undefined,
    undefined,
    undefined,
    advisoryModels,
  );
  let active = true;
  cleanup.push(async () => {
    if (active) await running.close();
  });
  let cookie = '';
  let csrf = '';
  async function login() {
    const response = await fetch(`${running.url}/api/session`, {
      method: 'POST',
      headers: { origin: running.url, 'content-type': 'application/json' },
      body: JSON.stringify({ secret: bootstrap }),
    });
    expect(response.status).toBe(201);
    cookie = response.headers.get('set-cookie')!.split(';')[0]!;
    csrf = ((await response.json()) as { csrfToken: string }).csrfToken;
  }
  await login();
  /** Send a real authenticated advisory HTTP request with optional optimistic revision binding. */
  async function request<T = any>(path: string, method = 'GET', body?: unknown, expectedRecordRevision?: number) {
    const response = await fetch(`${running.url}${path}`, {
      method,
      headers: {
        origin: running.url,
        cookie,
        'x-csrf-token': csrf,
        'content-type': 'application/json',
        ...(expectedRecordRevision ? { 'if-match': `"${expectedRecordRevision}"` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, etag: response.headers.get('etag'), body: (await response.json()) as T };
  }
  return {
    root,
    settings,
    request,
    async withoutCsrf(path: string) {
      return fetch(`${running.url}${path}`, {
        method: 'POST',
        headers: { origin: running.url, cookie, 'content-type': 'application/json' },
        body: '{}',
      });
    },
    url: () => running.url,
    async close() {
      await running.close();
      active = false;
    },
    async restart() {
      await running.close();
      active = false;
      running = await startControlPlane(
        settings,
        0,
        undefined,
        undefined,
        source,
        undefined,
        undefined,
        undefined,
        undefined,
        advisoryModels,
      );
      active = true;
      await login();
    },
    async query(sql: string) {
      const db = createClient({ url: settings.databaseUrl });
      try {
        return (await db.execute(sql)).rows;
      } finally {
        db.close();
      }
    },
  };
}

const observations: Record<Category, { vulnerable: unknown; patched: unknown }> = {
  idor: {
    vulnerable: {
      category: 'idor',
      ownerStatus: 200,
      alternateStatus: 200,
      ownerIdentity: 'owner',
      alternateIdentity: 'other',
      resourceOwned: true,
      ownerMarker: 'owned-row-123',
      alternateMarker: 'owned-row-123',
    },
    patched: {
      category: 'idor',
      ownerStatus: 200,
      alternateStatus: 403,
      ownerIdentity: 'owner',
      alternateIdentity: 'other',
      resourceOwned: true,
      ownerMarker: 'owned-row-123',
      alternateMarker: null,
    },
  },
  authentication_bypass: {
    vulnerable: {
      category: 'authentication_bypass',
      protectedStatus: 200,
      publicStatus: 200,
      invalidSessionStatus: 403,
      protectedMarker: 'private-row-123',
      publicMarker: 'private-row-123',
      invalidSessionMarker: null,
    },
    patched: {
      category: 'authentication_bypass',
      protectedStatus: 200,
      publicStatus: 401,
      invalidSessionStatus: 403,
      protectedMarker: 'private-row-123',
      publicMarker: null,
      invalidSessionMarker: null,
    },
  },
  bfla: {
    vulnerable: {
      category: 'bfla',
      adminStatus: 200,
      lowStatus: 200,
      rolesDistinct: true,
      readOnly: true,
      adminMarker: 'admin-row-123',
      lowMarker: 'admin-row-123',
    },
    patched: {
      category: 'bfla',
      adminStatus: 200,
      lowStatus: 403,
      rolesDistinct: true,
      readOnly: true,
      adminMarker: 'admin-row-123',
      lowMarker: null,
    },
  },
  ssrf: {
    vulnerable: {
      category: 'ssrf',
      environment: 'lab',
      approvalId: '123e4567-e89b-42d3-a456-426614174000',
      approvalCurrent: true,
      ownedCallback: true,
      callbackObserved: true,
    },
    patched: {
      category: 'ssrf',
      environment: 'lab',
      approvalId: '123e4567-e89b-42d3-a456-426614174000',
      approvalCurrent: true,
      ownedCallback: true,
      callbackObserved: false,
    },
  },
  misconfiguration: {
    vulnerable: {
      category: 'misconfiguration',
      headerName: 'x-frame-options',
      expectedValue: 'DENY',
      observedValue: null,
    },
    patched: {
      category: 'misconfiguration',
      headerName: 'x-frame-options',
      expectedValue: 'DENY',
      observedValue: 'DENY',
    },
  },
  cors: {
    vulnerable: { category: 'cors', browserCrossOrigin: true, sensitiveFixture: true, responseReadable: true },
    patched: { category: 'cors', browserCrossOrigin: true, sensitiveFixture: true, responseReadable: false },
  },
  open_redirect: {
    vulnerable: {
      category: 'open_redirect',
      approvedOrigin: 'http://127.0.0.1:3000',
      submittedDestination: 'http://127.0.0.1:3001/owned',
      location: 'http://127.0.0.1:3001/owned',
      followed: false,
    },
    patched: {
      category: 'open_redirect',
      approvedOrigin: 'http://127.0.0.1:3000',
      submittedDestination: 'http://127.0.0.1:3001/owned',
      location: 'http://127.0.0.1:3000/safe',
      followed: false,
    },
  },
  information_exposure: {
    vulnerable: {
      category: 'information_exposure',
      marker: 'LAB_MARKER_12345678',
      observedMarker: 'LAB_MARKER_12345678',
      publicResponse: true,
    },
    patched: {
      category: 'information_exposure',
      marker: 'LAB_MARKER_12345678',
      observedMarker: null,
      publicResponse: true,
    },
  },
};
const scope = {
  surfacePresent: true,
  prerequisitesReady: true,
  scopeApproved: true,
  completed: true,
  identityValid: true,
};

describe('F4 offline intelligence through protected HTTP and file libSQL', () => {
  it('hashes mixed-case and non-ASCII material keys in locale-independent order', () => {
    const original = detailSchema.parse({ ...detail('CVE-2026-24001'), severity: { é: 4, a: 3, Z: 2, A: 1 } });
    const reordered = detailSchema.parse({ ...original, severity: { A: 1, Z: 2, a: 3, é: 4 } });
    const expected = '17872f99e858b94127dd6c219187154141cc4f6a37d19c2214ed6f8d49d7b64e';
    expect(materialHash(original)).toBe(expected);
    expect(materialHash(reordered)).toBe(expected);
  });

  it('preserves persisted legacy material revisions and ETags while normalizing hash ordering', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = { ...detail('CVE-2026-24001'), severity: { é: 4, a: 3, Z: 2, A: 1 } };
    fixture.details.set(entry.id, { body: entry });
    fixture.page(null, [entry.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    expect((await app.request(`/api/advisories/${entry.id}/triage`, 'PUT', { status: 'triaged' }, 1)).status).toBe(200);
    // Persist the actual pre-correction localeCompare hash to model an existing installation.
    await app.query(
      "UPDATE scanner_advisories SET material_hash='1e9ee643462dd7ad5cfbfc77c526f31379a79ce71d4ffbc8bfe8eba9b6ba1615'",
    );
    const sources = await app.query('SELECT * FROM scanner_advisory_reassessment_sources ORDER BY id,revision');
    await app.restart();
    fixture.details.set(entry.id, { body: { ...entry, severity: { A: 1, Z: 2, a: 3, é: 4 } } });
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    expect(await app.request(`/api/advisories/${entry.id}`)).toMatchObject({
      etag: '"2"',
      body: { revision: 1, recordRevision: 2, triageStatus: 'triaged' },
    });
    expect((await app.request(`/api/advisories/${entry.id}/events`)).body.items).toEqual([]);
    expect(await app.query('SELECT * FROM scanner_advisory_reassessment_sources ORDER BY id,revision')).toEqual(
      sources,
    );
    expect(await app.query('SELECT material_hash FROM scanner_advisories')).toEqual([
      { material_hash: '17872f99e858b94127dd6c219187154141cc4f6a37d19c2214ed6f8d49d7b64e' },
    ]);
    fixture.details.set(entry.id, { body: { ...entry, severity: { A: 1, Z: 2, a: 3, é: 5 } } });
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    expect(await app.request(`/api/advisories/${entry.id}`)).toMatchObject({
      etag: '"3"',
      body: { revision: 2, recordRevision: 3, triageStatus: 'triaged' },
    });
    expect((await app.request(`/api/advisories/${entry.id}/events`)).body.items).toMatchObject([{ revision: 2 }]);
    expect(await app.query('SELECT revision FROM scanner_advisory_reassessment_sources ORDER BY revision')).toEqual([
      { revision: 1 },
      { revision: 2 },
    ]);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    expect((await app.request(`/api/advisories/${entry.id}`)).etag).toBe('"3"');
  }, 60000);

  it('accepts alias triage using its GET ETag and still rejects stale writes', async () => {
    const fixture = await startAdvisoryFixture();
    const alias = 'GHSA-AAAA-BBBB-CCCC';
    const entry = detail('CVE-2026-24002', undefined, [alias]);
    fixture.setDetail(entry);
    fixture.page(null, [entry.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    const read = await app.request(`/api/advisories/${alias}`);
    expect(read.etag).toBe('"1"');
    expect(
      await app.request(
        `/api/advisories/${alias}/triage`,
        'PUT',
        { status: 'triaged' },
        Number(read.etag!.slice(1, -1)),
      ),
    ).toMatchObject({ status: 200, etag: '"2"', body: { id: entry.id, triageStatus: 'triaged' } });
    expect(await app.request(`/api/advisories/${entry.id}`)).toMatchObject({
      etag: '"2"',
      body: { triageStatus: 'triaged' },
    });
    expect(await app.request(`/api/advisories/${alias}/triage`, 'PUT', { status: 'closed' }, 1)).toMatchObject({
      status: 409,
      body: { code: 'REVISION_CONFLICT' },
    });
    expect((await app.request(`/api/advisories/${entry.id}`)).body.triageStatus).toBe('triaged');
  }, 60000);

  it('returns the same nonempty revision events through an advisory alias', async () => {
    const fixture = await startAdvisoryFixture();
    const alias = 'GHSA-AAAA-BBBB-CCCC';
    const entry = detail('CVE-2026-24003', undefined, [alias]);
    fixture.setDetail(entry);
    fixture.page(null, [entry.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    fixture.setDetail({ ...entry, originalDescription: 'Changed advisory evidence' });
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    const canonical = await app.request(`/api/advisories/${entry.id}/events`);
    expect(canonical.body.items).toMatchObject([{ revision: 2 }]);
    expect(await app.request(`/api/advisories/${alias}/events`)).toEqual(canonical);
  }, 60000);

  it('retains distinct quarantine diagnostics across repeated failures, concurrent writes and restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scanner-quarantine-'));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const url = `file:${join(root, 'advisories.db')}`;
    let store = new AdvisoryStore(url);
    cleanup.push(async () => {
      store.close();
    });
    await store.initialize();
    await store.quarantineItem('CVE-2026-26000', 'ADVISORY_SCHEMA_UNKNOWN');
    await store.quarantineItem('CVE-2026-26001', 'ADVISORY_DETAIL_PRIMARY_404');
    const original = await store.quarantine(200, 0);
    await store.close();
    store = new AdvisoryStore(url);
    await store.initialize();
    await Promise.all(
      Array.from({ length: 205 }, (_, index) =>
        index % 2
          ? store.markFailure('ADVISORY_DETAIL_PRIMARY_404', 'cve-2026-26001')
          : store.quarantineItem('cve-2026-26001', 'ADVISORY_DETAIL_PRIMARY_404'),
      ),
    );
    expect(await store.quarantine(200, 0)).toEqual(original);
    await store.quarantineItem('CVE-2026-26001', 'ADVISORY_SCHEMA_UNKNOWN');
    await store.quarantineItem('CVE-2026-26002', 'ADVISORY_DETAIL_PRIMARY_404');
    expect(await store.quarantine(200, 0)).toHaveLength(4);
    for (let index = 0; index < 201; index++)
      await store.quarantineItem(`CVE-2026-${27000 + index}`, 'ADVISORY_SCHEMA_UNKNOWN');
    const bounded = await store.quarantine(250, 0);
    expect(bounded).toHaveLength(200);
    expect(bounded[0]?.sourceId).toBe('CVE-2026-27200');
    expect(bounded.at(-1)?.sourceId).toBe('CVE-2026-27001');
    expect(new Set(bounded.map(item => `${item.sourceId}:${item.reason}`)).size).toBe(200);
    await store.close();
    store = new AdvisoryStore(url);
    await store.initialize();
    expect(await store.quarantine(250, 0)).toEqual(bounded);
  }, 30000);

  it.each([
    { status: 404, code: 'ADVISORY_DETAIL_PRIMARY_404' },
    { status: 200, body: {}, code: 'ADVISORY_SCHEMA_UNKNOWN' },
  ])(
    'rotates failed refreshes without starving later advisories: $code',
    async failure => {
      const fixture = await startAdvisoryFixture();
      const entries = [24060, 24061, 24062, 24063].map(number => detail(`CVE-2026-${number}`));
      entries.forEach(entry => fixture.setDetail(entry));
      fixture.page(
        null,
        entries.map(entry => entry.id),
        null,
      );
      const app = await startHarness(fixture);
      expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
      const queued = await app.query('SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position');
      const failedId = String(queued[0]!.advisory_id),
        healthyId = String(queued[1]!.advisory_id);
      const previous = await app.request(`/api/advisories/${failedId}`);
      fixture.page(null, [], null);
      fixture.details.set(failedId, failure);
      expect(await app.request('/api/advisories/sync', 'POST', {})).toMatchObject({
        status: 200,
        body: { outcome: 'SKIPPED', phase: 'refresh', reasonCode: failure.code },
      });
      expect(
        (await app.query('SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position')).map(
          row => row.advisory_id,
        ),
      ).toEqual([...queued.slice(1).map(row => row.advisory_id), failedId]);
      expect(await app.request(`/api/advisories/${failedId}`)).toEqual(previous);
      await app.restart();
      await waitForAdvisoryRetry(app);
      fixture.setDetail(detail(healthyId, 'Healthy update after failed refresh'));
      expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
      expect((await app.request(`/api/advisories/${healthyId}`)).body.revision).toBe(2);
      expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCount: 0 });
    },
    60000,
  );

  it('skips and quarantines changed canonical refreshes without starving healthy queued entries', async () => {
    const fixture = await startAdvisoryFixture();
    const entries = [24010, 24011, 24012, 24013].map(number => detail(`CVE-2026-${number}`));
    entries.forEach(entry => fixture.setDetail(entry));
    fixture.page(
      null,
      entries.map(entry => entry.id),
      null,
    );
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    // Seed order is rotated by the successful refresh phase; the oldest queued record changes identity upstream.
    const queued = await app.query('SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position');
    const oldId = String(queued[0]!.advisory_id);
    const healthyId = String(queued[1]!.advisory_id);
    expect((await app.request(`/api/advisories/${oldId}/triage`, 'PUT', { status: 'closed' }, 1)).status).toBe(200);
    const previous = await app.request(`/api/advisories/${oldId}`);
    const aliases = await app.query('SELECT * FROM scanner_advisory_aliases ORDER BY alias');
    const cursors = await app.query('SELECT head_cursor,rotation_cursor FROM scanner_advisory_checkpoint');
    const replacement = detail('CVE-2026-24999', 'Changed upstream canonical identity', [oldId]);
    fixture.details.set(oldId, { body: replacement });
    fixture.page(null, [], null);
    const skipped = await app.request('/api/advisories/sync', 'POST', {});
    expect(skipped).toMatchObject({
      status: 200,
      body: {
        outcome: 'SKIPPED',
        phase: 'refresh',
        reasonCode: 'ADVISORY_CANONICAL_CHANGED',
        checkpoint: { stale: true, incomplete: true, failureCount: 1 },
      },
    });
    expect(skipped.body).not.toHaveProperty('hypotheses');
    expect(await app.request(`/api/advisories/${oldId}`)).toEqual(previous);
    expect((await app.request(`/api/advisories/${replacement.id}`)).status).toBe(404);
    expect(await app.query('SELECT * FROM scanner_advisory_aliases ORDER BY alias')).toEqual(aliases);
    expect(await app.query('SELECT head_cursor,rotation_cursor FROM scanner_advisory_checkpoint')).toEqual(cursors);
    expect((await app.request('/api/advisories/quarantine')).body.items).toMatchObject([
      { sourceId: oldId, reason: 'ADVISORY_CANONICAL_CHANGED' },
    ]);
    expect(
      (await app.query('SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position')).map(
        row => row.advisory_id,
      ),
    ).toEqual([...queued.slice(1).map(row => row.advisory_id), oldId]);
    const count = fixture.requests.length;
    expect(await app.request('/api/advisories/sync', 'POST', {})).toMatchObject({
      status: 503,
      body: { code: 'ADVISORY_RETRY_NOT_DUE' },
    });
    expect(fixture.requests).toHaveLength(count);
    await app.restart();
    await waitForAdvisoryRetry(app);
    fixture.setDetail(detail(healthyId, 'Healthy refreshed evidence'));
    const recovered = await app.request('/api/advisories/sync', 'POST', {});
    expect(recovered.body.outcome).toBe('COMPLETED');
    expect((await app.request(`/api/advisories/${healthyId}`)).body).toMatchObject({ revision: 2 });
    expect(await app.request(`/api/advisories/${oldId}`)).toEqual(previous);
    expect((await app.request('/api/advisories')).body.items).toHaveLength(4);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCount: 0 });
  }, 60000);

  it('skips a missing queued refresh as quarantined upstream inconsistency without fabricating an entry', async () => {
    const fixture = await startAdvisoryFixture();
    const entries = [24030, 24031, 24032].map(number => detail(`CVE-2026-${number}`));
    entries.forEach(entry => fixture.setDetail(entry));
    fixture.page(
      null,
      entries.map(entry => entry.id),
      null,
    );
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    const queued = await app.query('SELECT advisory_id FROM scanner_advisory_refresh_queue ORDER BY position');
    const missingId = String(queued[0]!.advisory_id);
    const before = await app.request(`/api/advisories/${missingId}`);
    fixture.page(null, [], null);
    const wire: Wire = {
      body: detail(missingId, 'Must not replace the persisted advisory'),
      async beforeSend() {
        wire.beforeSend = undefined;
        await app.query(`DELETE FROM scanner_advisory_refresh_queue WHERE advisory_id='${missingId}'`);
      },
    };
    // The real HTTP response is held until the selected queue row disappears, avoiding a timing race.
    fixture.details.set(missingId, wire);
    expect(await app.request('/api/advisories/sync', 'POST', {})).toMatchObject({
      status: 200,
      body: {
        outcome: 'SKIPPED',
        reasonCode: 'ADVISORY_REFRESH_QUEUE_INVALID',
        phase: 'refresh',
        checkpoint: { stale: true, failureCount: 1 },
      },
    });
    expect(await app.request(`/api/advisories/${missingId}`)).toEqual(before);
    expect(await app.query(`SELECT * FROM scanner_advisory_refresh_queue WHERE advisory_id='${missingId}'`)).toEqual(
      [],
    );
    expect((await app.request('/api/advisories/quarantine')).body.items).toMatchObject([
      { sourceId: missingId, reason: 'ADVISORY_REFRESH_QUEUE_INVALID' },
    ]);
    expect(await app.request('/api/advisories/sync', 'POST', {})).toMatchObject({
      status: 503,
      body: { code: 'ADVISORY_RETRY_NOT_DUE' },
    });
    await waitForAdvisoryRetry(app);
    const healthyId = String(queued[1]!.advisory_id);
    fixture.setDetail(detail(healthyId, 'Healthy queued update'));
    expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
    expect((await app.request(`/api/advisories/${healthyId}`)).body.revision).toBe(2);
    expect((await app.request(`/api/advisories/${missingId}`)).body.revision).toBe(1);
    expect((await app.request('/api/advisories')).body.items).toHaveLength(3);
  }, 60000);

  it('rejects invalid refresh lengths and missing queue entries without creating or merging records', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scanner-refresh-invariant-'));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    const url = `file:${join(root, 'advisories.db')}`;
    const store = new AdvisoryStore(url);
    cleanup.push(async () => store.close());
    await store.initialize();
    const entry = detailSchema.parse(detail('CVE-2026-24020'));
    await store.importPage('head', [entry], 'old-cursor');
    const before = await store.get(entry.id);
    for (const details of [[], [entry, entry]]) {
      await expect(store.importPage('rotation', details, 'uncommitted', entry.id)).rejects.toMatchObject({
        code: 'ADVISORY_REFRESH_QUEUE_INVALID',
      });
      expect(await store.knownIdsForRefresh(10)).toEqual([entry.id]);
    }
    await store.importPage('rotation', [], 'saved-rotation-cursor');
    await expect(
      store.importPage(
        'rotation',
        [detailSchema.parse(detail('CVE-2026-24998', undefined, [entry.id]))],
        'uncommitted',
        entry.id,
      ),
    ).rejects.toMatchObject({ code: 'ADVISORY_CANONICAL_CHANGED' });
    expect(await store.get(entry.id)).toEqual(before);
    expect(await store.resolveAlias('CVE-2026-24998')).toBeNull();
    expect((await store.checkpoint()).rotationCursor).toBe('saved-rotation-cursor');
    const db = createClient({ url });
    try {
      await db.execute('DELETE FROM scanner_advisory_refresh_queue');
    } finally {
      db.close();
    }
    for (const refreshed of [entry, detailSchema.parse(detail('CVE-2026-24998', undefined, [entry.id]))]) {
      await expect(store.importPage('rotation', [refreshed], 'uncommitted', entry.id)).rejects.toMatchObject({
        code: 'ADVISORY_REFRESH_QUEUE_INVALID',
      });
      expect(await store.knownIdsForRefresh(10)).toEqual([]);
      expect(await store.list(10, 0)).toEqual([before]);
      expect((await store.checkpoint()).rotationCursor).toBe('saved-rotation-cursor');
    }
  });

  it('accepts only pinned single-hop GHSA and CVE detail redirects with matching identity', async () => {
    const cdn = 'f9gkulwameaj0boi.public.blob.vercel-storage.com';
    const ghsa = 'GHSA-2345-CFGH-JMPQ';
    const cve = 'CVE-2026-12345';
    const location = (id: string) => `https://${cdn}/public/entries/${id}.json`;
    const redirect = (target: string) => new Response(null, { status: 302, headers: { location: target } });
    const body = (value: Detail) =>
      new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    /** Exercise advisory detail fallback against the supplied response sequence and expected error code. */
    const run = async (requested: string, responses: Response[], code?: string) => {
      let requests = 0;
      const source = new AdvisorySource(undefined, false, async (_url, options) => {
        expect(options?.redirect).toBe('manual');
        requests++;
        const response = responses.shift();
        if (!response) throw new Error('UNEXPECTED_EXTRA_REQUEST');
        return response;
      });
      if (code) await expect(source.detail(requested)).rejects.toMatchObject({ code });
      else expect((await source.detail(requested)).id).toMatch(/^(?:GHSA|CVE)-/);
      return requests;
    };

    expect(await run(ghsa, [redirect(location(ghsa)), body(detail(ghsa))])).toBe(2);
    expect(await run(ghsa, [redirect(location(ghsa)), body(detail(cve, undefined, [ghsa]))])).toBe(2);
    expect(await run(cve, [redirect(location(cve)), body(detail(cve))])).toBe(2);
    for (const denied of [
      `https://other.example/public/entries/${ghsa}.json`,
      `${location(ghsa)}?query=1`,
      `https://${cdn}:8443/public/entries/${ghsa}.json`,
      `http://${cdn}/public/entries/${ghsa}.json`,
      `https://user@${cdn}/public/entries/${ghsa}.json`,
      `${location(ghsa)}#fragment`,
      `https://${cdn}/public/entries/../entries/${ghsa}.json`,
      `https://${cdn}/public/entries/%2e%2e/entries/${ghsa}.json`,
      `https://${cdn}/public/entries/GHSA-AAA-BBBB-CCCC.json`,
      `https://${cdn}/public/entries/GHSA-AAAA-CFGH-JMPQ.json`,
    ])
      expect(await run(ghsa, [redirect(denied)], 'ADVISORY_REDIRECT_DENIED')).toBe(1);
    expect(await run(ghsa, [redirect(location(ghsa)), redirect(location(ghsa))], 'ADVISORY_REDIRECT_DENIED')).toBe(2);
    expect(await run(ghsa, [redirect(location(ghsa)), body(detail(cve))], 'ADVISORY_ALIAS_MISMATCH')).toBe(2);
  });

  it('classifies bounded primary and CDN detail HTTP failures without retaining response text', async () => {
    const id = 'CVE-2026-15555';
    const cdn = 'f9gkulwameaj0boi.public.blob.vercel-storage.com';
    for (const [status, category] of [
      [404, '404'],
      [429, '429'],
      [403, 'OTHER_4XX'],
      [503, '5XX'],
      [201, 'OTHER'],
    ] as const) {
      for (const stage of ['PRIMARY', 'CDN'] as const) {
        const seen: string[] = [];
        const source = new AdvisorySource(undefined, false, async url => {
          seen.push(new URL(url.toString()).origin);
          if (stage === 'CDN' && seen.length === 1)
            return new Response(null, {
              status: 302,
              headers: { location: `https://${cdn}/public/entries/${id}.json` },
            });
          return new Response('PRIVATE_RESPONSE_MARKER', { status });
        });
        let code: string | undefined;
        try {
          await source.detail(id);
        } catch (error) {
          code = (error as { code?: string }).code;
        }
        expect(code).toBe(`ADVISORY_DETAIL_${stage}_${category}`);
        expect(JSON.stringify({ code })).not.toContain('PRIVATE_RESPONSE_MARKER');
        expect(seen).toHaveLength(stage === 'CDN' ? 2 : 1);
      }
    }
  });

  it('retains the last good inbox after partial HEAD import and rotation HTTP failures', async () => {
    const fixture = await startAdvisoryFixture();
    const old = detail('CVE-2026-23001');
    const newest = detail('CVE-2026-23002');
    const rotation = detail('CVE-2026-23003');
    for (const item of [old, newest, rotation]) fixture.setDetail(item);
    fixture.page(null, [old.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const lastGood = await app.request<{ lastSuccessAt: string; stale: boolean; incomplete: boolean }>(
      '/api/advisories/status',
    );
    expect(lastGood.body).toMatchObject({ stale: false, incomplete: true });
    expect(lastGood.body.lastSuccessAt).toBeTruthy();
    fixture.page(null, [newest.id], 'rotation-page');
    fixture.page('rotation-page', [rotation.id], null);
    fixture.details.set(rotation.id, { status: 429, body: { privateMarker: 'PRIVATE_RESPONSE_MARKER' } });
    const primary = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(primary).toMatchObject({
      status: 200,
      body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_DETAIL_PRIMARY_429' },
    });
    const partial = await app.request<{
      lastSuccessAt: string;
      failureCode: string;
      stale: boolean;
      incomplete: boolean;
    }>('/api/advisories/status');
    expect(partial.body).toMatchObject({
      stale: true,
      incomplete: true,
      failureCode: 'ADVISORY_DETAIL_PRIMARY_429',
    });
    expect(partial.body.lastSuccessAt).toBeTruthy();
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    expect((await app.request(`/api/advisories/${old.id}`)).status).toBe(200);
    fixture.details.set(rotation.id, { status: 302, location: `/public/entries/${rotation.id}.json` });
    fixture.details.set(`/public/entries/${rotation.id}.json`, {
      status: 503,
      body: { privateMarker: 'PRIVATE_RESPONSE_MARKER' },
    });
    await waitForAdvisoryRetry(app);
    const cdnFailure = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(cdnFailure).toMatchObject({
      status: 200,
      body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_DETAIL_CDN_5XX' },
    });
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: true,
      incomplete: true,
      failureCode: 'ADVISORY_DETAIL_CDN_5XX',
    });
    expect(JSON.stringify([primary.body, cdnFailure.body, partial.body])).not.toContain('PRIVATE_RESPONSE_MARKER');
    expect(JSON.stringify([primary.body, cdnFailure.body, partial.body])).not.toContain(rotation.id);
    fixture.details.set(`/public/entries/${rotation.id}.json`, { body: rotation });
    await waitForAdvisoryRetry(app);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: false,
      incomplete: true,
      failureCode: null,
    });
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(3);
  }, 120000);

  it.each([
    { status: 404, code: 'ADVISORY_DETAIL_PRIMARY_404' },
    { status: 200, body: {}, code: 'ADVISORY_SCHEMA_UNKNOWN' },
  ])(
    'advances rotation past invalid detail items while preserving skipped cycles: $code',
    async failure => {
      const fixture = await startAdvisoryFixture();
      const missing = 'CVE-2026-25001',
        healthy = detail('CVE-2026-25002'),
        later = detail('CVE-2026-25003');
      fixture.page(null, [], 'history');
      fixture.page('history', [missing, healthy.id], 'older');
      fixture.page('older', [later.id], null);
      fixture.details.set(missing, failure);
      fixture.setDetail(healthy);
      fixture.setDetail(later);
      let modelCalls = 0;
      const app = await startHarness(fixture, {
        async plan() {
          modelCalls++;
          return {
            value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
            modelId: 'owned-local-model',
          };
        },
      });
      const skipped = await app.request('/api/advisories/sync', 'POST', {});
      expect(skipped).toMatchObject({
        status: 200,
        body: { outcome: 'SKIPPED', phase: 'rotation', reasonCode: failure.code },
      });
      expect(modelCalls).toBe(0);
      expect(skipped.body).not.toHaveProperty('hypotheses');
      expect((await app.request(`/api/advisories/${healthy.id}`)).status).toBe(200);
      expect((await app.query('SELECT rotation_cursor FROM scanner_advisory_checkpoint'))[0]?.rotation_cursor).toBe(
        'older',
      );
      expect((await app.request('/api/advisories/quarantine')).body.items).toMatchObject([
        { sourceId: missing, reason: failure.code },
      ]);
      const misses = fixture.requests.filter(path => path.endsWith(missing)).length;
      await app.restart();
      await waitForAdvisoryRetry(app);
      expect((await app.request('/api/advisories/sync', 'POST', {})).body.outcome).toBe('COMPLETED');
      expect((await app.request(`/api/advisories/${later.id}`)).status).toBe(200);
      expect(fixture.requests.filter(path => path.endsWith(missing))).toHaveLength(misses);
      expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCount: 0 });
    },
    60000,
  );

  it('skips an inconsistent upstream cycle and retries without planning on the skipped attempt', async () => {
    const fixture = await startAdvisoryFixture();
    const head = detail('CVE-2026-23101');
    const rotation = detail('CVE-2026-23102');
    fixture.page(null, [head.id], 'rotation-page');
    fixture.page('rotation-page', [rotation.id], null);
    fixture.setDetail(head);
    fixture.details.set(rotation.id, { status: 400, body: { marker: 'PRIVATE_UPSTREAM_BODY' } });
    let modelCalls = 0;
    const models: AdvisoryModels = {
      async plan() {
        modelCalls++;
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    };
    const app = await startHarness(fixture, models);

    const skipped = await app.request<{
      outcome: string;
      reasonCode: string;
      checkpoint: { stale: boolean; incomplete: boolean; failureCount: number; lastSuccessAt: string | null };
      hypotheses?: unknown;
    }>('/api/advisories/sync', 'POST', {});
    expect(skipped.status).toBe(200);
    expect(skipped.body).toMatchObject({
      outcome: 'SKIPPED',
      reasonCode: 'ADVISORY_DETAIL_PRIMARY_OTHER_4XX',
      checkpoint: { stale: true, incomplete: true, failureCount: 1 },
    });
    expect(skipped.body.checkpoint.lastSuccessAt).toBeTruthy();
    expect(skipped.body).not.toHaveProperty('hypotheses');
    expect(skipped.body.checkpoint).not.toHaveProperty('headCursor');
    expect(skipped.body.checkpoint).not.toHaveProperty('rotationCursor');
    expect(modelCalls).toBe(0);
    expect(JSON.stringify(skipped.body)).not.toContain('PRIVATE_UPSTREAM_BODY');
    expect((await app.request<{ items: { id: string }[] }>('/api/advisories')).body.items.map(item => item.id)).toEqual(
      [head.id],
    );

    await app.restart();
    const beforeEarly = fixture.requests.length;
    const early = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect(early.status).toBe(503);
    expect(early.body.code).toBe('ADVISORY_RETRY_NOT_DUE');
    expect(fixture.requests).toHaveLength(beforeEarly);
    fixture.setDetail(rotation);
    await waitForAdvisoryRetry(app);
    const recovered = await app.request<{ outcome: string; hypotheses: { ready: number } }>(
      '/api/advisories/sync',
      'POST',
      {},
    );
    expect(recovered.status).toBe(200);
    expect(recovered.body.outcome).toBe('COMPLETED');
    expect(recovered.body.hypotheses.ready).toBeGreaterThanOrEqual(1);
    expect(modelCalls).toBeGreaterThanOrEqual(1);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: false,
      incomplete: true,
      failureCount: 0,
      failureCode: null,
    });
  }, 120000);

  it('accepts documented exposure values and strips unrelated advisory fields', () => {
    const local = detail('CVE-2026-10001');
    for (const exposure of [null, 'Actively exploited', 'Default setups', 'Specific setups only', 'Unclear'] as const) {
      expect(detailSchema.safeParse({ ...local, exposure }).success).toBe(true);
    }
    expect(detailSchema.safeParse({ ...local, exposure: 'Unverified' }).success).toBe(false);
    expect(detailSchema.parse({ ...local, unexpected: 'unreviewed field' })).not.toHaveProperty('unexpected');
  });

  it('strips unused feed metadata before storage, hashing and model planning', async () => {
    const fixture = await startAdvisoryFixture();
    const original = detail('CVE-2026-12004');
    const enriched = {
      ...original,
      summary: {
        text: 'Owned fixture summary',
        model: 'owned-summary-model',
        promptVersion: 'v1',
        generatedAt: '2026-11-04T00:00:00Z',
        basis: { note: 'PRIVATE_BASIS_MARKER' },
      },
      recordNotes: { custom: 'PRIVATE_NOTE_MARKER' },
      fixedIn: { custom: 'PRIVATE_FIX_MARKER' },
      extraDetail: 'PRIVATE_DETAIL_MARKER',
      sources: [{ ...original.sources[0], extraSource: 'PRIVATE_SOURCE_MARKER' }],
      affected: [{ ...original.affected[0], extraAffected: 'PRIVATE_AFFECTED_MARKER' }],
    };
    fixture.page(null, [original.id], null);
    fixture.pages.set('/api/v1/entries', {
      body: {
        entries: [{ id: original.id, extraEntry: 'PRIVATE_ENTRY_MARKER' }],
        nextCursor: null,
        extraPage: 'PRIVATE_PAGE_MARKER',
      },
    });
    fixture.statusWire.body = {
      polling: {},
      history: {},
      backfill: {},
      storage: {},
      extraStatus: 'PRIVATE_STATUS_MARKER',
    };
    fixture.details.set(original.id, { body: enriched });
    const modelInputs: unknown[] = [];
    const models: AdvisoryModels = {
      async plan(candidate) {
        modelInputs.push(candidate);
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    };
    const app = await startHarness(fixture, models);

    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const saved = await app.request<{ detail: Detail }>(`/api/advisories/${original.id}`);
    expect(saved.status).toBe(200);
    expect(saved.body.detail.summary).toMatchObject({ text: 'Owned fixture summary' });
    expect(saved.body.detail.summary).not.toHaveProperty('generatedAt');
    expect(saved.body.detail.summary).not.toHaveProperty('basis');
    expect(saved.body.detail).not.toHaveProperty('recordNotes');
    expect(saved.body.detail).not.toHaveProperty('fixedIn');
    const stored = await app.query('SELECT detail FROM scanner_advisories');
    const exported = JSON.stringify([saved.body, stored, modelInputs]);
    for (const marker of [
      'PRIVATE_BASIS_MARKER',
      'PRIVATE_NOTE_MARKER',
      'PRIVATE_FIX_MARKER',
      'PRIVATE_DETAIL_MARKER',
      'PRIVATE_SOURCE_MARKER',
      'PRIVATE_AFFECTED_MARKER',
      'PRIVATE_ENTRY_MARKER',
      'PRIVATE_PAGE_MARKER',
      'PRIVATE_STATUS_MARKER',
    ]) {
      expect(exported).not.toContain(marker);
    }
    expect(materialHash(detailSchema.parse(enriched))).toBe(
      materialHash(detailSchema.parse({ ...original, summary: enriched.summary })),
    );
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: false,
      failureCount: 0,
      failureCode: null,
    });

    for (const ignored of [
      { ...enriched, summary: { ...enriched.summary, basis: 'not-an-object' } },
      { ...enriched, summary: { ...enriched.summary, generatedAt: 'x'.repeat(501) } },
      { ...enriched, recordNotes: 'not-an-array' },
      { ...enriched, fixedIn: { version: '1.0' } },
      { ...enriched, context: 'unrecognized-context' },
      { ...enriched, unexpected: true },
      { ...enriched, summary: { ...enriched.summary, unexpected: true } },
    ])
      expect(detailSchema.safeParse(ignored).success).toBe(true);
    for (const malformed of [
      { ...enriched, title: 5 },
      { ...enriched, summary: { ...enriched.summary, text: 5 } },
      { ...enriched, sources: [{ name: 'Owned', url: 'not-a-url', license: 'fixture' }] },
      { ...enriched, affected: [{ vendor: 'Owned', product: 'Portal' }] },
    ])
      expect(detailSchema.safeParse(malformed).success).toBe(false);
  }, 120000);

  it('accepts bounded vendor product versions without weakening affected variants', () => {
    const local = detail('CVE-2026-12001');
    const affected = { vendor: 'Owned', product: 'Portal', ranges: [], versions: ['1.0'] };
    const parsed = detailSchema.parse({ ...local, affected: [local.affected[0], affected] });
    expect(parsed.affected[1]).toEqual(affected);
    expect(versionApplicability(parsed, '1.0')).toBe('APPLICABILITY_UNKNOWN');
    for (const versions of ['1.0', [1], ['x'.repeat(501)], Array(1001).fill('1.0')]) {
      expect(detailSchema.safeParse({ ...local, affected: [{ ...affected, versions }] }).success).toBe(false);
    }
    expect(detailSchema.parse({ ...local, affected: [{ ...affected, unexpected: true }] }).affected[0]).toEqual(
      affected,
    );
    expect(
      detailSchema.safeParse({ ...local, affected: [{ ecosystem: 'npm', package: 'owned', ranges: [] }] }).success,
    ).toBe(false);
  });

  it('discards bounded package metadata on vendor products while retaining strict affected variants', () => {
    const local = detail('CVE-2026-12003');
    const base = { vendor: 'Owned', product: 'Portal', ranges: [], versions: ['1.0'] };
    const without = detailSchema.parse({ ...local, affected: [base] });
    for (const metadata of [null, 'owned', 7, true, ['owned'], { name: 'owned' }]) {
      const parsed = detailSchema.parse({ ...local, affected: [{ ...base, package: metadata }] });
      expect(parsed.affected).toEqual([base]);
      expect(materialHash(parsed)).toBe(materialHash(without));
      expect(versionApplicability(parsed, '1.0')).toBe('APPLICABILITY_UNKNOWN');
    }
    for (const metadata of [
      'x'.repeat(501),
      Array(17).fill('x'),
      Object.fromEntries(Array.from({ length: 17 }, (_, index) => [`field${index}`, 'x'])),
      { nested: { deeper: { tooDeep: { value: 'x' } } } },
      { text: 'x'.repeat(4097) },
      Number.POSITIVE_INFINITY,
      () => 'x',
    ]) {
      expect(detailSchema.parse({ ...local, affected: [{ ...base, package: metadata }] }).affected).toEqual([base]);
    }
    expect(detailSchema.parse({ ...local, affected: [{ ...base, package: 'owned', unknown: true }] }).affected).toEqual(
      [base],
    );
    expect(
      detailSchema.safeParse({ ...local, affected: [{ ecosystem: 'npm', package: {}, ranges: [], versions: [] }] })
        .success,
    ).toBe(false);
  });

  it('bounds vendor ecosystem metadata while preserving the package-only contract', () => {
    const local = detail('CVE-2026-12005');
    const product = { vendor: 'Owned', product: 'Portal', ranges: [] };
    const base = detailSchema.parse({ ...local, affected: [product] });
    for (const ecosystem of ['Maven', 'npm', 'x'.repeat(500)]) {
      const parsed = detailSchema.parse({ ...local, affected: [{ ...product, ecosystem, package: 'owned' }] });
      expect(parsed.affected).toEqual([product]);
      expect(materialHash(parsed)).toBe(materialHash(base));
    }
    for (const ecosystem of [null, 1, {}, [], 'x'.repeat(501)]) {
      expect(detailSchema.parse({ ...local, affected: [{ ...product, ecosystem }] }).affected).toEqual([product]);
    }
    expect(
      detailSchema.parse({ ...local, affected: [{ ...product, ecosystem: 'npm', unknown: true }] }).affected,
    ).toEqual([product]);
    const packageOnly = { ecosystem: 'npm', package: 'owned', ranges: [], versions: ['1.0'] };
    expect(detailSchema.parse({ ...local, affected: [packageOnly] }).affected).toEqual([packageOnly]);
    expect(detailSchema.safeParse({ ...local, affected: [{ ...packageOnly, versions: undefined }] }).success).toBe(
      false,
    );
  });

  it('accepts unclassified package ranges without inventing ecosystem or versions', () => {
    const original = detail('CVE-2026-12006');
    const affected = { package: 'owned-package', ranges: [{ unsupported: 'range semantics' }] };
    const parsed = detailSchema.parse({ ...original, affected: [affected] });
    expect(parsed.affected).toEqual([affected]);
    expect(versionApplicability(parsed, '1.0')).toBe('APPLICABILITY_UNKNOWN');
    expect(materialHash(detailSchema.parse(parsed))).toBe(materialHash(parsed));
    expect(
      materialHash(detailSchema.parse({ ...original, affected: [{ ...affected, package: 'changed-package' }] })),
    ).not.toBe(materialHash(parsed));
    for (const row of [
      { ranges: [] },
      { package: 'owned-package' },
      { ...affected, package: null },
      { ...affected, package: {} },
      { ...affected, package: 'x'.repeat(501) },
      { ...affected, ranges: null },
      { ...affected, ranges: Array(51).fill('1.0') },
      { ...affected, ecosystem: 'npm' },
      { ...affected, ecosystem: null },
      { ...affected, versions: ['1.0'] },
      { ...affected, vendor: null },
      { ...affected, product: 'partial-product' },
    ]) {
      expect(detailSchema.safeParse({ ...original, affected: [row] }).success).toBe(false);
    }
    expect(detailSchema.parse({ ...original, affected: [{ ...affected, unknown: true }] }).affected).toEqual([
      affected,
    ]);
    const bounded = { package: 'x'.repeat(500), ranges: Array(50).fill('uninterpreted') };
    expect(detailSchema.parse({ ...original, affected: [bounded] }).affected).toEqual([bounded]);
  });

  it('imports unclassified package ranges from rotation through HTTP and retains metadata-only hypotheses', async () => {
    const fixture = await startAdvisoryFixture();
    const head = detail('CVE-2026-12007');
    const rotation = {
      ...detail('CVE-2026-12008', 'PRIVATE_ROTATION_PROSE'),
      affected: [{ package: 'UNCLASSIFIED_PACKAGE_MARKER', ranges: [{ unsupported: 'range semantics' }] }],
    };
    fixture.page(null, [head.id], 'rotation');
    fixture.page('rotation', [rotation.id], null);
    fixture.setDetail(head);
    fixture.details.set(rotation.id, { status: 302, location: `/public/entries/${rotation.id}.json` });
    fixture.details.set(`/public/entries/${rotation.id}.json`, { body: rotation });
    const seen: unknown[] = [];
    const models: AdvisoryModels = {
      async plan(candidate) {
        seen.push(candidate);
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    };
    const app = await startHarness(fixture, models);
    const synced = await app.request('/api/advisories/sync', 'POST', {});
    expect(synced).toMatchObject({ status: 200, body: { hypotheses: { ready: 2, pending: 0 } } });
    expect(fixture.requests).toContain(`/public/entries/${rotation.id}.json`);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: false,
      failureCount: 0,
      failureCode: null,
    });
    const saved = await app.request(`/api/advisories/${rotation.id}`);
    expect(saved.body.detail.affected).toEqual(rotation.affected);
    const stored = await app.query(`SELECT detail FROM scanner_advisories WHERE id='${rotation.id}'`);
    expect(JSON.parse(String(stored[0]?.detail)).affected).toEqual(rotation.affected);
    expect(seen).toContainEqual(
      expect.objectContaining({ id: rotation.id, affectedProducts: [], applicability: 'APPLICABILITY_UNKNOWN' }),
    );
    expect(JSON.stringify(seen)).not.toContain('UNCLASSIFIED_PACKAGE_MARKER');
    expect(JSON.stringify(seen)).not.toContain('PRIVATE_ROTATION_PROSE');
    const state = await app.request(`/api/advisories/${rotation.id}/triage-state`);
    expect(state.body).toMatchObject({
      targetRelevance: 'unknown',
      checkerAvailability: 'none_available',
      hypothesis: { state: 'ready', recommendation: 'monitor_advisory' },
    });
    expect((await app.request('/api/findings')).body.items).toHaveLength(0);
    expect(await app.query('SELECT id FROM scanner_verification_jobs')).toHaveLength(0);
    await app.restart();
    expect((await app.request(`/api/advisories/${rotation.id}`)).body.detail.affected).toEqual(rotation.affected);
    expect((await app.request(`/api/advisories/${rotation.id}/triage-state`)).body).toMatchObject(state.body);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect((await app.request(`/api/advisories/${rotation.id}`)).body.revision).toBe(saved.body.revision);
    expect(seen).toHaveLength(2);
  }, 120000);

  it('imports vendor versions and ecosystem metadata through HTTP without inferring applicability', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = detail('CVE-2026-12002');
    entry.exposure = null;
    entry.affected.push({ vendor: 'Owned', product: 'Portal', ranges: [], versions: ['1.0'] });
    fixture.page(null, [entry.id], null);
    fixture.details.set(entry.id, { status: 302, location: `/public/entries/${entry.id}.json` });
    const packageMetadata = { name: 'PRIVATE_PACKAGE_METADATA_MARKER' };
    let ecosystem = 'PRIVATE_ECOSYSTEM_METADATA_MARKER';
    const withPackage = () => ({
      ...entry,
      affected: [entry.affected[0], { ...entry.affected[1], package: packageMetadata, ecosystem }],
    });
    fixture.details.set(`/public/entries/${entry.id}.json`, { body: withPackage() });
    const seen: unknown[] = [];
    const models: AdvisoryModels = {
      async plan(candidate) {
        seen.push(candidate);
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    };
    const app = await startHarness(fixture, models);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect(fixture.requests).toContain(`/public/entries/${entry.id}.json`);
    const saved = await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${entry.id}`);
    expect(saved.body.detail.affected[1]?.versions).toEqual(['1.0']);
    expect(saved.body.detail.affected[1]).not.toHaveProperty('package');
    expect(saved.body.detail.affected[1]).not.toHaveProperty('ecosystem');
    const stored = await app.query('SELECT detail FROM scanner_advisories');
    expect((JSON.parse(String(stored[0]?.detail)) as Detail).affected[1]?.versions).toEqual(['1.0']);
    expect(String(stored[0]?.detail)).not.toContain('PRIVATE_PACKAGE_METADATA_MARKER');
    expect(seen).toMatchObject([{ id: entry.id, applicability: 'APPLICABILITY_UNKNOWN' }]);
    expect(JSON.stringify(seen)).not.toContain('PRIVATE_PACKAGE_METADATA_MARKER');
    expect(JSON.stringify([saved.body, stored, seen])).not.toContain(ecosystem);
    await app.restart();
    expect(versionApplicability(detailSchema.parse(saved.body.detail), '1.0')).toBe('APPLICABILITY_UNKNOWN');
    packageMetadata.name = 'CHANGED_PRIVATE_PACKAGE_METADATA_MARKER';
    ecosystem = 'CHANGED_PRIVATE_ECOSYSTEM_METADATA_MARKER';
    fixture.details.set(`/public/entries/${entry.id}.json`, { body: withPackage() });
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const unchanged = await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${entry.id}`);
    expect(unchanged.body.revision).toBe(saved.body.revision);
    entry.affected[1]!.versions = ['2.0'];
    fixture.details.set(`/public/entries/${entry.id}.json`, { body: withPackage() });
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const revised = await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${entry.id}`);
    expect(revised.body).toMatchObject({
      revision: saved.body.revision + 1,
      detail: { affected: [entry.affected[0], entry.affected[1]] },
    });
  }, 120000);

  it('accepts bounded nonpublished variants and discards source context', () => {
    const local = detail('CVE-2026-10001');
    for (const status of ['rejected', 'provisional'] as const) {
      const parsed = detailSchema.parse({ ...local, status, publishedAt: null, context: { note: 'PRIVATE_CONTEXT' } });
      expect(parsed).toMatchObject({ status, publishedAt: null });
      expect(parsed).not.toHaveProperty('context');
    }
    expect(detailSchema.safeParse({ ...local, context: null }).success).toBe(true);
    for (const context of ['PRIVATE_CONTEXT', { note: 'x'.repeat(4097) }, { ['x'.repeat(101)]: 1 }])
      expect(detailSchema.parse({ ...local, context })).not.toHaveProperty('context');
    expect(detailSchema.safeParse({ ...local, status: 'unreviewed' }).success).toBe(false);
  });

  it('keeps nonpublished advisories out of automatic hypotheses and source context out of storage and model input', async () => {
    const fixture = await startAdvisoryFixture();
    const rejected = { ...detail('CVE-2026-11001'), status: 'rejected' as const, publishedAt: null };
    const provisional = { ...detail('CVE-2026-11002'), status: 'provisional' as const, publishedAt: null };
    const published = {
      ...detail('CVE-2026-11003'),
      publishedAt: null,
      context: { note: 'PRIVATE_CONTEXT_MARKER' },
    };
    fixture.page(null, [rejected.id, provisional.id, published.id], null);
    for (const item of [rejected, provisional, published]) fixture.setDetail(item);
    const seen: unknown[] = [];
    const models: AdvisoryModels = {
      async plan(candidate) {
        seen.push(candidate);
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'PRODUCT_METADATA_ONLY', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    };
    const app = await startHarness(fixture, models);
    const imported = await app.request<{ hypotheses: { ready: number; pending: number } }>(
      '/api/advisories/sync',
      'POST',
      {},
    );
    expect(imported).toMatchObject({ status: 200, body: { hypotheses: { ready: 1, pending: 0 } } });
    expect(seen).toMatchObject([{ id: published.id }]);
    expect(JSON.stringify(seen)).not.toContain('PRIVATE_CONTEXT_MARKER');
    for (const item of [rejected, provisional]) {
      const response = await app.request<{ upstreamStatus: string; detail: Detail }>(`/api/advisories/${item.id}`);
      expect(response.body).toMatchObject({ upstreamStatus: item.status, detail: { publishedAt: null } });
      expect(
        (await app.request<{ hypothesis: unknown }>(`/api/advisories/${item.id}/triage-state`)).body.hypothesis,
      ).toBeNull();
    }
    const response = await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${published.id}`);
    expect(response.body.detail.publishedAt).toBeNull();
    expect(response.body.detail).not.toHaveProperty('context');
    expect(JSON.stringify((await app.request<{ items: unknown[] }>('/api/advisories')).body)).not.toContain(
      'PRIVATE_CONTEXT_MARKER',
    );
    expect(JSON.stringify(await app.query('SELECT detail FROM scanner_advisories'))).not.toContain(
      'PRIVATE_CONTEXT_MARKER',
    );
    fixture.setDetail({ ...published, context: { note: 'REPLACED_CONTEXT_MARKER' } });
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect((await app.request<{ revision: number }>(`/api/advisories/${published.id}`)).body.revision).toBe(
      response.body.revision,
    );
    expect(JSON.stringify(await app.query('SELECT detail FROM scanner_advisories'))).not.toContain(
      'REPLACED_CONTEXT_MARKER',
    );
  }, 120000);

  it('catalog_integrity_and_all_p0_applicability_cases', async () => {
    const fixture = await startAdvisoryFixture();
    const app = await startHarness(fixture);
    expect((await fetch(`${app.url()}/api/playbooks`)).status).toBe(403);
    expect((await fetch(`${app.url()}/api/references?q=authentication`)).status).toBe(403);
    const listed = await app.request<{
      items: { category: Category; references: string[]; toolId: string; limits: { maxRequests: number } }[];
    }>('/api/playbooks');
    expect(listed.status).toBe(200);
    expect(listed.body.items.map(item => item.category).sort()).toEqual([...categories].sort());
    const emptyBodyIds: string[] = [];
    for (const item of listed.body.items) {
      expect(item.toolId).toMatch(/^check_/);
      expect(item.limits.maxRequests).toBeLessThanOrEqual(12);
      for (const id of item.references) {
        const resolved = await app.request<{ id: string; body: string; revision: string }>(
          `/api/references/${encodeURIComponent(id)}`,
        );
        expect(resolved.status).toBe(200);
        expect(resolved.body.id).toBe(id);
        if (resolved.body.body.length === 0) emptyBodyIds.push(id);
        expect(resolved.body.revision.length).toBeGreaterThan(0);
      }
    }
    const search = await app.request<{ items: { id: string }[] }>('/api/references?q=authentication');
    expect(search.status).toBe(200);
    expect(search.body.items.length).toBeGreaterThan(0);
    await app.restart();
    expect(
      (await app.request<{ items: unknown[] }>('/api/references?q=authentication')).body.items.length,
    ).toBeGreaterThan(0);

    const catalog = new ReferenceCatalog(app.settings.databaseUrl);
    const registry = new PlaybookRegistry(catalog);
    await registry.initialize();
    for (const category of categories) {
      expect((await registry.assess(category, scope, observations[category].vulnerable)).outcome).toBe('CONFIRMED');
      expect((await registry.assess(category, scope, observations[category].patched)).outcome).toBe('NOT_REPRODUCED');
      expect((await registry.assess(category, { ...scope, surfacePresent: false }, null)).outcome).toBe(
        'NOT_APPLICABLE',
      );
      expect((await registry.assess(category, { ...scope, prerequisitesReady: false }, null)).outcome).toBe(
        'PRECONDITION_MISSING',
      );
      expect((await registry.assess(category, { ...scope, completed: false }, null)).outcome).toBe('INCONCLUSIVE');
    }
    expect((await registry.assess('authentication_bypass', { ...scope, identityValid: false }, null)).outcome).toBe(
      'AUTH_REQUIRED',
    );
    for (const denial of [
      { ...(observations.ssrf.vulnerable as object), approvalCurrent: false },
      { ...(observations.ssrf.vulnerable as object), ownedCallback: false },
      { ...(observations.ssrf.vulnerable as object), environment: 'production' },
    ])
      expect((await registry.assess('ssrf', scope, denial)).outcome).toBe('BLOCKED');
    expect(fixture.callbackCount()).toBe(0);
    await expect(registry.assess('idor', scope, { category: 'idor' })).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    });
    catalog.close();

    const copied = await mkdtemp(join(tmpdir(), 'scanner-catalog-tamper-'));
    cleanup.push(() => rm(copied, { recursive: true, force: true }));
    const original = resolve(process.cwd(), 'references');
    /** Copy a local fixture directory recursively for isolated catalogue-integrity tests. */
    async function copyTree(from: string, to: string) {
      await mkdir(to, { recursive: true });
      for (const entry of await readdir(from, { withFileTypes: true })) {
        const source = join(from, entry.name),
          target = join(to, entry.name);
        if (entry.isDirectory()) await copyTree(source, target);
        else await copyFile(source, target);
      }
    }
    await copyTree(original, copied);
    const manifest = JSON.parse(await readFile(join(copied, 'manifest.json'), 'utf8')) as { files: { path: string }[] };
    const file = join(copied, manifest.files.find(item => !item.path.includes('licenses/'))!.path);
    await writeFile(file, `${await readFile(file, 'utf8')}\nTAMPERED`);
    const corrupted = new ReferenceCatalog(app.settings.databaseUrl, copied);
    const denied = new PlaybookRegistry(corrupted);
    await expect(denied.initialize()).rejects.toMatchObject({ code: 'CATALOG_INTEGRITY_FAILED' });
    await expect(corrupted.search('authentication')).rejects.toMatchObject({ code: 'CATALOG_INTEGRITY_FAILED' });
    corrupted.close();
    expect(emptyBodyIds).toEqual([]);
  }, 120000);

  it('advisory_pagination_detail_and_revision_import_is_idempotent', async () => {
    const fixture = await startAdvisoryFixture();
    const first = {
      ...detail('CVE-2026-10001', 'Initial owned fixture text', ['GHSA-AAAA-BBBB-CCCC']),
      exposure: null,
    };
    const second = { ...detail('CVE-2026-10002'), exposure: 'Default setups' as const };
    fixture.setDetail(first);
    fixture.setDetail(second);
    fixture.page(null, [first.id], 'page-two');
    fixture.page('page-two', [second.id], null);
    fixture.details.set(first.id, { status: 302, location: `/public/entries/${first.id}.json` });
    fixture.details.set(`/public/entries/${first.id}.json`, { body: first });
    const app = await startHarness(fixture);
    expect((await fetch(`${app.url()}/api/advisories/sync`, { method: 'POST' })).status).toBe(403);
    const imported = await app.request('/api/advisories/sync', 'POST', {});
    expect(imported.status).toBe(200);
    expect(fixture.requests).toContain(`/public/entries/${first.id}.json`);
    const alias = await app.request<{
      id: string;
      revision: number;
      recordRevision: number;
      triageStatus: string;
      detail: Detail;
    }>(`/api/advisories/GHSA-AAAA-BBBB-CCCC`);
    expect(alias.status).toBe(200);
    expect(alias.body.id).toBe(first.id);
    expect(alias.body).toMatchObject({ revision: 1, recordRevision: 1, triageStatus: 'new' });
    expect(alias.etag).toBe('"1"');
    expect(alias.body.detail.affected[0]?.ranges).toEqual([{ unsupported: 'range semantics' }]);
    expect(alias.body.detail.exposure).toBeNull();
    expect(versionApplicability(alias.body.detail as any, '9.9.9')).toBe('APPLICABILITY_UNKNOWN');
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, incomplete: true });
    const triaged = await app.request<{ revision: number; recordRevision: number; triageStatus: string }>(
      `/api/advisories/${first.id}/triage`,
      'PUT',
      { status: 'triaged' },
      alias.body.recordRevision,
    );
    expect(triaged).toMatchObject({
      status: 200,
      etag: '"2"',
      body: { revision: 1, recordRevision: 2, triageStatus: 'triaged' },
    });
    // A second operator acting on the same revision must not overwrite the first triage decision.
    await app.restart();
    const staleTriage = await app.request<{ code: string }>(
      `/api/advisories/${first.id}/triage`,
      'PUT',
      { status: 'closed' },
      alias.body.recordRevision,
    );
    expect(staleTriage).toMatchObject({ status: 409, body: { code: 'REVISION_CONFLICT' } });
    const retainedTriage = await app.request<{ revision: number; recordRevision: number; triageStatus: string }>(
      `/api/advisories/${first.id}`,
    );
    expect(retainedTriage).toMatchObject({
      status: 200,
      etag: '"2"',
      body: { revision: 1, recordRevision: 2, triageStatus: 'triaged' },
    });
    const repeated = await app.request('/api/advisories/sync', 'POST', {});
    expect(repeated.status).toBe(200);
    expect(
      await app.request<{ id: string; revision: number; recordRevision: number; triageStatus: string }>(
        `/api/advisories/${first.id}`,
      ),
    ).toMatchObject({ etag: '"2"', body: { revision: 1, recordRevision: 2, triageStatus: 'triaged' } });
    expect((await app.request<{ items: unknown[] }>(`/api/advisories/${first.id}/events`)).body.items).toHaveLength(0);
    expect(await app.query('SELECT COUNT(*) AS total FROM scanner_advisory_events')).toMatchObject([{ total: 0 }]);
    await app.restart();
    expect(
      await app.request<{ id: string; recordRevision: number; triageStatus: string }>(
        `/api/advisories/GHSA-AAAA-BBBB-CCCC`,
      ),
    ).toMatchObject({ etag: '"2"', body: { id: first.id, recordRevision: 2, triageStatus: 'triaged' } });
    const changed = {
      ...first,
      exposure: 'Specific setups only' as const,
      modifiedAt: '2026-10-29T13:00:00.000Z',
    };
    fixture.details.set(`/public/entries/${first.id}.json`, { body: changed });
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const revised = await app.request<{
      revision: number;
      recordRevision: number;
      triageStatus: string;
      detail: Detail;
    }>(`/api/advisories/${first.id}`);
    expect(revised).toMatchObject({
      etag: '"3"',
      body: { revision: 2, recordRevision: 3, triageStatus: 'triaged' },
    });
    expect(revised.body.detail.exposure).toBe(changed.exposure);
    expect(
      (await app.request<{ items: { revision: number }[] }>(`/api/advisories/${first.id}/events`)).body.items.map(
        event => event.revision,
      ),
    ).toEqual([2]);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect(
      await app.request<{ revision: number; recordRevision: number }>(`/api/advisories/${first.id}`),
    ).toMatchObject({
      etag: '"3"',
      body: { revision: 2, recordRevision: 3 },
    });
    expect((await app.request<{ items: unknown[] }>(`/api/advisories/${first.id}/events`)).body.items).toHaveLength(1);
  }, 120000);

  it('advisory_sync_recovers_and_refreshes_old_revisions', async () => {
    const fixture = await startAdvisoryFixture();
    const old = detail('CVE-2026-20001');
    const newest = detail('CVE-2026-20002');
    fixture.setDetail(old);
    fixture.setDetail(newest);
    fixture.page(null, [newest.id], 'older-page');
    fixture.page('older-page', [old.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const before = await app.request<{ headCursor: string; stale: boolean }>('/api/advisories/status');
    expect(before.body.stale).toBe(false);
    const revised = {
      ...old,
      originalDescription: 'Revised historical advisory',
      modifiedAt: '2026-10-29T14:00:00.000Z',
    };
    fixture.setDetail(revised);
    fixture.page('older-page', [], null);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect((await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${old.id}`)).body).toMatchObject({
      revision: 2,
      detail: { originalDescription: revised.originalDescription },
    });
    expect((await app.request<{ items: unknown[] }>(`/api/advisories/${old.id}/events`)).body.items).toHaveLength(1);

    const bad = detail('CVE-2026-20003');
    fixture.page(null, [newest.id], 'bad-page');
    fixture.page('bad-page', [bad.id], null);
    fixture.details.set(bad.id, { body: { id: bad.id, unexpected: 'unreviewed schema' } });
    const failed = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(failed).toMatchObject({ status: 200, body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_SCHEMA_UNKNOWN' } });
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: true,
      incomplete: true,
      failureCode: 'ADVISORY_SCHEMA_UNKNOWN',
    });
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    expect((await app.request<{ headCursor: string }>('/api/advisories/status')).body.headCursor).toBe('bad-page');
    await app.restart();
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: true, incomplete: true });
    expect((await app.request<{ revision: number }>(`/api/advisories/${old.id}`)).body.revision).toBe(2);

    fixture.details.set(bad.id, { status: 302, location: 'http://127.0.0.1:9/not-owned' });
    await waitForAdvisoryRetry(app);
    const denied = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(denied).toMatchObject({ status: 200, body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_REDIRECT_DENIED' } });
    expect(fixture.requests.some(path => path.includes('not-owned'))).toBe(false);
    fixture.details.set(bad.id, { body: { ...bad, aliases: [old.id] } });
    await waitForAdvisoryRetry(app);
    const collision = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(collision).toMatchObject({
      status: 200,
      body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_ALIAS_CONFLICT' },
    });
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    fixture.details.set(bad.id, { body: bad });
    fixture.page('bad-page', [bad.id], 'bad-page');
    await waitForAdvisoryRetry(app);
    expect((await app.request<{ reasonCode: string }>('/api/advisories/sync', 'POST', {})).body.reasonCode).toBe(
      'ADVISORY_CURSOR_STALLED',
    );
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    fixture.page('bad-page', [bad.id], null);
    await waitForAdvisoryRetry(app);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(3);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: false,
      incomplete: true,
      failureCode: null,
    });
  }, 120000);

  it('advisory_sync_recovers_and_refreshes_old_revisions_during_sustained_inbox_growth', async () => {
    const fixture = await startAdvisoryFixture();
    const old = detail('CVE-2026-90001');
    fixture.setDetail(old);
    fixture.page(null, [old.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    fixture.setDetail({ ...old, originalDescription: 'Changed after the first visit' });

    // Three lower-sorted arrivals per poll outpace a two-ID offset. The old record must still be revisited.
    for (let round = 0; round < 8; round++) {
      const arrivals = Array.from({ length: 3 }, (_, index) => detail(`CVE-2026-${80000 - round * 100 - index}`));
      for (const entry of arrivals) fixture.setDetail(entry);
      fixture.page(
        null,
        arrivals.map(entry => entry.id),
        null,
      );
      expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    }
    await app.restart();
    expect((await app.request<{ revision: number; detail: Detail }>(`/api/advisories/${old.id}`)).body).toMatchObject({
      revision: 2,
      detail: { originalDescription: 'Changed after the first visit' },
    });
  }, 120000);

  it('advisory_sync_recovers_and_refreshes_old_revisions_after_persisted_retry_delay', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = detail('CVE-2026-30001');
    fixture.setDetail(entry);
    fixture.page(null, [entry.id], null);
    const app = await startHarness(fixture);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);

    fixture.statusWire.body = { unexpected: 'untrusted status' };
    expect((await app.request<{ reasonCode: string }>('/api/advisories/sync', 'POST', {})).body.reasonCode).toBe(
      'ADVISORY_SCHEMA_UNKNOWN',
    );
    fixture.statusWire.body = { polling: {}, history: {}, backfill: {}, storage: {} };
    const beforeEarlyRetry = fixture.requests.length;
    const early = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect({ status: early.status, requests: fixture.requests.length }).toEqual({
      status: 503,
      requests: beforeEarlyRetry,
    });
    expect(early.body.code).toBe('ADVISORY_RETRY_NOT_DUE');
    const retryStatus = await app.request<{ stale: boolean; nextRetryAt: string }>('/api/advisories/status');
    expect(retryStatus.body.stale).toBe(true);
    expect(Date.parse(retryStatus.body.nextRetryAt)).toBeGreaterThan(Date.now());

    await app.restart();
    const beforeRestartRetry = fixture.requests.length;
    const restartedEarly = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect({
      status: restartedEarly.status,
      code: restartedEarly.body.code,
      requests: fixture.requests.length,
    }).toEqual({
      status: 503,
      code: 'ADVISORY_RETRY_NOT_DUE',
      requests: beforeRestartRetry,
    });
    await waitForAdvisoryRetry(app);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect(fixture.requests.length).toBeGreaterThan(beforeRestartRetry);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCode: null });
  }, 120000);

  it('advisory_sync_recovers_and_refreshes_old_revisions_with_durable_bounded_quarantine', async () => {
    const fixture = await startAdvisoryFixture();
    const unknownDestination = await startAdvisoryFixture();
    const entry = detail('CVE-2026-40001');
    const dotted = detail('ACME.PRODUCT-1');
    const marker = 'UNTRUSTED_RESPONSE_MARKER_48293';
    fixture.setDetail(entry);
    fixture.page(null, [entry.id], null);
    const app = await startHarness(fixture);
    expect((await fetch(`${app.url()}/api/advisories/quarantine?limit=2`)).status).toBe(403);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    const validStatus = { polling: {}, history: {}, backfill: {}, storage: {} };
    const cases: {
      name: string;
      reason: string;
      responseReason?: string;
      expectedSourceId?: string;
      corrupt: () => void;
      restore: () => void;
    }[] = [
      {
        name: 'status',
        reason: 'ADVISORY_SCHEMA_UNKNOWN',
        responseReason: 'ADVISORY_SCHEMA_UNKNOWN',
        corrupt: () => {
          fixture.statusWire.body = { unexpected: marker };
        },
        restore: () => {
          fixture.statusWire.body = validStatus;
        },
      },
      {
        name: 'list',
        reason: 'ADVISORY_SCHEMA_UNKNOWN',
        responseReason: 'ADVISORY_SCHEMA_UNKNOWN',
        corrupt: () => {
          fixture.pages.set('/api/v1/entries', { body: { unexpected: marker } });
        },
        restore: () => fixture.page(null, [entry.id], null),
      },
      {
        name: 'detail',
        reason: 'ADVISORY_SCHEMA_UNKNOWN',
        responseReason: 'ADVISORY_SCHEMA_UNKNOWN',
        corrupt: () => {
          fixture.details.set(entry.id, { body: { unexpected: marker } });
        },
        restore: () => fixture.setDetail(entry),
      },
      {
        name: 'redirect',
        reason: 'ADVISORY_REDIRECT_DENIED',
        responseReason: 'ADVISORY_REDIRECT_DENIED',
        corrupt: () => {
          fixture.details.set(entry.id, { status: 302, location: `http://127.0.0.1:9/${marker}` });
        },
        restore: () => fixture.setDetail(entry),
      },
      {
        name: 'malformed-detail-location',
        reason: 'ADVISORY_REDIRECT_DENIED',
        expectedSourceId: entry.id,
        corrupt: () => {
          fixture.details.set(entry.id, { status: 302, location: 'http://[' });
        },
        restore: () => fixture.setDetail(entry),
      },
      {
        name: 'status-redirect',
        reason: 'ADVISORY_REDIRECT_DENIED',
        expectedSourceId: 'STATUS',
        corrupt: () => {
          fixture.statusWire.status = 302;
          fixture.statusWire.location = `${unknownDestination.url}/unknown-${marker}`;
        },
        restore: () => {
          delete fixture.statusWire.status;
          delete fixture.statusWire.location;
        },
      },
      {
        name: 'dotted-id-malformed-detail',
        reason: 'ADVISORY_SCHEMA_UNKNOWN',
        responseReason: 'ADVISORY_SCHEMA_UNKNOWN',
        expectedSourceId: dotted.id,
        corrupt: () => {
          fixture.page(null, [dotted.id], null);
          fixture.details.set(dotted.id, { body: { id: dotted.id, unexpected: marker } });
        },
        restore: () => {
          fixture.setDetail(dotted);
          fixture.page(null, [entry.id, dotted.id], null);
        },
      },
      {
        name: 'cursor',
        reason: 'ADVISORY_CURSOR_STALLED',
        responseReason: 'ADVISORY_CURSOR_STALLED',
        corrupt: () => {
          fixture.page(null, [entry.id], 'loop');
          fixture.page('loop', [], 'loop');
        },
        restore: () => {
          fixture.page(null, [entry.id], null);
          fixture.page('loop', [], null);
        },
      },
    ];
    const visibleDuringFailure: { name: string; status: number }[] = [];
    const requiredQuarantine: { name: string; inserted: boolean; sourceId?: string; reason?: string }[] = [];
    for (const scenario of cases) {
      const before = await app.request<{ items: { sourceId: string; reason: string }[] }>(
        '/api/advisories/quarantine?limit=20',
      );
      scenario.corrupt();
      const failed = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
      expect(failed).toMatchObject({ status: 200, body: { outcome: 'SKIPPED', reasonCode: scenario.reason } });
      if (scenario.responseReason) expect(failed.body.reasonCode).toContain(scenario.responseReason);
      expect(JSON.stringify(failed)).not.toContain(marker);
      const quarantine = await app.request<{ items: { sourceId: string; reason: string }[] }>(
        '/api/advisories/quarantine?limit=20',
      );
      visibleDuringFailure.push({ name: scenario.name, status: quarantine.status });
      expect(JSON.stringify(quarantine)).not.toContain(marker);
      expect(JSON.stringify(quarantine)).not.toContain('http://[');
      if (scenario.expectedSourceId) {
        /** Match the scenario's expected source identifier and diagnostic reason as one quarantine pair. */
        const matches = (item: { sourceId: string; reason: string }) =>
          item.sourceId === scenario.expectedSourceId && item.reason === scenario.reason;
        const previous = before.body.items.filter(matches);
        const retained = quarantine.body.items.filter(matches);
        expect(retained).toHaveLength(1);
        if (previous.length) expect(retained).toEqual(previous);
        requiredQuarantine.push({
          name: scenario.name,
          inserted: quarantine.body.items.length === before.body.items.length + 1,
          sourceId: quarantine.body.items[0]?.sourceId,
          reason: quarantine.body.items[0]?.reason,
        });
      }
      scenario.restore();
      await waitForAdvisoryRetry(app);
      expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    }
    await app.restart();
    const bounded = await app.request<{ items: { reason: string }[] }>('/api/advisories/quarantine?limit=2');
    const history = await app.request<{ items: { sourceId: string; reason: string }[] }>(
      '/api/advisories/quarantine?limit=20',
    );
    expect(visibleDuringFailure).toEqual(cases.map(scenario => ({ name: scenario.name, status: 200 })));
    expect(unknownDestination.requests).toHaveLength(0);
    expect(requiredQuarantine).toEqual([
      // The preceding detail redirect already retained this same source/reason pair.
      { name: 'malformed-detail-location', inserted: false, sourceId: entry.id, reason: 'ADVISORY_REDIRECT_DENIED' },
      { name: 'status-redirect', inserted: true, sourceId: 'STATUS', reason: 'ADVISORY_REDIRECT_DENIED' },
      { name: 'dotted-id-malformed-detail', inserted: true, sourceId: dotted.id, reason: 'ADVISORY_SCHEMA_UNKNOWN' },
    ]);
    expect(bounded.status).toBe(200);
    expect(bounded.body.items).toHaveLength(2);
    expect(history.status).toBe(200);
    for (const reason of ['ADVISORY_SCHEMA_UNKNOWN', 'ADVISORY_REDIRECT_DENIED', 'ADVISORY_CURSOR_STALLED'])
      expect(history.body.items.some(item => item.reason.includes(reason))).toBe(true);
    expect(
      history.body.items
        .filter(item => item.reason === 'ADVISORY_REDIRECT_DENIED')
        .map(item => item.sourceId)
        .sort(),
    ).toEqual([entry.id, 'STATUS']);
    expect(
      history.body.items.some(item => item.sourceId === 'STATUS' && item.reason === 'ADVISORY_REDIRECT_DENIED'),
    ).toBe(true);
    expect(
      history.body.items.some(item => item.sourceId === dotted.id && item.reason === 'ADVISORY_SCHEMA_UNKNOWN'),
    ).toBe(true);
    expect(JSON.stringify({ bounded, history })).not.toContain(marker);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCode: null });
  }, 120000);

  it('does not classify an advisory storage failure as an upstream skip', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = detail('CVE-2026-654326');
    fixture.page(null, [entry.id], null);
    fixture.setDetail(entry);
    let modelCalls = 0;
    const app = await startHarness(fixture, {
      async plan() {
        modelCalls++;
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-model',
        };
      },
    });
    const before = (await app.request('/api/advisories/status')).body;
    await app.query(
      "CREATE TRIGGER owned_advisory_storage_failure BEFORE INSERT ON scanner_advisories BEGIN SELECT RAISE(ABORT, 'owned storage fault'); END",
    );
    const response = await app.request<{ outcome?: string; code?: string }>('/api/advisories/sync', 'POST', {});
    expect(response.status).toBeGreaterThanOrEqual(500);
    expect(response.body.outcome).not.toBe('SKIPPED');
    expect(modelCalls).toBe(0);
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(0);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      failureCount: before.failureCount,
      stale: before.stale,
      lastSuccessAt: before.lastSuccessAt,
    });
  });

  it('skips a truncated upstream HTTP body with a typed checkpoint failure', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = detail('CVE-2026-654327');
    fixture.page(null, [entry.id], null);
    fixture.details.set(entry.id, { truncatedBody: true });
    const app = await startHarness(fixture);
    const response = await app.request<{ outcome: string; reasonCode: string }>('/api/advisories/sync', 'POST', {});
    expect(response).toMatchObject({ status: 200, body: { outcome: 'SKIPPED', reasonCode: 'ADVISORY_BODY_INVALID' } });
    expect((await app.request('/api/advisories/status')).body).toMatchObject({
      stale: true,
      incomplete: true,
      failureCode: 'ADVISORY_BODY_INVALID',
    });
  });

  it('records a skipped native schedule event and recovers on a later cycle', async () => {
    await periodicAdvisoryLifecycle();
  }, 120000);

  it('reports imported entries and material revisions from the real sync CLI', async () => {
    const fixture = await startAdvisoryFixture();
    const head = detail('CVE-2026-654323');
    const rotation = detail('CVE-2026-654324');
    fixture.page(null, [head.id], 'older');
    fixture.page('older', [rotation.id], null);
    fixture.setDetail(head);
    fixture.setDetail(rotation);
    const app = await startHarness(fixture);
    const sync = async () => {
      const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/sync-advisories.ts'], {
        cwd: resolve(import.meta.dirname, '..'),
        env: {
          PORT: new URL(app.url()).port,
          CONTROL_BOOTSTRAP_SECRET: bootstrap,
          SCANNER_ENCRYPTION_KEY: key,
          MORPH_API_KEY: '',
          SCANNER_ADVISORY_SYNC_ENABLED: 'false',
        },
        timeout: 20000,
      });
      expect(result.stdout + result.stderr).not.toContain(bootstrap);
      expect(result.stdout + result.stderr).not.toContain(key);
      return JSON.parse(result.stdout.trim());
    };
    await sync();
    head.originalDescription = 'Changed head advisory';
    rotation.originalDescription = 'Changed rotation advisory';
    head.modifiedAt = rotation.modifiedAt = '2026-10-30T12:00:00.000Z';
    const revised = await sync();
    expect(revised).toMatchObject({ importedHeadRevisions: 1, importedRotationRevisions: 1 });
    expect(revised).toMatchObject({ importedHeadEntries: 1, importedRotationEntries: 1, refreshed: 2 });
    expect((await app.request(`/api/advisories/${head.id}`)).body).toMatchObject({ revision: 2 });
    expect((await app.request(`/api/advisories/${rotation.id}`)).body).toMatchObject({ revision: 2 });
    expect(await sync()).toMatchObject({
      outcome: 'COMPLETED',
      importedHeadRevisions: 0,
      importedRotationRevisions: 0,
      importedHeadEntries: 1,
      importedRotationEntries: 1,
    });
    fixture.details.set(rotation.id, { status: 400, body: { marker: 'PRIVATE_CLI_ERROR' } });
    const skipped = await sync();
    expect(skipped).toMatchObject({
      outcome: 'SKIPPED',
      reasonCode: 'ADVISORY_DETAIL_PRIMARY_OTHER_4XX',
      checkpoint: { stale: true, incomplete: true },
    });
    expect(skipped).not.toHaveProperty('hypotheses');
    expect(Object.keys(skipped.checkpoint).sort()).toEqual(['incomplete', 'nextRetryAt', 'stale']);
    expect(JSON.stringify(skipped)).not.toContain('PRIVATE_CLI_ERROR');
  }, 60000);

  it('rejects overlapping manual hypothesis planning without a duplicate model call', async () => {
    const fixture = await startAdvisoryFixture();
    const entry = detail('CVE-2026-654325');
    fixture.page(null, [entry.id], null);
    fixture.setDetail(entry);
    let entered!: () => void;
    const started = new Promise<void>(resolve => (entered = resolve));
    let release!: () => void;
    const held = new Promise<void>(resolve => (release = resolve));
    let calls = 0;
    const app = await startHarness(fixture, {
      /** Hold the first local planning call to exercise overlapping-admission rejection. */
      async plan() {
        calls++;
        if (calls === 1) {
          entered();
          await held;
        }
        return {
          value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-local-sherlock',
        };
      },
    });
    const first = app.request('/api/advisories/sync', 'POST', {});
    try {
      await started;
      const overlap = await app.request('/api/advisories/sync', 'POST', {});
      expect(overlap.status).toBe(409);
      expect(overlap.body.code).toBe('ADVISORY_TRIAGE_BUSY');
      expect(calls).toBe(1);
    } finally {
      release();
      expect((await first).status).toBe(200);
    }
    expect((await app.request(`/api/advisories/${entry.id}/triage-state`)).body.hypothesis.state).toBe('ready');
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect(calls).toBe(1);
  }, 60000);

  it('aborts and drains manual hypothesis planning before closing model storage', async () => {
    const fixture = await startAdvisoryFixture();
    const entries = [detail('CVE-2026-654326'), detail('CVE-2026-654327')];
    fixture.page(
      null,
      entries.map(item => item.id),
      null,
    );
    entries.forEach(item => fixture.setDetail(item));
    let entered!: () => void;
    const started = new Promise<void>(resolve => (entered = resolve));
    let release!: () => void;
    let calls = 0;
    let aborted = false;
    let settled = false;
    const app = await startHarness(fixture, {
      async plan(_candidate, signal) {
        calls++;
        entered();
        try {
          await new Promise<void>((resolve, reject) => {
            const abort = () => {
              aborted = true;
              reject(new Error('OWNED_MODEL_ABORTED'));
            };
            release = () => {
              signal.removeEventListener('abort', abort);
              resolve();
            };
            if (signal.aborted) abort();
            else signal.addEventListener('abort', abort, { once: true });
          });
          return {
            value: { recommendation: 'monitor_advisory', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
            modelId: 'owned-local-sherlock',
          };
        } finally {
          settled = true;
        }
      },
    });
    const request = app.request('/api/advisories/sync', 'POST', {}).catch(() => undefined);
    try {
      await started;
      await app.close();
      expect(aborted).toBe(true);
      expect(settled).toBe(true);
      expect(calls).toBe(1);
    } finally {
      release?.();
      await request;
    }
    await app.restart();
    const listed = await app.request<{ items: { id: string }[] }>('/api/advisories');
    expect(listed.body.items).toHaveLength(2);
    const states = await Promise.all(entries.map(item => app.request(`/api/advisories/${item.id}/triage-state`)));
    expect(states.every(item => item.body.hypothesis?.state !== 'ready')).toBe(true);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCount: 0 });
    expect(calls).toBe(1);
  }, 60000);

  it('keeps unsupported CVE triage durable and separate from findings across sync revisions', async () => {
    const fixture = await startAdvisoryFixture();
    const php = detail('CVE-2026-654321', 'Private source prose MUST_NOT_REACH_SHERLOCK');
    php.affected = [{ vendor: 'PHP', product: 'Runtime', ranges: [] }];
    php.severity = 'high';
    const npm = detail('CVE-2026-654322', 'Another private source prose MUST_NOT_REACH_SHERLOCK');
    npm.affected = [{ vendor: 'Node', product: 'npm', ranges: [] }];
    fixture.page(null, [php.id, npm.id], null);
    fixture.setDetail(php);
    fixture.setDetail(npm);
    const seen: unknown[] = [];
    const models: AdvisoryModels = {
      /** Record planning candidates and fail the selected local model case without external inference. */
      async plan(candidate) {
        seen.push(candidate);
        if (candidate.id === npm.id) throw new Error('MODEL_UNAVAILABLE');
        return {
          value: { recommendation: 'review_vendor_guidance', rationaleCode: 'VERSION_UNVERIFIED', confidence: 'low' },
          modelId: 'owned-fake-sherlock',
        };
      },
    };
    const app = await startHarness(fixture, models);
    expect((await fetch(`${app.url()}/api/advisories/${php.id}/triage-state`)).status).toBe(403);
    expect((await fetch(`${app.url()}/api/advisories/sync`, { method: 'POST' })).status).toBe(403);
    expect((await app.withoutCsrf('/api/advisories/sync')).status).toBe(403);
    const synced = await app.request<{ hypotheses: { ready: number; pending: number } }>(
      '/api/advisories/sync',
      'POST',
      {},
    );
    expect(synced.status).toBe(200);
    expect(synced.body.hypotheses).toMatchObject({ ready: 1, pending: 1 });
    const cli = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/sync-advisories.ts'], {
      cwd: resolve(import.meta.dirname, '..'),
      env: {
        ...process.env,
        PORT: new URL(app.url()).port,
        CONTROL_BOOTSTRAP_SECRET: bootstrap,
        SCANNER_ENCRYPTION_KEY: key,
      },
      timeout: 20000,
    });
    expect(JSON.parse(cli.stdout.trim().split('\n').at(-1)!)).toMatchObject({ hypotheses: { ready: 0, pending: 1 } });
    expect(cli.stderr).toContain('up to 8 bounded Sherlock calls');
    expect(cli.stdout + cli.stderr).not.toContain(bootstrap);
    expect(JSON.stringify(seen)).not.toContain('MUST_NOT_REACH_SHERLOCK');
    expect(seen).toHaveLength(3);
    const state = await app.request<{
      hypothesis: { state: string; recommendation: string | null };
      targetRelevance: string;
      checkerAvailability: string;
      importance: string;
    }>(`/api/advisories/${php.id}/triage-state`);
    expect(state.body).toMatchObject({
      importance: 'high',
      targetRelevance: 'unknown',
      checkerAvailability: 'none_available',
      hypothesis: { state: 'ready', recommendation: 'review_vendor_guidance' },
    });
    expect((await app.request<{ items: unknown[] }>(`/api/advisories/${php.id}/checkers`)).body.items).toHaveLength(0);
    expect(
      (await app.request<{ items: { id: string; kind: string }[] }>(`/api/advisories/${npm.id}/checkers`)).body.items,
    ).toMatchObject([{ id: 'node_package_review', kind: 'runbook' }]);
    expect(
      (
        await app.request<{ hypothesis: { state: string; recommendation: null } }>(
          `/api/advisories/${npm.id}/triage-state`,
        )
      ).body.hypothesis,
    ).toMatchObject({ state: 'pending', recommendation: null });
    expect(
      (
        await app.request(`/api/advisories/${php.id}/ignore`, 'POST', {
          scope: 'all_targets',
          targetId: null,
          reason: 'Forged operator',
          operator: 'operator-b',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await app.request(`/api/advisories/${php.id}/ignore`, 'POST', {
          scope: 'target',
          targetId: '00000000-0000-4000-8000-000000000001',
          reason: 'No such owned target',
        })
      ).status,
    ).toBe(404);
    const ignored = await app.request<{ ignores: { operator: string; clearedAt: string | null }[] }>(
      `/api/advisories/${php.id}/ignore`,
      'POST',
      { scope: 'all_targets', targetId: null, reason: 'Operator reviewed vendor guidance' },
    );
    expect(ignored.status).toBe(200);
    expect(ignored.body.ignores[0]).toMatchObject({ operator: 'local-operator', clearedAt: null });
    const manual = await app.request<{ cases: { notes: string; sourceRevision: number }[] }>(
      `/api/advisories/${php.id}/cases`,
      'POST',
      { notes: 'Check installed PHP version manually', evidenceRefs: ['inventory:php'] },
    );
    expect(manual.status).toBe(201);
    expect(manual.body.cases[0]).toMatchObject({ notes: 'Check installed PHP version manually', sourceRevision: 1 });
    php.originalDescription = 'Revised private source prose';
    php.modifiedAt = '2026-10-30T12:00:00.000Z';
    fixture.setDetail(php);
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    await app.restart();
    const revised = await app.request<{
      sourceRevision: number;
      ignores: { clearedAt: string | null }[];
      cases: { sourceRevision: number }[];
    }>(`/api/advisories/${php.id}/triage-state`);
    expect(revised.body.sourceRevision).toBe(2);
    expect(revised.body.ignores[0]?.clearedAt).toBeNull();
    expect(revised.body.cases[0]?.sourceRevision).toBe(1);
    const callsBeforeIgnoredSync = seen.filter(value => (value as { id: string }).id === php.id).length;
    expect((await app.request('/api/advisories/sync', 'POST', {})).status).toBe(200);
    expect(seen.filter(value => (value as { id: string }).id === php.id)).toHaveLength(callsBeforeIgnoredSync);
    const undone = await app.request<{ ignores: { clearedAt: string | null }[] }>(
      `/api/advisories/${php.id}/unignore`,
      'POST',
      { scope: 'all_targets', targetId: null },
    );
    expect(undone.status).toBe(200);
    expect(undone.body.ignores[0]?.clearedAt).toBeTruthy();
    const limits = { maxRequests: 10, maxDurationSeconds: 30, maxResponseBytes: 8192, maxConcurrency: 1 };
    const policy = await app.request<{ id: string; revision: number }>('/api/policies', 'POST', {
      name: 'Owned advisory scope',
      permittedMethods: ['GET'],
      scanLimits: limits,
    });
    expect(policy.status).toBe(201);
    const target = await app.request<{ id: string }>('/api/targets', 'POST', {
      name: 'Owned advisory target',
      entryUrl: `${fixture.url}/`,
      approvedOrigins: [fixture.url],
      allowedPaths: ['/'],
      excludedPaths: ['/excluded'],
      permittedMethods: ['GET'],
      environment: 'lab',
      authorizationEvidenceRef: 'approval:owned-advisory-test',
      authorizationConfirmed: true,
      policyId: policy.body.id,
      policyRevision: policy.body.revision,
      schedule: { enabled: false, timezone: 'UTC' },
      scanLimits: limits,
      authProfileIds: [],
    });
    expect(target.status).toBe(201);
    const targetIgnore = await app.request(`/api/advisories/${php.id}/ignore`, 'POST', {
      scope: 'target',
      targetId: target.body.id,
      reason: 'Only this owned target',
    });
    expect(targetIgnore.status).toBe(200);
    expect(
      (await app.request<{ suggested: boolean }>(`/api/advisories/${php.id}/triage-state?targetId=${target.body.id}`))
        .body.suggested,
    ).toBe(false);
    expect((await app.request<{ suggested: boolean }>(`/api/advisories/${php.id}/triage-state`)).body.suggested).toBe(
      true,
    );
    expect(
      (
        await app.request<{ hypothesisHistory: { sourceRevision: number }[] }>(`/api/advisories/${php.id}/triage-state`)
      ).body.hypothesisHistory.map(item => item.sourceRevision),
    ).toEqual([1]);
    expect((await app.request<{ items: unknown[] }>('/api/findings')).body.items).toHaveLength(0);
  }, 120000);
});
