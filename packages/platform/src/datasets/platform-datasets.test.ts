import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { Dataset, DatasetsManager } from '@mastra/core/datasets';
import type { ExperimentEvent } from '@mastra/core/datasets';
import { MastraError } from '@mastra/core/error';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import { MastraPlatformError, MastraProject, PlatformDataset, PlatformDatasets } from '../index';

const PROJECT_ID = 'proj_datasets';
const ACCESS_TOKEN = 'project-token';
const MAX_RESULT_SCORES = 50;

type SubmittedResult = { itemId: string; completedAt?: string; traceId?: string; scores?: Record<string, unknown>[] };

/**
 * A stand-in for Mastra Platform's datasets API under `/v1/server/projects/:projectId`. The Platform
 * serves datasets with Mastra's own route handlers, so this mounts them on a real Mastra server.
 * Around them it reproduces the Platform's own rules: experiments created from code take no target,
 * and a result's scores (sent to observability, recorded here) need `completedAt`, at most 50.
 */
async function startPlatform() {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ logger: false, storage });
  const prefix = `/v1/server/projects/${PROJECT_ID}`;
  const submitted: SubmittedResult[] = [];
  const failSubmitFor = new Set<string>();
  const app = new Hono();

  app.use('/v1/server/projects/:projectId/*', async (c, next) => {
    if (c.req.header('authorization') !== `Bearer ${ACCESS_TOKEN}`) return c.json({ error: 'Unauthorized' }, 401);
    if (c.req.param('projectId') !== PROJECT_ID) return c.json({ error: 'Project not found' }, 404);
    return next();
  });
  app.post(`${prefix}/datasets/:datasetId/experiments`, async (c, next) => {
    const body = (await c.req.raw.clone().json()) as Record<string, unknown>;
    if ('targetType' in body || 'targetId' in body || 'scorers' in body || body.start !== false) {
      return c.json({ error: 'invalid_dataset_request' }, 400);
    }
    return next();
  });
  app.post(`${prefix}/datasets/:datasetId/experiments/:experimentId/results`, async (c, next) => {
    const body = (await c.req.raw.clone().json()) as SubmittedResult;
    if (failSubmitFor.has(body.itemId)) return c.json({ error: 'Scores could not be stored' }, 502);
    if (body.scores && (body.scores.length > MAX_RESULT_SCORES || !body.completedAt)) {
      return c.json({ error: 'invalid_dataset_request' }, 400);
    }
    submitted.push(body);
    return next();
  });
  await new MastraServer({ app, mastra, prefix }).init();

  const server = await new Promise<ServerType>(resolve => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    apiUrl: `http://127.0.0.1:${port}`,
    mastra,
    submitted,
    failSubmitFor,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

let platform: Awaited<ReturnType<typeof startPlatform>>;
let project: MastraProject;

beforeAll(async () => {
  platform = await startPlatform();
});

afterAll(async () => {
  await platform.close();
});

afterEach(() => {
  platform.submitted.length = 0;
  platform.failSubmitFor.clear();
});

beforeAll(() => {
  project = new MastraProject({ accessToken: ACCESS_TOKEN, projectId: PROJECT_ID, apiUrl: platform.apiUrl });
});

const exactMatch = createScorer({ id: 'exact-match', description: 'Output equals the ground truth' }).generateScore(
  ({ run }) => (run.output === run.groundTruth ? 1 : 0),
);

async function expectMastraError(promise: Promise<unknown>, id: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(MastraError);
  expect((error as MastraError).id).toBe(id);
}

async function expectRefusal(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(MastraPlatformError);
  expect(error).toMatchObject({ status: 400, body: { code } });
}

function publicMethods(prototype: object): string[] {
  return Object.getOwnPropertyNames(prototype).filter(
    name => name !== 'constructor' && typeof Object.getOwnPropertyDescriptor(prototype, name)?.value === 'function',
  );
}

describe('PlatformDatasets', () => {
  it('overrides every public method of core Dataset and DatasetsManager', () => {
    // An inherited method would run core's storage code against an empty in-memory store.
    for (const [base, platformClass] of [
      [Dataset.prototype, PlatformDataset.prototype],
      [DatasetsManager.prototype, PlatformDatasets.prototype],
    ] as const) {
      const missing = publicMethods(base).filter(name => !Object.prototype.hasOwnProperty.call(platformClass, name));
      expect(missing).toEqual([]);
    }
  });

  it('is a drop-in for mastra.datasets and Dataset in user code', async () => {
    expectTypeOf(project.datasets).toMatchTypeOf<Pick<Mastra, 'datasets'>['datasets']>();
    const lab: Pick<Mastra, 'datasets'> = { datasets: project.datasets };
    const dataset: Dataset = await lab.datasets.create({ name: 'drop-in' });
    expect(dataset).toBeInstanceOf(PlatformDataset);
    expect(dataset).toBeInstanceOf(Dataset);
    await lab.datasets.delete({ id: dataset.id });
  });

  it('creates, reads, updates, lists and deletes datasets with core types', async () => {
    const dataset = await project.datasets.create({
      name: 'Billing questions',
      description: 'Support evals',
      metadata: { split: 'dev' },
      inputSchema: z.object({ question: z.string() }),
    });

    const details = await (await project.datasets.get({ id: dataset.id })).getDetails();
    expect(details).toMatchObject({ id: dataset.id, name: 'Billing questions', metadata: { split: 'dev' } });
    expect(details.createdAt).toBeInstanceOf(Date);
    expect(details.inputSchema).toMatchObject({ type: 'object', properties: { question: { type: 'string' } } });
    // The stored record is the one the Platform's handlers wrote.
    const stored = await (await platform.mastra.getStorage()!.getStore('datasets'))!.getDatasetById({ id: dataset.id });
    expect(stored?.name).toBe('Billing questions');

    const updated = await dataset.update({ description: 'Billing evals', metadata: { split: 'test' } });
    expect(updated).toMatchObject({ description: 'Billing evals', metadata: { split: 'test' } });
    expect(updated.updatedAt).toBeInstanceOf(Date);

    const listed = await project.datasets.list({ filters: { name: 'BILLING' } });
    expect(listed.datasets.map(d => d.id)).toEqual([dataset.id]);
    expect(listed.datasets[0]!.createdAt).toBeInstanceOf(Date);

    await project.datasets.delete({ id: dataset.id });
    await expectMastraError(project.datasets.get({ id: dataset.id }), 'DATASET_NOT_FOUND');
  });

  it('pages through every dataset for perPage: false and filters that match on this side', async () => {
    const created = await Promise.all(
      Array.from({ length: 105 }, (_, i) => project.datasets.create({ name: `paging-${String(i).padStart(3, '0')}` })),
    );
    try {
      const all = await project.datasets.list({ perPage: false, filters: { name: 'paging-' } });
      expect(all.datasets).toHaveLength(105);
      expect(all.pagination).toMatchObject({ total: 105, perPage: false, hasMore: false });

      const someIds = [created[3]!.id, created[104]!.id];
      const byId = await project.datasets.list({ filters: { datasetIds: someIds } });
      expect(byId.datasets.map(d => d.id).sort()).toEqual([...someIds].sort());

      const secondPage = await project.datasets.list({ page: 1, perPage: 50, filters: { name: 'paging-' } });
      expect(secondPage.datasets).toHaveLength(50);
      expect(secondPage.pagination).toMatchObject({ total: 105, page: 1, perPage: 50, hasMore: true });
    } finally {
      await Promise.all(created.map(d => project.datasets.delete({ id: d.id })));
    }
  });

  it('manages items, versions and item history', async () => {
    const dataset = await project.datasets.create({ name: 'items' });
    const first = await dataset.addItem({ input: { question: 'Where is my invoice?' }, groundTruth: 'Billing' });
    expect(first.createdAt).toBeInstanceOf(Date);
    const batch = await dataset.addItems({
      items: Array.from({ length: 120 }, (_, i) => ({ input: { question: `q${i}` }, externalId: `ext-${i}` })),
    });
    expect(batch).toHaveLength(120);

    const { version } = await dataset.getDetails();
    // A version on its own returns every item at that version, past the first page.
    const all = await dataset.listItems({ version });
    expect(Array.isArray(all) && all.length).toBe(121);

    const page = await dataset.listItems({ page: 0, perPage: 10 });
    expect(Array.isArray(page)).toBe(false);
    expect(!Array.isArray(page) && page.items).toHaveLength(10);
    expect(!Array.isArray(page) && page.pagination).toMatchObject({ total: 121, hasMore: true });

    const updatedItem = await dataset.updateItem({ itemId: first.id, groundTruth: 'Billing > Invoices' });
    expect(updatedItem.groundTruth).toBe('Billing > Invoices');
    expect((await dataset.getItem({ itemId: first.id }))?.groundTruth).toBe('Billing > Invoices');
    expect((await dataset.getItem({ itemId: first.id, version: first.datasetVersion }))?.groundTruth).toBe('Billing');
    expect(await dataset.getItem({ itemId: 'missing' })).toBeNull();

    const history = await dataset.getItemHistory({ itemId: first.id });
    expect(history.map(row => row.groundTruth)).toEqual(expect.arrayContaining(['Billing', 'Billing > Invoices']));
    expect(history[0]!.createdAt).toBeInstanceOf(Date);

    const versions = await dataset.listVersions();
    expect(versions.versions.length).toBeGreaterThanOrEqual(3);
    expect(versions.versions[0]!.createdAt).toBeInstanceOf(Date);

    await dataset.deleteItem({ itemId: batch[0]!.id });
    await dataset.deleteItems({ itemIds: [batch[1]!.id, batch[2]!.id] });
    const remaining = await dataset.listItems({ version: (await dataset.getDetails()).version });
    expect(Array.isArray(remaining) && remaining.length).toBe(118);
    // Purging keeps the item's identity and scrubs what the user stored in it.
    await dataset.purgeItem({ itemId: batch[3]!.id });
    expect((await dataset.getItem({ itemId: batch[3]!.id }))?.input).not.toEqual({ question: 'q3' });

    await project.datasets.delete({ id: dataset.id });
  });

  it('refuses options and methods the Platform cannot honor instead of dropping them', async () => {
    await expectRefusal(
      project.datasets.create({ id: 'gold-dev', name: 'gold' }),
      'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    );
    await expectRefusal(
      project.datasets.list({ filters: { organizationId: 'org_1' } }),
      'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    );
    await expectRefusal(project.datasets.compareExperiments(), 'PLATFORM_DATASETS_UNSUPPORTED_METHOD');

    const dataset = await project.datasets.create({ name: 'refusals' });
    await expectRefusal(
      dataset.createExperiment({ targetType: 'agent', targetId: 'support' }),
      'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    );
    await expectRefusal(dataset.listExperiments({ status: 'completed' }), 'PLATFORM_DATASETS_UNSUPPORTED_OPTION');
    await expectRefusal(dataset.startExperimentAsync(), 'PLATFORM_DATASETS_UNSUPPORTED_METHOD');
    await expectRefusal(dataset.runExperimentItem(), 'PLATFORM_DATASETS_UNSUPPORTED_METHOD');
    await expectRefusal(
      dataset.startExperiment({ targetType: 'agent', targetId: 'support' }),
      'PLATFORM_DATASETS_MASTRA_REQUIRED',
    );
    await project.datasets.delete({ id: dataset.id });
  });
});

describe('experiments uploaded from code', () => {
  // The call sequence of intelligence-research's lab driver (lab/driver.ts), which runs items
  // itself and submits results with a score per taxonomy tag.
  it('runs the lab driver sequence: create, submit with scores and errors, finalize, label, list', async () => {
    const dataset = await project.datasets.create({ name: 'issues-gold-v2-dev' });
    await dataset.addItems({
      items: [
        { input: { traceId: 't1', project: 'shipyard' }, groundTruth: { tags: ['missing-tool'] } },
        { input: { traceId: 't2', project: 'vox' }, groundTruth: { tags: [] } },
      ],
    });

    const lab = { datasets: project.datasets } satisfies Pick<Mastra, 'datasets'>;
    const ds = await lab.datasets.get({ id: dataset.id });
    const details = await ds.getDetails();
    const items = await ds.listItems({ version: details.version });
    if (!Array.isArray(items)) throw new Error('expected the version snapshot');

    const { experimentId, datasetVersion } = await ds.createExperiment({
      name: 'missing-tool baseline',
      description: 'trial 0',
      metadata: { model: 'openai/gpt-5-mini' },
      provenance: { source: 'tracelab-lab', sourceId: 'mastra-ai/intelligence-research', sourceVersion: 'abc123' },
      grouping: { experimentSetId: 'set-1', comparisonId: 'cmp-1', variantId: 'baseline', trialIndex: 0 },
      version: details.version,
    });
    expect(datasetVersion).toBe(details.version);

    const scores = [
      { scorerId: 'root-match', score: 1 },
      { scorerId: 'fix-area-match', score: 0, reason: 'different area' },
      ...Array.from({ length: 20 }, (_, i) => ({ scorerId: `tag-acc:tag-${i}`, score: i % 2 })),
    ];
    const startedAt = new Date();
    const result = await ds.submitExperimentResult({
      experimentId,
      itemId: items[0]!.id,
      output: { tags: ['missing-tool'] },
      scores,
      startedAt,
      completedAt: new Date(),
    });
    expect(result.startedAt).toBeInstanceOf(Date);
    // The Platform's refusal reaches the caller with its status and body.
    const tooMany = await ds
      .submitExperimentResult({
        experimentId,
        itemId: items[1]!.id,
        scores: Array.from({ length: 51 }, (_, i) => ({ scorerId: `s-${i}`, score: 1 })),
        completedAt: new Date(),
      })
      .catch((e: unknown) => e);
    expect(tooMany).toBeInstanceOf(MastraPlatformError);
    expect(tooMany).toMatchObject({ status: 400, body: { error: 'invalid_dataset_request' } });
    await ds.submitExperimentResult({
      experimentId,
      itemId: items[1]!.id,
      error: { message: 'judge timed out' },
      startedAt,
      completedAt: new Date(),
    });
    expect(platform.submitted[0]!.scores).toHaveLength(22);

    const finalized = await ds.finalizeExperiment({ experimentId });
    expect(finalized).toMatchObject({ status: 'completed', succeededCount: 1, failedCount: 1, skippedCount: 0 });
    expect(finalized.completedAt).toBeInstanceOf(Date);

    const labelled = await ds.updateExperiment({ experimentId, metadata: { submitted: 2, usd: 0.12 } });
    expect(labelled.metadata).toEqual({ submitted: 2, usd: 0.12 });

    const sameComparison = await ds.listExperiments({ comparisonId: 'cmp-1' });
    expect(sameComparison.experiments.map(e => e.id)).toEqual([experimentId]);
    expect(sameComparison.experiments[0]).toMatchObject({ variantId: 'baseline', targetType: null });

    const results = await ds.listExperimentResults({ experimentId });
    expect(results.results).toHaveLength(2);
    expect(results.results.find(r => r.itemId === items[1]!.id)?.error).toEqual({ message: 'judge timed out' });

    const reviewed = await ds.updateExperimentResult({
      id: results.results[0]!.id,
      experimentId,
      status: 'reviewed',
      tags: ['checked'],
    });
    expect(reviewed).toMatchObject({ status: 'reviewed', tags: ['checked'] });

    expect((await project.datasets.getExperiment({ experimentId }))?.id).toBe(experimentId);
    expect(await ds.getExperiment({ experimentId: 'missing' })).toBeNull();
    await ds.deleteExperiment({ experimentId });
    expect(await project.datasets.getExperiment({ experimentId })).toBeNull();
    await project.datasets.delete({ id: dataset.id });
  });

  it('startExperiment runs the task here and uploads each result with its scores', async () => {
    const dataset = await project.datasets.create({ name: 'arithmetic' });
    await dataset.addItems({
      items: [
        { input: '2 + 2', groundTruth: '4' },
        { input: '3 + 3', groundTruth: '6' },
        { input: 'divide by zero', groundTruth: 'error' },
      ],
    });
    const local = new Mastra({ logger: false, storage: new InMemoryStore() });
    const events: ExperimentEvent['type'][] = [];

    const summary = await dataset.startExperiment({
      mastra: local,
      name: 'calculator v1',
      metadata: { model: 'calc' },
      scorers: [exactMatch],
      task: async ({ input }) => {
        if (input === 'divide by zero') throw new Error('cannot divide by zero');
        return input === '2 + 2' ? '4' : '7';
      },
      onEvent: event => {
        events.push(event.type);
      },
    });

    expect(summary).toMatchObject({ status: 'completed', succeededCount: 2, failedCount: 1, persistenceFailures: 0 });
    expect(events.filter(type => type === 'experiment.item.completed')).toHaveLength(3);

    // What reached the Platform: three results, scored items carrying their scores.
    const byInput = (input: string) =>
      platform.submitted.find(r => (r as { input?: unknown }).input === input) as Record<string, unknown>;
    expect(platform.submitted).toHaveLength(3);
    expect(byInput('2 + 2')).toMatchObject({ output: '4', scores: [{ scorerId: 'exact-match', score: 1 }] });
    expect(byInput('3 + 3')).toMatchObject({ output: '7', scores: [{ scorerId: 'exact-match', score: 0 }] });
    expect(byInput('divide by zero')).toMatchObject({ error: { message: 'cannot divide by zero' } });
    expect(byInput('divide by zero').error).not.toHaveProperty('stack');

    const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
    expect(experiment).toMatchObject({
      name: 'calculator v1',
      metadata: { model: 'calc' },
      status: 'completed',
      succeededCount: 2,
      failedCount: 1,
      targetType: null,
    });
    const { results } = await dataset.listExperimentResults({ experimentId: summary.experimentId });
    expect(results).toHaveLength(3);

    // Nothing was written to the local Mastra's storage.
    const localExperiments = await (await local.getStorage()!.getStore('experiments'))!.listExperiments({
      pagination: { page: 0, perPage: 10 },
    });
    expect(localExperiments.experiments).toEqual([]);
    await project.datasets.delete({ id: dataset.id });
  });

  it('startExperiment runs a target registered on the given Mastra and records it in metadata', async () => {
    const dataset = await project.datasets.create({ name: 'support' });
    await dataset.addItem({ input: 'Where is my invoice?', groundTruth: 'Billing > Invoices' });
    const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const model = new MockLanguageModelV2({
      doGenerate: async () => ({
        finishReason: 'stop',
        usage,
        content: [{ type: 'text', text: 'Billing > Invoices' }],
        warnings: [],
      }),
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: 'Billing > Invoices' },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage },
        ] as never[]),
      }),
    });
    const support = new Agent({ id: 'support', name: 'Support', instructions: 'Answer billing questions', model });
    const local = new Mastra({ logger: false, agents: { support } });

    const summary = await dataset.startExperiment({ mastra: local, targetType: 'agent', targetId: 'support' });

    expect(summary.results[0]?.error).toBeNull();
    expect(summary).toMatchObject({ status: 'completed', succeededCount: 1 });
    expect(JSON.stringify(platform.submitted[0])).toContain('Billing > Invoices');
    const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
    expect(experiment?.metadata).toEqual({ target: { type: 'agent', id: 'support' } });
    await project.datasets.delete({ id: dataset.id });
  });

  it('startExperiment counts a failed upload, keeps running, and still finalizes', async () => {
    const dataset = await project.datasets.create({ name: 'flaky uploads' });
    const [kept, dropped] = await dataset.addItems({
      items: [
        { input: 'a', groundTruth: 'a' },
        { input: 'b', groundTruth: 'b' },
      ],
    });
    platform.failSubmitFor.add(dropped!.id);

    const summary = await dataset.startExperiment({ task: ({ input }) => input, scorers: [exactMatch] });

    expect(summary).toMatchObject({ status: 'completed', succeededCount: 2, persistenceFailures: 1 });
    expect(summary.results.find(r => r.itemId === dropped!.id)?.persistenceError?.message).toContain('502');
    expect(summary.results.find(r => r.itemId === kept!.id)?.persistenceError).toBeNull();
    const experiment = await dataset.getExperiment({ experimentId: summary.experimentId });
    expect(experiment).toMatchObject({ status: 'completed', succeededCount: 1, skippedCount: 1 });
    await project.datasets.delete({ id: dataset.id });
  });
});
