import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Classifier } from '@mastra/core/classifier';
import { Mastra } from '@mastra/core/mastra';
import { createScorer } from '@mastra/core/evals';
import { LibSQLStore } from '@mastra/libsql';
import { expectEvals } from '@mastra/evals/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { loadConfig } from '../src/mastra/config';
import type { DnsResolver, PinnedTransport } from '../src/mastra/lib/acquisition';
import { CLASSIFIER_ID, COMPETITOR_CHANGE_QUESTIONS } from '../src/mastra/lib/classification';
import { diffContent, normalizeHtml } from '../src/mastra/lib/content';
import { MonitorStore } from '../src/mastra/lib/store';
import { monitorInputSchema } from '../src/mastra/schemas';
import { createCompetitorMonitorWorkflow } from '../src/mastra/workflows/competitor-monitor-workflow';

const publicDns: DnsResolver = async () => [{ address: '93.184.216.34', family: 4 }];
const html = (price: string) =>
  `<main><h1>Pricing</h1><p>Starter price is ${price}. The Starter plan includes hosted monitoring, weekly reports, email support, clear onboarding guidance, and documented usage limits for growing teams.</p><table><tr><td>Plan</td><td>Price</td><td>Entitlement</td></tr><tr><td>Pro</td><td>$49</td><td>Priority support and advanced exports</td></tr></table><p>Pricing is effective from 2026-10-01 and remains subject to the published service terms.</p></main>`;
type RawSource = z.input<typeof monitorInputSchema>['sources'][number];
const sourceInput = (
  sources: RawSource[] = [
    { id: 'pricing-page', label: 'Pricing', url: 'https://public.example/pricing', kind: 'pricing' },
  ],
) => ({
  monitorId: 'monitor-a',
  profile: { name: 'Jev monitor', interests: ['pricing'] },
  sources,
});
let stores: MonitorStore[] = [];
afterEach(async () => Promise.all(stores.splice(0).map(store => store.close())));

function fixtureTransport(page: () => string): PinnedTransport {
  return async ({ url }) => ({
    status: 200,
    headers: { 'content-type': url.pathname === '/robots.txt' ? 'text/plain' : 'text/html' },
    body: new TextEncoder().encode(url.pathname === '/robots.txt' ? 'User-agent: *\nAllow: /' : page()),
  });
}

async function startRegisteredWorkflow(
  store: MonitorStore,
  config: ReturnType<typeof loadConfig>,
  page: () => string,
  input: unknown = sourceInput(),
  transport: PinnedTransport = fixtureTransport(page),
  resolver: DnsResolver = publicDns,
  classifier?: Classifier<any>,
) {
  const workflow = createCompetitorMonitorWorkflow({
    store,
    config,
    resolver,
    transport,
  });
  const frameworkStore = new LibSQLStore({ id: 'test-framework', url: config.storage.mastraUrl });
  const mastra = new Mastra({
    storage: frameworkStore,
    workflows: { competitorMonitor: workflow },
    classifiers: classifier ? { competitorChange: classifier } : undefined,
  });
  try {
    const run = await mastra.getWorkflow('competitorMonitor').createRun();
    return await run.start({ inputData: input as any });
  } finally {
    await frameworkStore.close();
  }
}

async function runRegisteredWorkflow(
  store: MonitorStore,
  config: ReturnType<typeof loadConfig>,
  page: () => string,
  input: unknown = sourceInput(),
  transport: PinnedTransport = fixtureTransport(page),
  resolver: DnsResolver = publicDns,
  classifier?: Classifier<any>,
) {
  const result = await startRegisteredWorkflow(store, config, page, input, transport, resolver, classifier);
  if (result.status !== 'success') throw new Error('REGISTERED_WORKFLOW_FAILED');
  return result.result;
}

async function persistedCounts(store: MonitorStore) {
  const counts = await Promise.all(
    ['snapshots', 'pending_evidence', 'source_outcomes'].map(async table => {
      const result = await store.client.execute(`SELECT COUNT(*) AS count FROM ${table}`);
      return Number(String(result.rows[0]?.count ?? 0));
    }),
  );
  return { snapshots: counts[0]!, evidence: counts[1]!, outcomes: counts[2]! };
}

async function sourceOutcome(store: MonitorStore, runId: string) {
  const result = await store.client.execute({
    sql: 'SELECT status, detail_json FROM source_outcomes WHERE run_id = ? AND source_id = ?',
    args: [runId, 'pricing-page'],
  });
  const row = result.rows[0];
  return row ? { status: String(row.status), detail: JSON.parse(String(row.detail_json)) } : undefined;
}

