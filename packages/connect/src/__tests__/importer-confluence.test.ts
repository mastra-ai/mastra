import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImporterProviderContext } from '../importer-registry.js';
import { confluenceImporterRegistration } from '../providers/confluence/importer.js';
import { createFakeImporter, createFakeState, runImporter, type FakeImporter } from './fixtures/importer-harness.js';

interface ConfluencePageFixture {
  id: string;
  title: string;
  lastModified: string;
  version?: number;
  body?: string;
  status?: string;
  spaceKey?: string;
  ancestors?: { id: string; title?: string }[];
}

const DISCOVERY_PATH = 'oauth/token/accessible-resources';
const DEFAULT_CLOUD_ID = '11111111-2222-3333-4444-555555555555';
const EXPECTED_SEARCH_PATH = `ex/confluence/${DEFAULT_CLOUD_ID}/wiki/rest/api/content/search`;

type ProxyRequestArg = { method: string; path: string; query?: Record<string, unknown> };

function pageResult(fixture: ConfluencePageFixture) {
  return {
    id: fixture.id,
    type: 'page',
    title: fixture.title,
    status: fixture.status ?? 'current',
    version: { number: fixture.version ?? 1, when: fixture.lastModified },
    space: { key: fixture.spaceKey ?? 'ENG' },
    body: { storage: { value: fixture.body ?? '' } },
    _links: { webui: `/wiki/spaces/${fixture.spaceKey ?? 'ENG'}/pages/${fixture.id}` },
    history: { lastUpdated: { when: fixture.lastModified } },
    ...(fixture.ancestors ? { ancestors: fixture.ancestors } : {}),
  };
}

function searchResponse(pages: ConfluencePageFixture[], hasNext = false) {
  return {
    results: pages.map(pageResult),
    _links: hasNext ? { next: '/wiki/...' } : {},
    size: pages.length,
  };
}

type QueueItem = { kind: 'value'; value: unknown } | { kind: 'error'; error: unknown };

interface TestContext {
  ctx: ImporterProviderContext;
  request: ReturnType<typeof vi.fn>;
  importer: FakeImporter;
  state: ReturnType<typeof createFakeState>;
  /** Queue one or more responses for successive search calls (FIFO). */
  queueSearch: (...values: unknown[]) => void;
  /** Queue a rejection for the next search call. */
  queueSearchError: (error: unknown) => void;
  /** Persistent fallback for search calls once the queue drains. */
  setSearch: (value: unknown) => void;
  /** Proxy calls that targeted the search endpoint, in order. */
  searchCalls: () => ProxyRequestArg[];
  /** Proxy calls that targeted the cloudId discovery endpoint, in order. */
  discoveryCalls: () => ProxyRequestArg[];
}

function makeContext(overrides?: {
  role?: 'owner' | 'edit';
  /** accessible-resources payload the discovery call resolves to. */
  resources?: unknown;
  /** reject the discovery call with this error instead of resolving. */
  discoveryError?: unknown;
}): TestContext {
  const resources = overrides?.resources ?? [
    { id: DEFAULT_CLOUD_ID, url: 'https://acme.atlassian.net/wiki', name: 'acme' },
  ];
  const searchQueue: QueueItem[] = [];
  let persistentSearch: unknown;
  let hasPersistent = false;

  const request = vi.fn(async (options: ProxyRequestArg) => {
    if (options.path === DISCOVERY_PATH) {
      if (overrides?.discoveryError !== undefined) throw overrides.discoveryError;
      return resources;
    }
    const next = searchQueue.shift();
    if (next) {
      if (next.kind === 'error') throw next.error;
      return next.value;
    }
    if (hasPersistent) return persistentSearch;
    return { results: [], _links: {} };
  });

  const role = overrides?.role ?? 'owner';
  const ctx: ImporterProviderContext = {
    connection: { id: 'c_conf', integrationId: 'confluence', status: 'active' } as never,
    request: request as ImporterProviderContext['request'],
    access: { 'org:acme': role },
    schedule: '0 * * * *',
  };
  const importer = createFakeImporter(role);
  const state = createFakeState();

  const callsWith = (predicate: (path: string) => boolean) =>
    request.mock.calls.map(call => call[0] as ProxyRequestArg).filter(arg => predicate(arg.path));

  return {
    ctx,
    request,
    importer,
    state,
    queueSearch: (...values) => {
      for (const value of values) searchQueue.push({ kind: 'value', value });
    },
    queueSearchError: error => searchQueue.push({ kind: 'error', error }),
    setSearch: value => {
      persistentSearch = value;
      hasPersistent = true;
    },
    searchCalls: () => callsWith(path => path !== DISCOVERY_PATH),
    discoveryCalls: () => callsWith(path => path === DISCOVERY_PATH),
  };
}

