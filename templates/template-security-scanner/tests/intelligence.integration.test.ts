import { createClient } from '@libsql/client';
import { createServer } from 'node:http';
import { copyFile, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSettings } from '../src/config/settings.js';
import { AdvisorySource } from '../src/advisory/source.js';
import { versionApplicability } from '../src/advisory/contracts.js';
import { startControlPlane } from '../src/http/server.js';
import { ReferenceCatalog } from '../src/knowledge/catalog.js';
import { PlaybookRegistry, categories, type Category } from '../src/knowledge/playbooks.js';

const bootstrap = 'owned_local_intelligence_fixture_bootstrap_secret';
const key = 'ab'.repeat(32);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});

type Detail = {
  id: string;
  aliases: string[];
  status: 'published' | 'withdrawn';
  title: string;
  originalDescription: string;
  affected: { vendor: string; product: string; ranges: unknown[] }[];
  sources: { name: string; url: string; license: string }[];
  modifiedAt: string;
  summary?: { text: string; model: string; promptVersion: string };
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
type Wire = { status?: number; body?: unknown; contentType?: string; location?: string };
async function startAdvisoryFixture() {
  const pages = new Map<string, Wire>();
  const details = new Map<string, Wire>();
  const requests: string[] = [];
  const statusWire: Wire = { body: { polling: {}, history: {}, backfill: {}, storage: {} } };
  let callbackCount = 0;
  const server = createServer((request, response) => {
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

async function waitForAdvisoryRetry(app: Awaited<ReturnType<typeof startHarness>>) {
  const status = await app.request<{ nextRetryAt?: string | null }>('/api/advisories/status');
  const nextRetryAt = status.body.nextRetryAt;
  if (!nextRetryAt) return;
  const delay = Math.max(0, Date.parse(nextRetryAt) - Date.now() + 25);
  expect(Number.isFinite(delay)).toBe(true);
  expect(delay).toBeLessThanOrEqual(15_000);
  if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
}

async function startHarness(fixture: Awaited<ReturnType<typeof startAdvisoryFixture>>) {
  const root = await mkdtemp(join(tmpdir(), 'scanner-intelligence-'));
  cleanup.push(() => rm(root, { recursive: true, force: true }));
  const settings = loadSettings({ CONTROL_BOOTSTRAP_SECRET: bootstrap, SCANNER_ENCRYPTION_KEY: key }, root);
  const source = new AdvisorySource(fixture.url, true);
  let running = await startControlPlane(settings, 0, undefined, undefined, source);
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
    url: () => running.url,
    async restart() {
      await running.close();
      active = false;
      running = await startControlPlane(settings, 0, undefined, undefined, source);
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
    const first = detail('CVE-2026-10001', 'Initial owned fixture text', ['GHSA-AAAA-BBBB-CCCC']);
    const second = detail('CVE-2026-10002');
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
      originalDescription: 'Materially revised owned fixture text',
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
    expect(revised.body.detail.originalDescription).toBe(changed.originalDescription);
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
    const failed = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect(failed.status).toBe(503);
    expect(failed.body.code).toContain('ADVISORY_SCHEMA_UNKNOWN');
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
    const denied = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect(denied.status).toBe(503);
    expect(denied.body.code).toContain('ADVISORY_REDIRECT_DENIED');
    expect(fixture.requests.some(path => path.includes('not-owned'))).toBe(false);
    fixture.details.set(bad.id, { body: { ...bad, aliases: [old.id] } });
    await waitForAdvisoryRetry(app);
    const collision = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
    expect(collision.status).toBe(503);
    expect(collision.body.code).toContain('ADVISORY_ALIAS_CONFLICT');
    expect((await app.request<{ items: unknown[] }>('/api/advisories')).body.items).toHaveLength(2);
    fixture.details.set(bad.id, { body: bad });
    fixture.page('bad-page', [bad.id], 'bad-page');
    await waitForAdvisoryRetry(app);
    expect((await app.request<{ code: string }>('/api/advisories/sync', 'POST', {})).body.code).toContain(
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
    expect((await app.request<{ code: string }>('/api/advisories/sync', 'POST', {})).body.code).toContain(
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
      const failed = await app.request<{ code: string }>('/api/advisories/sync', 'POST', {});
      expect(failed.status).toBe(503);
      if (scenario.responseReason) expect(failed.body.code).toContain(scenario.responseReason);
      expect(JSON.stringify(failed)).not.toContain(marker);
      const quarantine = await app.request<{ items: { sourceId: string; reason: string }[] }>(
        '/api/advisories/quarantine?limit=20',
      );
      visibleDuringFailure.push({ name: scenario.name, status: quarantine.status });
      expect(JSON.stringify(quarantine)).not.toContain(marker);
      expect(JSON.stringify(quarantine)).not.toContain('http://[');
      if (scenario.expectedSourceId) {
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
      { name: 'malformed-detail-location', inserted: true, sourceId: entry.id, reason: 'ADVISORY_REDIRECT_DENIED' },
      { name: 'status-redirect', inserted: true, sourceId: 'STATUS', reason: 'ADVISORY_REDIRECT_DENIED' },
      { name: 'dotted-id-malformed-detail', inserted: true, sourceId: dotted.id, reason: 'ADVISORY_SCHEMA_UNKNOWN' },
    ]);
    expect(bounded.status).toBe(200);
    expect(bounded.body.items).toHaveLength(2);
    expect(history.status).toBe(200);
    for (const reason of ['ADVISORY_SCHEMA_UNKNOWN', 'ADVISORY_REDIRECT_DENIED', 'ADVISORY_CURSOR_STALLED'])
      expect(history.body.items.some(item => item.reason.includes(reason))).toBe(true);
    expect(history.body.items.filter(item => item.reason === 'ADVISORY_REDIRECT_DENIED')).toHaveLength(3);
    expect(
      history.body.items.some(item => item.sourceId === 'STATUS' && item.reason === 'ADVISORY_REDIRECT_DENIED'),
    ).toBe(true);
    expect(
      history.body.items.some(item => item.sourceId === dotted.id && item.reason === 'ADVISORY_SCHEMA_UNKNOWN'),
    ).toBe(true);
    expect(JSON.stringify({ bounded, history })).not.toContain(marker);
    expect((await app.request('/api/advisories/status')).body).toMatchObject({ stale: false, failureCode: null });
  }, 120000);
});