describe('native workflow and durable application store', () => {
  it('fatal_workflow_failure_releases_owned_lock_and_allows_retry', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-fatal-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => html('$19'));
    await runRegisteredWorkflow(store, config, () => html('$29'));
    const pending = await store.pendingCandidatesForSource('monitor-a', 'pricing-page');
    expect(pending).toHaveLength(1);
    const other = await store.beginRun('other-monitor', 'other-native-run');
    const pendingRead = vi
      .spyOn(store, 'pendingCandidatesForSource')
      .mockRejectedValueOnce(new Error('TRANSIENT_STORE_READ'));
    const cleanup = vi
      .spyOn(store, 'finishInterruptedNativeRun')
      .mockRejectedValueOnce(new Error('TRANSIENT_CLEANUP_FAILURE'));
    const failed = await startRegisteredWorkflow(store, config, () => html('$29'));
    expect(cleanup).toHaveBeenCalledTimes(2);
    cleanup.mockRestore();
    expect(failed.status).toBe('failed');
    expect(JSON.stringify(failed)).toContain('TRANSIENT_STORE_READ');
    pendingRead.mockRestore();
    const rows = await store.client.execute(
      "SELECT status FROM monitor_runs WHERE monitor_id = 'monitor-a' ORDER BY started_at DESC LIMIT 1",
    );
    expect(rows.rows[0]?.status).toBe('failed');
    expect(
      (await store.client.execute("SELECT * FROM monitor_locks WHERE monitor_id = 'monitor-a'")).rows,
    ).toHaveLength(0);
    expect((await store.pendingCandidatesForSource('monitor-a', 'pricing-page')).map(item => item.candidateId)).toEqual(
      pending.map(item => item.candidateId),
    );
    await expect(store.beginRun('other-monitor')).rejects.toThrow('MONITOR_BUSY');
    const invalid = await startRegisteredWorkflow(store, config, () => html('$29'), {
      ...sourceInput(),
      monitorId: 'other-monitor',
      sources: [sourceInput().sources[0], sourceInput().sources[0]],
    });
    expect(invalid.status).toBe('failed');
    expect(JSON.stringify(invalid)).toContain('DUPLICATE_SOURCE_ID');
    const busy = await startRegisteredWorkflow(store, config, () => html('$29'), {
      ...sourceInput(),
      monitorId: 'other-monitor',
    });
    expect(busy.status).toBe('failed');
    expect(JSON.stringify(busy)).toContain('MONITOR_BUSY');
    await expect(store.beginRun('other-monitor')).rejects.toThrow('MONITOR_BUSY');
    const healthy = await runRegisteredWorkflow(store, config, () => html('$29'));
    expect(healthy.status).toBe('partial');
    await store.finishInterruptedNativeRun('other-native-run', 'failed', 'TEST_CLEANUP');
    // A repeated old callback must leave the new owner untouched.
    const replacement = await store.beginRun('other-monitor', 'replacement-native-run');
    await store.finishInterruptedNativeRun('other-native-run', 'failed', 'TEST_REPLAY');
    await expect(store.beginRun('other-monitor')).rejects.toThrow('MONITOR_BUSY');
    await store.finishRun(replacement, 'success', {});
    expect((await store.runForNativeWorkflowRunId('other-native-run'))?.runId).toBe(other.id);
  });

  it('retains every overflow candidate and its warning through native workflow restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-overflow-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      CANDIDATES_PER_SOURCE: '1',
    });
    let store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => html('$19'));
    const before = (await store.baseline('monitor-a', 'pricing-page'))!;
    const changedHtml = html('$29').replace('</main>', '<p>New entitlement: audit exports are included.</p></main>');
    const changed = await runRegisteredWorkflow(store, config, () => changedHtml);
    expect(changed).toMatchObject({
      status: 'partial',
      counts: { candidatesDetected: 2, candidatesDeferred: 2, sourcesFailed: 0 },
      sources: [{ sourceId: 'pricing-page', status: 'changed', warnings: ['CANDIDATE_LIMIT'] }],
    });
    const after = (await store.baseline('monitor-a', 'pricing-page'))!;
    expect(after.id).not.toBe(before.id);
    await store.close();
    stores = stores.filter(candidate => candidate !== store);
    store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const evidence = await store.pendingForRun(changed.runId);
    expect(evidence).toHaveLength(2);
    expect(evidence.some(item => item.beforeText.includes('$19') && item.afterText.includes('$29'))).toBe(true);
    expect(evidence.some(item => item.beforeText === '' && item.afterText.includes('audit exports'))).toBe(true);
    const pairs = await store.client.execute({
      sql: 'SELECT before_snapshot_id, after_snapshot_id, status FROM pending_evidence WHERE run_id = ?',
      args: [changed.runId],
    });
    expect(pairs.rows).toHaveLength(2);
    for (const row of pairs.rows) {
      expect(row).toMatchObject({ before_snapshot_id: before.id, after_snapshot_id: after.id, status: 'pending' });
    }
    expect(await sourceOutcome(store, changed.runId)).toMatchObject({
      status: 'pending',
      detail: { snapshotId: after.id, warnings: ['CANDIDATE_LIMIT'] },
    });
    const unchanged = await runRegisteredWorkflow(store, config, () => changedHtml);
    expect(unchanged).toMatchObject({
      status: 'partial',
      counts: { candidatesDetected: 2, candidatesDeferred: 2 },
      sources: [{ warnings: ['CANDIDATE_LIMIT'] }],
    });
    expect(unchanged.changes).toEqual(changed.changes);
    expect((await store.baseline('monitor-a', 'pricing-page'))!.id).toBe(after.id);
    expect(await store.pendingForRun(changed.runId)).toHaveLength(2);
  });

  it('baseline_survives_restart_and_unchanged_skips_models', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    let page = html('$19');
    const firstStore = MonitorStore.open(url);
    stores.push(firstStore);
    const first = await runRegisteredWorkflow(firstStore, config, () => page);
    expect(first.status).toBe('success');
    const initialBaseline = (await firstStore.baseline('monitor-a', 'pricing-page'))!;
    expect(initialBaseline.acquisition).toMatchObject({
      mode: 'http',
      finalUrl: 'https://public.example/pricing',
      status: 200,
      retries: 0,
    });
    expect(initialBaseline.acquisition?.durationMs).toBeGreaterThanOrEqual(0);
    await firstStore.close();
    stores = stores.filter(store => store !== firstStore);
    const reopened = MonitorStore.open(url);
    stores.push(reopened);
    const normalizedEquivalent = page.replace('Starter price is', 'Starter <span>price</span> is');
    expect(normalizedEquivalent).not.toBe(page);
    expect(normalizeHtml(normalizedEquivalent).hash).toBe(normalizeHtml(page).hash);
    const unchanged = await runRegisteredWorkflow(reopened, config, () => normalizedEquivalent);
    expect(unchanged).toMatchObject({ status: 'no_change', counts: { candidatesDetected: 0 } });
    const countsBeforeExistingBaseline = await persistedCounts(reopened);
    const existingBaseline = await runRegisteredWorkflow(reopened, config, () => normalizedEquivalent, {
      ...sourceInput(),
      runMode: 'baseline',
      options: { includeUnchangedSources: true },
    });
    expect(existingBaseline.sources).toEqual([
      expect.objectContaining({ sourceId: 'pricing-page', status: 'unchanged', outcome: 'BASELINE_ALREADY_EXISTS' }),
    ]);
    expect(await sourceOutcome(reopened, existingBaseline.runId)).toMatchObject({
      status: 'accepted',
      detail: { code: 'BASELINE_ALREADY_EXISTS', snapshotId: initialBaseline.id, acquisition: { mode: 'http' } },
    });
    expect((await reopened.baseline('monitor-a', 'pricing-page'))?.id).toBe(initialBaseline.id);
    expect((await persistedCounts(reopened)).snapshots).toBe(countsBeforeExistingBaseline.snapshots);
  });

  it('persists changed anchor destinations through a native workflow restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-links-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const page = (destination: string) =>
      `<main><h1>Migration</h1><p>${'The public migration guide explains compatible upgrade steps and preserved service limits. '.repeat(4)}</p><div><a href="${destination}">Migration guide</a></div></main>`;
    let store = MonitorStore.open(url);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => page('https://public.example/v1/migration'));
    await store.close();
    stores = stores.filter(candidate => candidate !== store);
    store = MonitorStore.open(url);
    stores.push(store);
    const changed = await runRegisteredWorkflow(store, config, () => page('https://public.example/v2/migration'));
    expect(changed.sources).toEqual([expect.objectContaining({ sourceId: 'pricing-page', status: 'changed' })]);
    expect(await store.pendingForRun(changed.runId)).toEqual([
      expect.objectContaining({
        beforeText: expect.stringContaining('Migration guide <https://public.example/v1/migration>'),
        afterText: expect.stringContaining('Migration guide <https://public.example/v2/migration>'),
      }),
    ]);
  });

  it('renamed_normalization_preserves_history_and_detects_real_changes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-history-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      TYPESAFE_AI_API_KEY: 'synthetic-test-only',
    });
    const input = monitorInputSchema.parse({ ...sourceInput(), options: { includeUnchangedSources: true } });
    const source = input.sources[0]!;
    const version = 'x9-semantic-v2';
    const oldHash = (text: string) => createHash('sha256').update(`${version}\n${text}`).digest('hex');
    const normalized = normalizeHtml(html('$19'), source);
    const historical = {
      ...normalized,
      hash: oldHash(normalized.text),
      sections: normalized.sections.map(section => ({ ...section, hash: oldHash(section.text) })),
    };
    const profile = JSON.stringify({
      version,
      contentSelector: source.contentSelector,
      ignoreSelectors: source.ignoreSelectors,
      minContentChars: source.minContentChars,
    });
    let store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const seed = await store.beginRun(input.monitorId);
    const baseline = await store.persistAcceptedSnapshot({
      runId: seed.id,
      monitorId: input.monitorId,
      sourceId: source.id,
      sourceUrl: source.url,
      normalizationProfile: profile,
      content: historical,
      evidence: [],
      promoteBaseline: true,
    });
    await store.finishRun(seed, 'success', {});
    const originalRow = (
      await store.client.execute({ sql: 'SELECT * FROM snapshots WHERE id = ?', args: [baseline.id] })
    ).rows[0];
    await store.close();
    stores = stores.filter(candidate => candidate !== store);
    store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const evaluate = vi.fn(async () => {
      throw new Error('TEST_MODEL_UNAVAILABLE');
    });
    const classifier = new Classifier({
      id: CLASSIFIER_ID,
      questions: COMPETITOR_CHANGE_QUESTIONS,
      model: {
        specificationVersion: 'v4',
        provider: 'test.typesafe',
        modelId: 'test-history',
        supportedQuestionTypes: ['choice', 'score', 'boolean'],
        doEvaluate: evaluate,
      } as any,
    });
    const runPage = (price: string, selectedInput: unknown = input) =>
      runRegisteredWorkflow(
        store,
        config,
        () => html(price),
        selectedInput,
        fixtureTransport(() => html(price)),
        publicDns,
        classifier,
      );
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const unchanged = await runPage('$19');
      expect(unchanged.sources).toEqual([expect.objectContaining({ status: 'unchanged' })]);
      expect((await persistedCounts(store)).snapshots).toBe(1);
      expect(await store.pendingCandidatesForSource(input.monitorId, source.id)).toHaveLength(0);
      expect(evaluate).not.toHaveBeenCalled();
    }
    const changed = await runPage('$29');
    expect(changed.sources).toEqual([expect.objectContaining({ status: 'changed' })]);
    const pending = await store.pendingCandidatesForSource(input.monitorId, source.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      beforeSnapshotId: baseline.id,
      beforeText: normalized.sections[1]!.text,
      afterText: normalizeHtml(html('$29'), source).sections[1]!.text,
      sectionKey: normalized.sections[1]!.key,
    });
    expect(evaluate).toHaveBeenCalled();
    expect((await persistedCounts(store)).snapshots).toBe(2);
    // The source retains its original profile even after a current-format baseline is promoted.
    expect((await store.sourceIdentity(input.monitorId, source.id))?.profile).toBe(profile);
    const repeat = await runPage('$29', { ...input, runMode: 'baseline' });
    expect(repeat.sources).toEqual([expect.objectContaining({ status: 'unchanged' })]);
    expect((await persistedCounts(store)).snapshots).toBe(2);
    const compareCurrent = await runPage('$29');
    expect(compareCurrent.sources).toEqual([expect.objectContaining({ status: 'changed' })]);
    expect((await persistedCounts(store)).snapshots).toBe(2);
    expect(await store.pendingCandidatesForSource(input.monitorId, source.id)).toHaveLength(1);
    expect(
      (await store.client.execute({ sql: 'SELECT * FROM snapshots WHERE id = ?', args: [baseline.id] })).rows[0],
    ).toEqual(originalRow);
    for (const incompatible of [
      { ...source, contentSelector: 'main' },
      { ...source, ignoreSelectors: ['table'] },
      { ...source, minContentChars: (source.minContentChars ?? 180) + 1 },
      { ...source, url: 'https://public.example/rebound' },
    ]) {
      const rejected = await runPage('$29', { ...input, sources: [incompatible] });
      expect(rejected.sources[0]).toMatchObject({ status: 'failed', error: { code: 'SOURCE_ID_REBOUND' } });
    }
    for (const [index, invalidProfile] of [
      JSON.stringify({ ...JSON.parse(profile), version: 'x9-semantic-v1' }),
      JSON.stringify({ ...JSON.parse(profile), version: 'prefix-x9-semantic-v2' }),
      JSON.stringify({ ...JSON.parse(profile), futureOption: true }),
      '{malformed',
      'null',
      '[]',
    ].entries()) {
      const invalidInput = { ...input, monitorId: `incompatible-profile-${index}` };
      const run = await store.beginRun(invalidInput.monitorId);
      await store.persistAcceptedSnapshot({
        runId: run.id,
        monitorId: invalidInput.monitorId,
        sourceId: source.id,
        sourceUrl: source.url,
        normalizationProfile: invalidProfile,
        content: historical,
        evidence: [],
        promoteBaseline: true,
      });
      await store.finishRun(run, 'success', {});
      const rejected = await runPage('$19', invalidInput);
      expect(rejected.sources[0]).toMatchObject({ status: 'failed', error: { code: 'SOURCE_ID_REBOUND' } });
    }
  });

  it('preserves and rejects a v1 normalization profile without silently changing its baseline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-normalization-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(url);
    stores.push(store);
    const content = normalizeHtml(html('$19'));
    const run = await store.beginRun('monitor-a');
    const legacyBaseline = await store.persistAcceptedSnapshot({
      runId: run.id,
      monitorId: 'monitor-a',
      sourceId: 'pricing-page',
      sourceUrl: 'https://public.example/pricing',
      normalizationProfile: JSON.stringify({
        version: 'x9-semantic-v1',
        contentSelector: undefined,
        ignoreSelectors: [],
      }),
      content,
      evidence: [],
      promoteBaseline: true,
    });
    await store.finishRun(run, 'success', {});
    const result = await runRegisteredWorkflow(store, config, () => html('$19'));
    expect(result.sources).toEqual([
      expect.objectContaining({
        sourceId: 'pricing-page',
        status: 'failed',
        error: expect.objectContaining({ code: 'SOURCE_ID_REBOUND' }),
      }),
    ]);
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(legacyBaseline.id);
  });

  it('retains suspicious-loss quarantine evidence and compares the next valid retrieval to the accepted baseline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-loss-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const acceptedPage = `<main><h1>Pricing</h1><p>${'Accepted contract wording with published usage limits. '.repeat(80)}</p></main>`;
    await runRegisteredWorkflow(store, config, () => acceptedPage);
    const accepted = (await store.baseline('monitor-a', 'pricing-page'))!;
    const suspiciousPage = `<main><h1>Pricing</h1><p>${'Short replacement wording remains public and readable. '.repeat(10)}</p></main>`;
    const quarantined = await runRegisteredWorkflow(store, config, () => suspiciousPage);
    expect(quarantined.sources).toEqual([
      expect.objectContaining({
        sourceId: 'pricing-page',
        status: 'failed',
        error: { code: 'CONTENT_LOSS_QUARANTINED', retryable: false },
      }),
    ]);
    const outcome = await sourceOutcome(store, quarantined.runId);
    expect(outcome).toMatchObject({
      status: 'quarantined',
      detail: {
        code: 'CONTENT_LOSS_QUARANTINED',
        reason: expect.objectContaining({
          acceptedContentChars: expect.any(Number),
          retrievedContentChars: expect.any(Number),
        }),
      },
    });
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(accepted.id);
    const storedQuarantine = await store.client.execute({
      sql: 'SELECT content_json, acquisition_json FROM snapshots WHERE id = ?',
      args: [String((outcome?.detail as { snapshotId?: string })?.snapshotId)],
    });
    expect(JSON.parse(String(storedQuarantine.rows[0]?.content_json)).text).toContain('Short replacement wording');
    expect(JSON.parse(String(storedQuarantine.rows[0]?.acquisition_json))).toMatchObject({
      mode: 'http',
      finalUrl: 'https://public.example/pricing',
      status: 200,
    });

    const nextValidPage = acceptedPage.replace('published usage limits', 'changed published usage limits');
    const changed = await runRegisteredWorkflow(store, config, () => nextValidPage);
    expect(changed.sources).toEqual([expect.objectContaining({ sourceId: 'pricing-page', status: 'changed' })]);
    const pair = await store.client.execute({
      sql: 'SELECT before_snapshot_id FROM pending_evidence WHERE run_id = ?',
      args: [changed.runId],
    });
    expect(pair.rows).toHaveLength(1);
    expect(String(pair.rows[0]?.before_snapshot_id)).toBe(accepted.id);
  });

  it('rejects unsafe IPv6, mapped addresses, and redirect rebinding without promoting an existing baseline', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-unsafe-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => html('$19'));
    const accepted = (await store.baseline('monitor-a', 'pricing-page'))!;
    const counts = await persistedCounts(store);
    const privateV6 = await startRegisteredWorkflow(
      store,
      config,
      () => html('$29'),
      sourceInput([{ id: 'private-v6', label: 'Private', url: 'https://[fd00::1]/', kind: 'pricing' }]),
    );
    if (privateV6.status !== 'success') throw new Error('REGISTERED_WORKFLOW_FAILED');
    expect(privateV6.result.sources).toEqual([
      expect.objectContaining({
        sourceId: 'private-v6',
        status: 'failed',
        error: expect.objectContaining({ code: 'UNSAFE_ADDRESS' }),
      }),
    ]);
    const mapped = await startRegisteredWorkflow(
      store,
      config,
      () => html('$29'),
      sourceInput(),
      fixtureTransport(() => html('$29')),
      async () => [{ address: '::ffff:127.0.0.1', family: 6 }],
    );
    if (mapped.status !== 'success') throw new Error('REGISTERED_WORKFLOW_FAILED');
    expect(mapped.result.sources).toEqual([
      expect.objectContaining({
        sourceId: 'pricing-page',
        status: 'failed',
        error: expect.objectContaining({ code: 'UNSAFE_ADDRESS' }),
      }),
    ]);
    let resolves = 0;
    const redirectRebinding: DnsResolver = async () => {
      resolves += 1;
      return resolves < 3 ? [{ address: '93.184.216.34', family: 4 }] : [{ address: '::ffff:127.0.0.1', family: 6 }];
    };
    const redirectTransport: PinnedTransport = async ({ url }) =>
      url.pathname === '/robots.txt'
        ? {
            status: 200,
            headers: { 'content-type': 'text/plain' },
            body: new TextEncoder().encode('User-agent: *\nAllow: /'),
          }
        : { status: 302, headers: { location: '/private' }, body: new Uint8Array() };
    const redirected = await startRegisteredWorkflow(
      store,
      config,
      () => html('$29'),
      sourceInput(),
      redirectTransport,
      redirectRebinding,
    );
    if (redirected.status !== 'success') throw new Error('REGISTERED_WORKFLOW_FAILED');
    expect(redirected.result.sources).toEqual([
      expect.objectContaining({
        sourceId: 'pricing-page',
        status: 'failed',
        error: expect.objectContaining({ code: 'UNSAFE_ADDRESS' }),
      }),
    ]);
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(accepted.id);
    expect(await persistedCounts(store)).toMatchObject({ snapshots: counts.snapshots, evidence: counts.evidence });
  });

  it('persists evidence atomically and keeps pending changes partial after reopening', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    let page = html('$19');
    const store = MonitorStore.open(url);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => page);
    page = html('$29');
    const changed = await runRegisteredWorkflow(store, config, () => page);
    expect(changed).toMatchObject({ status: 'partial', counts: { candidatesDetected: 1, candidatesDeferred: 1 } });
    expect(await store.pendingForRun(changed.runId)).toHaveLength(1);
  });

  it('uses structural login/challenge quality checks without rejecting ordinary product or documentation copy', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    let page = html('$19');
    const store = MonitorStore.open(url);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => page);
    page = `<title>Pricing</title><main><h1>Pricing</h1><p>${'Single sign-in is available on Pro plans, with login activity retained for administrators. '.repeat(4)}</p></main>`;
    const productCopy = await runRegisteredWorkflow(store, config, () => page);
    expect(productCopy.sources[0]).not.toMatchObject({ status: 'failed' });
    page = `<title>Login documentation</title><main><h1>Login configuration</h1><p>${'This documentation explains login callbacks, single sign-in configuration, and audit records for operators. '.repeat(4)}</p></main>`;
    const documentation = await runRegisteredWorkflow(store, config, () => page);
    expect(documentation.sources[0]).not.toMatchObject({ status: 'failed' });
    const acceptedBaseline = await store.baseline('monitor-a', 'pricing-page');
    page = `<title>Sign in to continue</title><main><h1>Sign in to continue</h1><form><input type="password" name="password"></form><p>${'Please sign in with your account to access the protected dashboard and verify your identity before viewing this private content. '.repeat(4)}</p></main>`;
    const failed = await runRegisteredWorkflow(store, config, () => page);
    expect(failed.sources[0]).toMatchObject({ status: 'failed', error: { code: 'BLOCKED_OR_AUTHENTICATED_CONTENT' } });
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(acceptedBaseline?.id);
    page = `<title>Service unavailable</title><main><h1>Service unavailable</h1><p>${'We are experiencing technical difficulties. Please try again after the temporary service error is resolved. '.repeat(4)}</p></main>`;
    const unavailable = await runRegisteredWorkflow(store, config, () => page);
    expect(unavailable.sources[0]).toMatchObject({
      status: 'failed',
      error: { code: 'BLOCKED_OR_AUTHENTICATED_CONTENT' },
    });
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(acceptedBaseline?.id);
  });

  it('rejects_invalid_duplicate_and_non_english_sources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const config = loadConfig({
      MONITOR_DATABASE_URL: url,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(url);
    stores.push(store);
    let page = html('$19');
    await runRegisteredWorkflow(store, config, () => page);
    const baseline = await store.baseline('monitor-a', 'pricing-page');
    const initialCounts = await persistedCounts(store);
    const duplicateIds = sourceInput([
      { id: 'pricing-page', label: 'One', url: 'https://public.example/one', kind: 'pricing' },
      { id: 'pricing-page', label: 'Two', url: 'https://public.example/two', kind: 'pricing' },
    ]);
    const duplicateConflict = sourceInput([
      { id: 'one', label: 'One', url: 'https://public.example/pricing', kind: 'pricing' },
      {
        id: 'two',
        label: 'Two',
        url: 'https://public.example/pricing#same',
        kind: 'pricing',
        fetchMode: 'http',
      },
    ]);
    let validationTransportCalls = 0;
    const validationTransport = fixtureTransport(() => {
      validationTransportCalls += 1;
      return page;
    });
    for (const [input, code] of [
      [duplicateIds, 'DUPLICATE_SOURCE_ID'],
      [duplicateConflict, 'DUPLICATE_SOURCE_CONFLICT'],
    ] as const) {
      const failed = (await startRegisteredWorkflow(store, config, () => page, input, validationTransport)) as any;
      expect(failed.status).toBe('failed');
      expect(JSON.stringify(failed)).toContain(code);
    }
    expect(validationTransportCalls).toBe(0);

    const assertNativeQualityRejection = async (
      nextPage: string,
      code: 'UNSUPPORTED_LANGUAGE' | 'LANGUAGE_UNDETERMINED',
    ) => {
      page = nextPage;
      const result = await runRegisteredWorkflow(store, config, () => page);
      expect(result.sources).toEqual([
        expect.objectContaining({ sourceId: 'pricing-page', status: 'failed', error: { code, retryable: false } }),
      ]);
      expect(await sourceOutcome(store, result.runId)).toEqual({
        status: 'quarantined',
        detail: { code, retryable: false },
      });
      expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(baseline?.id);
      expect((await persistedCounts(store)).evidence).toBe(initialCounts.evidence);
    };
    await assertNativeQualityRejection(
      `<html lang="fr"><main><h1>Tarifs</h1><p>${'Le prix mensuel est de vingt-neuf euros avec assistance, exportations et rapports inclus. '.repeat(4)}</p></main></html>`,
      'UNSUPPORTED_LANGUAGE',
    );
    await assertNativeQualityRejection(
      `<html lang="fr"><main><h1>Pricing</h1><p>${'The monthly price is twenty-nine dollars with support, exports, reports, and documented service limits. '.repeat(4)}</p></main></html>`,
      'UNSUPPORTED_LANGUAGE',
    );
    await assertNativeQualityRejection(
      '<main><h1>1234567890</h1><p>9876543210 1234567890 9876543210 1234567890 9876543210</p></main>',
      'LANGUAGE_UNDETERMINED',
    );
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(baseline?.id);
    const finalCounts = await persistedCounts(store);
    expect(finalCounts).toMatchObject({ snapshots: initialCounts.snapshots, evidence: initialCounts.evidence });
    expect(finalCounts.outcomes).toBeGreaterThanOrEqual(initialCounts.outcomes);
  });

  it('initializes one store once when concurrent first monitor runs begin', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const store = MonitorStore.open(`file:${join(directory, 'monitor.db')}`);
    stores.push(store);
    const [first, second] = await Promise.all([store.beginRun('one'), store.beginRun('two')]);
    expect(first.monitorId).toBe('one');
    expect(second.monitorId).toBe('two');
    await Promise.all([store.finishRun(first, 'success', {}), store.finishRun(second, 'success', {})]);
  });

  it('preserves a live lock across local store handles and recovers it after every handle closes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-live-lock-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    const first = MonitorStore.open(url);
    stores.push(first);
    const active = await first.beginRun('monitor-a');
    const second = MonitorStore.open(new URL(url).href);
    stores.push(second);
    await second.init();
    await expect(second.beginRun('monitor-a')).rejects.toThrow('MONITOR_BUSY');
    const current = await second.client.execute({
      sql: 'SELECT status FROM monitor_runs WHERE id = ?',
      args: [active.id],
    });
    expect(current.rows[0]?.status).toBe('running');
    await first.close();
    await second.close();
    stores = stores.filter(store => store !== first && store !== second);
    const reopened = MonitorStore.open(url);
    stores.push(reopened);
    const recovered = await reopened.beginRun('monitor-a');
    expect(recovered.id).not.toBe(active.id);
    const previous = await reopened.client.execute({
      sql: 'SELECT status FROM monitor_runs WHERE id = ?',
      args: [active.id],
    });
    expect(previous.rows[0]?.status).toBe('partial');
    await reopened.finishRun(recovered, 'success', {});
  });

  it('retains pending evidence when the registered classifier is absent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-missing-classifier-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      TYPESAFE_AI_API_KEY: 'synthetic-key',
      JEV_MODEL: 'jev-fixture',
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    await runRegisteredWorkflow(store, config, () => html('$19'));
    const changed = await runRegisteredWorkflow(store, config, () => html('$29'));
    expect(changed.changes).toEqual([
      expect.objectContaining({ status: 'failed', reason: 'CLASSIFICATION_PROVIDER_FAILURE' }),
    ]);
    expect(await store.pendingCandidatesForSource('monitor-a', 'pricing-page')).toHaveLength(1);
  });

  it('adds optional acquisition metadata without rewriting an existing snapshot JSON record', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-migration-'));
    const store = MonitorStore.open(`file:${join(directory, 'monitor.db')}`);
    stores.push(store);
    const content = normalizeHtml('<main><h1>Pricing</h1><p>Historical public pricing content.</p></main>');
    await store.client.execute(`
      CREATE TABLE snapshots (
        id TEXT PRIMARY KEY,
        monitor_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        content_json TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
    await store.client.execute({
      sql: 'INSERT INTO snapshots (id, monitor_id, source_id, source_url, content_json, content_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        'historical',
        'monitor-a',
        'pricing-page',
        'https://public.example/pricing',
        JSON.stringify(content),
        content.hash,
        '2026-09-28T00:00:00.000Z',
      ],
    });
    await store.init();
    const row = await store.client.execute(
      "SELECT content_json, acquisition_json FROM snapshots WHERE id = 'historical'",
    );
    expect(JSON.parse(String(row.rows[0]?.content_json))).toEqual(content);
    expect(row.rows[0]?.acquisition_json).toBeNull();
  });

  it('rolls back a failed snapshot batch after reopening and recovers only after the trigger is removed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const url = `file:${join(directory, 'monitor.db')}`;
    let store = MonitorStore.open(url);
    stores.push(store);
    const initialContent = normalizeHtml(html('$19'));
    const initialRun = await store.beginRun('monitor-a');
    const initialSnapshot = await store.persistAcceptedSnapshot({
      runId: initialRun.id,
      monitorId: 'monitor-a',
      sourceId: 'pricing-page',
      sourceUrl: 'https://public.example/pricing',
      normalizationProfile: 'test',
      content: initialContent,
      evidence: [],
      promoteBaseline: true,
    });
    await store.finishRun(initialRun, 'success', {});
    await store.close();
    stores = stores.filter(candidate => candidate !== store);
    store = MonitorStore.open(url);
    stores.push(store);
    const changedContent = normalizeHtml(html('$29'));
    const evidence = diffContent(initialContent, changedContent);
    const beforeFailure = await persistedCounts(store);
    const failingRun = await store.beginRun('monitor-a');
    await store.client.execute(`
      CREATE TRIGGER reject_test_pending_evidence
      BEFORE INSERT ON pending_evidence
      BEGIN SELECT RAISE(ABORT, 'test pending evidence failure'); END;
    `);
    await expect(
      store.persistAcceptedSnapshot({
        runId: failingRun.id,
        monitorId: 'monitor-a',
        sourceId: 'pricing-page',
        sourceUrl: 'https://public.example/pricing',
        normalizationProfile: 'test',
        content: changedContent,
        beforeSnapshot: initialSnapshot,
        evidence,
        promoteBaseline: true,
      }),
    ).rejects.toThrow('test pending evidence failure');
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(initialSnapshot.id);
    expect(await persistedCounts(store)).toEqual(beforeFailure);
    await store.close();
    stores = stores.filter(candidate => candidate !== store);
    store = MonitorStore.open(url);
    stores.push(store);
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(initialSnapshot.id);
    expect(await persistedCounts(store)).toEqual(beforeFailure);
    await store.client.execute('DROP TRIGGER reject_test_pending_evidence');
    const retryRun = await store.beginRun('monitor-a');
    const recovered = await store.persistAcceptedSnapshot({
      runId: retryRun.id,
      monitorId: 'monitor-a',
      sourceId: 'pricing-page',
      sourceUrl: 'https://public.example/pricing',
      normalizationProfile: 'test',
      content: changedContent,
      beforeSnapshot: initialSnapshot,
      evidence,
      promoteBaseline: true,
    });
    await store.finishRun(retryRun, 'partial', {});
    expect((await store.baseline('monitor-a', 'pricing-page'))?.id).toBe(recovered.id);
    expect((await persistedCounts(store)).evidence).toBe(beforeFailure.evidence + evidence.length);
  });

  it('configured_limits_propagate_and_invalid_overrides_reject', async () => {
    const sources = [
      { id: 'one', label: 'One', url: 'https://public.example/one', kind: 'pricing' as const },
      { id: 'two', label: 'Two', url: 'https://public.example/two', kind: 'pricing' as const },
      { id: 'three', label: 'Three', url: 'https://public.example/three', kind: 'pricing' as const },
    ];
    const assertNativeConcurrency = async (
      environment: Record<string, string>,
      policy: number | undefined,
      expected: number,
    ) => {
      const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
      const config = loadConfig({
        ...environment,
        MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
        MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      });
      const store = MonitorStore.open(config.storage.monitorUrl);
      stores.push(store);
      let active = 0;
      let maximum = 0;
      const transport: PinnedTransport = async ({ url }) => {
        if (url.pathname === '/robots.txt') {
          return {
            status: 200,
            headers: { 'content-type': 'text/plain' },
            body: new TextEncoder().encode('User-agent: *\nAllow: /'),
          };
        }
        active += 1;
        maximum = Math.max(maximum, active);
        await new Promise(resolve => setTimeout(resolve, 5));
        active -= 1;
        return { status: 200, headers: { 'content-type': 'text/html' }, body: new TextEncoder().encode(html('$19')) };
      };
      const result = await startRegisteredWorkflow(
        store,
        config,
        () => html('$19'),
        { ...sourceInput(sources), policy: policy === undefined ? {} : { sourceConcurrency: policy } },
        transport,
      );
      expect(result.status).toBe('success');
      expect(maximum).toBe(expected);
    };
    await assertNativeConcurrency({}, undefined, 3);
    await assertNativeConcurrency({ SOURCE_CONCURRENCY: '2' }, undefined, 2);
    await assertNativeConcurrency({ SOURCE_CONCURRENCY: '3' }, 1, 1);

    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
      CANDIDATES_PER_SOURCE: '1',
      MAX_SOURCES: '1',
      SOURCE_CONCURRENCY: '1',
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    let transportCalls = 0;
    const transport = fixtureTransport(() => {
      transportCalls += 1;
      return html('$19');
    });
    await runRegisteredWorkflow(store, config, () => html('$19'), sourceInput(), transport);
    const limited = await runRegisteredWorkflow(
      store,
      config,
      () => html('$29').replace('</main>', '<p>New entitlement.</p></main>'),
      { ...sourceInput(), policy: { maxCandidatesPerSource: 1 } },
    );
    expect(limited).toMatchObject({
      status: 'partial',
      counts: { candidatesDetected: 2, candidatesDeferred: 2, sourcesFailed: 0 },
    });
    expect(limited.sources[0]).toMatchObject({ status: 'changed', warnings: ['CANDIDATE_LIMIT'] });
    expect(await store.pendingForRun(limited.runId)).toHaveLength(2);
    expect(await sourceOutcome(store, limited.runId)).toMatchObject({
      status: 'pending',
      detail: { warnings: ['CANDIDATE_LIMIT'] },
    });
    const tooManySources = await startRegisteredWorkflow(
      store,
      config,
      () => html('$19'),
      sourceInput(sources.slice(0, 2)),
      transport,
    );
    expect(tooManySources.status).toBe('failed');
    expect(JSON.stringify(tooManySources)).toContain('SOURCE_LIMIT_EXCEEDED');
    expect(transportCalls).toBeGreaterThan(0);
    const tooMuchConcurrency = await startRegisteredWorkflow(
      store,
      config,
      () => html('$19'),
      { ...sourceInput(), policy: { sourceConcurrency: 2 } },
      transport,
    );
    expect(tooMuchConcurrency.status).toBe('failed');
    expect(JSON.stringify(tooMuchConcurrency)).toContain('EFFECTIVE_CONCURRENCY_EXCEEDED');
    const tooManyCandidates = await startRegisteredWorkflow(
      store,
      config,
      () => html('$19'),
      { ...sourceInput(), policy: { maxCandidatesPerSource: 2 } },
      transport,
    );
    expect(tooManyCandidates.status).toBe('failed');
    expect(JSON.stringify(tooManyCandidates)).toContain('EFFECTIVE_CANDIDATE_LIMIT_EXCEEDED');
    expect(() => loadConfig({ SOURCE_CONCURRENCY: '6' })).toThrow('SOURCE_CONCURRENCY');
    expect(() => loadConfig({ CANDIDATES_PER_SOURCE: '51' })).toThrow('CANDIDATES_PER_SOURCE');
  });

  it('runs the registered native workflow with an official Mastra eval gate', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'competitor-monitor-'));
    const config = loadConfig({
      MONITOR_DATABASE_URL: `file:${join(directory, 'monitor.db')}`,
      MASTRA_DATABASE_URL: `file:${join(directory, 'mastra.db')}`,
    });
    const store = MonitorStore.open(config.storage.monitorUrl);
    stores.push(store);
    const workflow = createCompetitorMonitorWorkflow({
      store,
      config,
      resolver: publicDns,
      transport: fixtureTransport(() => html('$19')),
    });
    const frameworkStore = new LibSQLStore({ id: 'test-framework', url: config.storage.mastraUrl });
    const mastra = new Mastra({
      storage: frameworkStore,
      workflows: { competitorMonitor: workflow },
    });
    const gate = createScorer({
      id: 'baseline-result',
      description: 'A baseline workflow run succeeds.',
      type: { input: z.any(), output: z.any() },
    }).generateScore(({ run }: any) => (run.output?.status === 'success' ? 1 : 0));
    try {
      const result = await expectEvals({
        target: mastra.getWorkflow('competitorMonitor'),
        data: [{ input: sourceInput() }],
        gates: [gate],
      }).toPass();
      expect(result).toPassGates();
    } finally {
      await frameworkStore.close();
    }
  });
});