describe('confluence importer', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  beforeEach(() => warnSpy?.mockRestore());

  it('resolves the cloudId via accessible-resources and targets the ex/confluence gateway path', async () => {
    const { ctx, importer, state, queueSearch, searchCalls, discoveryCalls } = makeContext();
    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hi</p>' }]),
    );

    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const discovery = discoveryCalls();
    expect(discovery).toHaveLength(1);
    expect(discovery[0]!.method).toBe('GET');
    expect(discovery[0]!.path).toBe(DISCOVERY_PATH);

    const search = searchCalls();
    expect(search[0]!.method).toBe('GET');
    expect(search[0]!.path).toBe(EXPECTED_SEARCH_PATH);
  });

  it('percent-encodes the cloudId in the gateway path', async () => {
    const { ctx, importer, state, queueSearch, searchCalls } = makeContext({
      resources: [{ id: 'cloud/acme', url: 'https://acme.atlassian.net/wiki', name: 'acme' }],
    });
    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hi</p>' }]),
    );

    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    expect(searchCalls()[0]!.path).toBe('ex/confluence/cloud%2Facme/wiki/rest/api/content/search');
  });

  it('fails closed with a distinct error when no accessible resource is returned', async () => {
    const { ctx, importer, state } = makeContext({ resources: [] });
    await expect(runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /no accessible confluence resource/i,
    );
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('fails closed with a distinct error when the accessible resource is malformed (missing id)', async () => {
    const { ctx, importer, state } = makeContext({ resources: [{ url: 'https://acme.atlassian.net/wiki' }] });
    await expect(runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state })).rejects.toThrow(
      /malformed/i,
    );
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('first run imports every page and advances the watermark', async () => {
    const { ctx, importer, state, queueSearch, searchCalls } = makeContext();
    queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hello</p>' },
        { id: 'p2', title: 'Beta', lastModified: '2026-09-02T00:00:00Z', body: '<p>world</p>' },
      ]),
    );

    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    expect(importer.nodes.get('confluence:page:p1')?.input.name).toBe('Alpha');
    expect(importer.nodes.get('confluence:page:p2')?.input.name).toBe('Beta');
    expect(await state.get('confluence:watermark')).toBe(JSON.stringify({ watermark: '2026-09-02T00:00:00Z' }));
    const call = searchCalls()[0]!;
    expect(call.method).toBe('GET');
    expect(call.path).toBe(EXPECTED_SEARCH_PATH);
    expect(call.query!.cql).toContain('order by lastmodified asc');
  });

  it('node addresses stay confluence:page:{id} and never embed the cloudId', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hello</p>' }]),
    );

    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    expect([...importer.nodes.keys()]).toEqual(['confluence:page:p1']);
    expect([...importer.nodes.keys()].some(address => address.includes(DEFAULT_CLOUD_ID))).toBe(false);
  });

  it('second run with unchanged fixtures is idempotent — no new records', async () => {
    const { ctx, importer, state, setSearch } = makeContext();
    setSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>hi</p>' }]));
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstSize = importer.nodes.get('confluence:page:p1')!.records.size;
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(firstSize);
  });

  it('updated body bumps the record id and removes the stale one', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>v1</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstIds = [...importer.nodes.get('confluence:page:p1')!.records.keys()];

    queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', version: 2, body: '<p>v2</p>' },
      ]),
    );
    await runImporter(definition, { importer, state });
    const secondIds = [...importer.nodes.get('confluence:page:p1')!.records.keys()];
    expect(secondIds).toHaveLength(1);
    expect(secondIds[0]).not.toBe(firstIds[0]);
  });

  it('watermark advances only on success — mid-run failure leaves it untouched', async () => {
    const { ctx, importer, state, queueSearchError } = makeContext();
    queueSearchError(new Error('confluence unreachable'));
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow(/confluence/);
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('deleted status removes records under an owner binding', async () => {
    const { ctx, importer, state, queueSearch } = makeContext({ role: 'owner' });
    queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>x</p>' }]));
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(1);

    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', status: 'trashed' }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(0);
  });

  it('edit-role bindings skip removals', async () => {
    const { ctx, importer, state, queueSearch } = makeContext({ role: 'edit' });
    queueSearch(searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>x</p>' }]));
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });

    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-02T00:00:00Z', status: 'trashed' }]),
    );
    await runImporter(definition, { importer, state });
    expect(importer.nodes.get('confluence:page:p1')!.records.size).toBe(1);
  });

  it('walks paginated results while _links.next is present', async () => {
    const { ctx, importer, state, queueSearch, searchCalls } = makeContext();
    queueSearch(
      searchResponse([{ id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>a</p>' }], true),
      searchResponse([{ id: 'p2', title: 'Beta', lastModified: '2026-09-02T00:00:00Z', body: '<p>b</p>' }]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    expect(searchCalls()).toHaveLength(2);
    expect(importer.nodes.size).toBe(2);
  });

  it('rejects malformed payloads via zod', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch({ results: [{ id: 42 }] });
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await expect(runImporter(definition, { importer, state })).rejects.toThrow();
    expect(await state.get('confluence:watermark')).toBeUndefined();
  });

  it('requests ancestors in the expand and emits a child-of link toward the direct parent', async () => {
    const { ctx, importer, state, queueSearch, searchCalls } = makeContext();
    queueSearch(
      searchResponse([
        {
          id: 'p3',
          title: 'Grandchild',
          lastModified: '2026-09-01T00:00:00Z',
          body: '<p>content</p>',
          ancestors: [
            { id: 'p1', title: 'Root' },
            { id: 'p2', title: 'Parent' },
          ],
        },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const call = searchCalls()[0]!;
    expect(call.query!.expand).toContain('ancestors');
    const record = [...importer.nodes.get('confluence:page:p3')!.records.values()][0]!;
    // Direct parent is the LAST ancestor (root → parent order).
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { address: 'confluence:page:p2', rel: 'child-of' },
    ]);
  });

  it('extracts ri:page links — content-id becomes an address link, title-only becomes a name link', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch(
      searchResponse([
        {
          id: 'p1',
          title: 'Alpha',
          lastModified: '2026-09-01T00:00:00Z',
          body:
            '<p>See <ac:link><ri:page ri:content-title="Runbook" ri:content-id="777"/></ac:link> and ' +
            '<ac:link><ri:page ri:content-title="Onboarding Guide"/></ac:link> for details.</p>',
        },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const record = [...importer.nodes.get('confluence:page:p1')!.records.values()][0]!;
    expect((record.metadata as { links: unknown[] }).links).toEqual([
      { name: 'Onboarding Guide', rel: 'references' },
      { address: 'confluence:page:777', rel: 'references' },
    ]);
    // Links survive even though HTML stripping removed the markup from the body text.
    expect(record.text).not.toContain('ri:page');
    expect(record.text).toContain('See');
  });

  it('stamps node self-address metadata and neutralizes wikilink brackets in body text', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', body: '<p>about [[Beta]] page</p>' },
      ]),
    );
    await runImporter(confluenceImporterRegistration.createImporter(ctx), { importer, state });

    const node = importer.nodes.get('confluence:page:p1')!;
    expect(node.input.metadata).toEqual({ address: 'confluence:page:p1' });
    const record = [...node.records.values()][0]!;
    expect(record.text).toContain('［［Beta］］');
    expect(record.text).not.toContain('[[');
  });

  it('a link change alone produces a new content-hash record', async () => {
    const { ctx, importer, state, queueSearch } = makeContext();
    queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', ancestors: [{ id: 'parentA' }] },
      ]),
    );
    const definition = confluenceImporterRegistration.createImporter(ctx);
    await runImporter(definition, { importer, state });
    const firstId = [...importer.nodes.get('confluence:page:p1')!.records.keys()][0]!;

    // Page moved under a different parent — same title/body/timestamp, ONLY the
    // links differ, proving the link array is part of the content-hash payload.
    queueSearch(
      searchResponse([
        { id: 'p1', title: 'Alpha', lastModified: '2026-09-01T00:00:00Z', ancestors: [{ id: 'parentB' }] },
      ]),
    );
    await runImporter(definition, { importer, state });

    const ids = [...importer.nodes.get('confluence:page:p1')!.records.keys()];
    expect(ids).toHaveLength(1);
    expect(ids[0]).not.toBe(firstId);
  });
});
