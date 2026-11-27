import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Dataset, DatasetsManager } from '@mastra/core/datasets';
import { MastraError } from '@mastra/core/error';
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
 * a result's scores (sent to observability, recorded here) need `completedAt`, at most 50, and a
 * comparison only takes experiments of the dataset it's asked under.
 */
async function startPlatform() {
  const storage = new InMemoryStore();
  const mastra = new Mastra({ logger: false, storage });
  const prefix = `/v1/server/projects/${PROJECT_ID}`;
  const submitted: SubmittedResult[] = [];
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
    if (body.scores && (body.scores.length > MAX_RESULT_SCORES || !body.completedAt)) {
      return c.json({ error: 'invalid_dataset_request' }, 400);
    }
    submitted.push(body);
    return next();
  });
  app.post(`${prefix}/datasets/:datasetId/compare`, async (c, next) => {
    const { experimentIds } = (await c.req.raw.clone().json()) as { experimentIds: string[] };
    const experiments = await Promise.all(
      experimentIds.map(experimentId => mastra.datasets.getExperiment({ experimentId })),
    );
    if (experiments.some(experiment => experiment?.datasetId !== c.req.param('datasetId'))) {
      return c.json({ error: 'Experiment not found' }, 404);
    }
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
});

beforeAll(() => {
  project = new MastraProject({ accessToken: ACCESS_TOKEN, projectId: PROJECT_ID, apiUrl: platform.apiUrl });
});

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

  it('compares experiments of a dataset item by item, against the baseline', async () => {
    const dataset = await project.datasets.create({ name: 'passwords' });
    const [reset, refund] = await dataset.addItems({
      items: [
        { input: 'How do I reset my password?', groundTruth: 'Account > Password' },
        { input: 'Where is my refund?', groundTruth: 'Billing > Refunds' },
      ],
    });
    const run = async (name: string, answers: [string, string]) => {
      const { experimentId } = await dataset.createExperiment({ name });
      for (const [item, output] of [
        [reset!, answers[0]],
        [refund!, answers[1]],
      ] as const) {
        await dataset.submitExperimentResult({ experimentId, itemId: item.id, output });
      }
      await dataset.finalizeExperiment({ experimentId });
      return experimentId;
    };
    const terse = await run('terse', ['Account > Password', 'Billing']);
    const exact = await run('exact', ['Account > Password', 'Billing > Refunds']);

    const comparison = await project.datasets.compareExperiments({ experimentIds: [terse, exact] });

    expect(comparison.baselineId).toBe(terse);
    const refundRow = comparison.items.find(item => item.itemId === refund!.id);
    expect(refundRow).toMatchObject({
      input: 'Where is my refund?',
      groundTruth: 'Billing > Refunds',
      results: { [terse]: { output: 'Billing' }, [exact]: { output: 'Billing > Refunds' } },
    });

    const swapped = await project.datasets.compareExperiments({ experimentIds: [terse, exact], baselineId: exact });
    expect(swapped.baselineId).toBe(exact);

    await project.datasets.delete({ id: dataset.id });
  });

  it('refuses to compare fewer than two experiments, or experiments it cannot find', async () => {
    const dataset = await project.datasets.create({ name: 'compare errors' });
    const other = await project.datasets.create({ name: 'compare errors, other dataset' });
    await dataset.addItem({ input: 'a' });
    await other.addItem({ input: 'b' });
    const { experimentId } = await dataset.createExperiment({ name: 'one' });
    const { experimentId: elsewhere } = await other.createExperiment({ name: 'elsewhere' });

    await expectMastraError(
      project.datasets.compareExperiments({ experimentIds: [experimentId, experimentId] }),
      'COMPARE_INVALID_INPUT',
    );
    await expectMastraError(
      project.datasets.compareExperiments({ experimentIds: [experimentId, elsewhere], baselineId: 'missing' }),
      'COMPARE_INVALID_INPUT',
    );
    await expectMastraError(
      project.datasets.compareExperiments({ experimentIds: ['missing', experimentId] }),
      'EXPERIMENT_NOT_FOUND',
    );
    await expectMastraError(
      project.datasets.compareExperiments({ experimentIds: [experimentId, elsewhere] }),
      'EXPERIMENT_NOT_FOUND',
    );

    await project.datasets.delete({ id: dataset.id });
    await project.datasets.delete({ id: other.id });
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
    await expectRefusal(
      project.datasets.compareExperiments({ experimentIds: ['a', 'b'], projectId: 'proj_other' }),
      'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    );

    const dataset = await project.datasets.create({ name: 'refusals' });
    await expectRefusal(
      dataset.createExperiment({ targetType: 'agent', targetId: 'support' }),
      'PLATFORM_DATASETS_UNSUPPORTED_OPTION',
    );
    await expectRefusal(dataset.listExperiments({ status: 'completed' }), 'PLATFORM_DATASETS_UNSUPPORTED_OPTION');
    await expectRefusal(
      dataset.startExperiment({ task: ({ input }) => input }),
      'PLATFORM_DATASETS_UNSUPPORTED_METHOD',
    );
    await expectRefusal(dataset.startExperimentAsync(), 'PLATFORM_DATASETS_UNSUPPORTED_METHOD');
    await expectRefusal(dataset.runExperimentItem(), 'PLATFORM_DATASETS_UNSUPPORTED_METHOD');
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
});
