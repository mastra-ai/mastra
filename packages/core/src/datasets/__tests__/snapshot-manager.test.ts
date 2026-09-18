import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { createScorer } from '../../evals';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Dataset } from '../dataset';
import { createDatasetSnapshot } from '../snapshot';

function fixture() {
  return createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: '00000000-0000-4000-8000-000000000001',
    configuration: {
      name: 'Lookup',
      targetType: 'workflow',
      targetIds: ['source-lookup'],
      scorerIds: ['source-accuracy'],
    },
    items: [
      {
        itemIdentity: '00000000-0000-4000-8000-000000000002',
        createdAt: '2020-01-01T01:02:03.456Z',
        updatedAt: '2021-01-01T01:02:03.456Z',
        payload: { input: null, groundTruth: null, scorerIds: ['source-accuracy'], metadata: { authored: true } },
      },
    ],
    provenance: {
      sourceDatasetId: 'original',
      itemVersion: 9,
      exportedAt: '2026-09-17T12:00:00Z',
      configurationBasis: 'export-time',
    },
  });
}

function destination() {
  const workflow = createWorkflow({ id: 'destination-lookup', inputSchema: z.unknown(), outputSchema: z.unknown() })
    .then(
      createStep({
        id: 'echo',
        inputSchema: z.unknown(),
        outputSchema: z.unknown(),
        execute: async ({ inputData }) => inputData,
      }),
    )
    .commit();
  const scorer = createScorer({
    id: 'destination-accuracy',
    name: 'Accuracy',
    description: 'Test snapshot registration checks',
  }).generateScore(() => 1);
  const mastra = new Mastra({
    storage: new InMemoryStore(),
    workflows: { lookup: workflow },
    scorers: { accuracy: scorer },
  });
  return { mastra, scorer };
}

const mappings = {
  targetMappings: [{ from: 'source-lookup', to: 'destination-lookup' }],
  scorerMappings: [{ from: 'source-accuracy', to: 'destination-accuracy' }],
};

describe('public dataset snapshot transfer', () => {
  it('exports and imports between Mastra instances while preserving values, timestamps and lineage', async () => {
    const source = new Mastra({ storage: new InMemoryStore() });
    const target = new Mastra({ storage: new InMemoryStore() });
    const dataset = await source.datasets.create({
      name: 'Cases',
      organizationId: 'source',
      inputSchema: z.string().nullable(),
    });
    await dataset.addItem({ input: null, groundTruth: null, requestContext: { locale: 'fr' } });
    await dataset.addItem({ input: 'missing' });
    const artifact = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
    const request = {
      snapshot: JSON.stringify(artifact),
      idempotencyKey: 'release',
      destination: { organizationId: 'target' },
    };
    expect(await target.datasets.preflightSnapshot(request)).toMatchObject({
      canImport: true,
      errors: [],
      itemCount: 2,
    });
    expect((await target.datasets.list()).datasets).toEqual([]);
    const imported = await target.datasets.importSnapshot(request);
    const copied = await target.datasets.get({ id: imported.receipt.datasetId, organizationId: 'target' });
    const exported = await copied.exportSnapshot({ acknowledgeSensitiveData: true });
    expect(exported.datasetIdentity).toBe(artifact.datasetIdentity);
    expect(exported.configuration).toEqual(artifact.configuration);
    expect(exported.items).toEqual(expect.arrayContaining(artifact.items));
    expect(exported.items).toHaveLength(2);
    expect(await target.datasets.getSnapshotImport({ idempotencyKey: 'release', organizationId: 'target' })).toEqual(
      imported,
    );
    await expect(
      new Dataset(dataset.id, source, { organizationId: 'other' }).exportSnapshot({ acknowledgeSensitiveData: true }),
    ).rejects.toThrow('Dataset not found');
  });

  it('reports unresolved references and refuses a new import without writing a dataset or receipt', async () => {
    const mastra = new Mastra({ storage: new InMemoryStore() });
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'missing' };
    expect(await mastra.datasets.preflightSnapshot(request)).toMatchObject({
      canImport: false,
      errors: [
        { kind: 'target', id: 'source-lookup' },
        { kind: 'scorer', id: 'source-accuracy' },
      ],
    });
    await expect(mastra.datasets.importSnapshot(request)).rejects.toThrow('references are unavailable');
    expect((await mastra.datasets.list()).datasets).toEqual([]);
    expect(await mastra.datasets.getSnapshotImport({ idempotencyKey: 'missing' })).toBeNull();
  });

  it('applies explicit mappings to configuration and overrides and rechecks registration at import', async () => {
    const { mastra, scorer } = destination();
    const artifact = fixture();
    const request = { snapshot: JSON.stringify(artifact), idempotencyKey: 'mapped', ...mappings };
    expect(await mastra.datasets.preflightSnapshot(request)).toMatchObject({ canImport: true });
    mastra.removeScorer('destination-accuracy');
    await expect(mastra.datasets.importSnapshot(request)).rejects.toThrow('references are unavailable');
    expect(await mastra.datasets.getSnapshotImport({ idempotencyKey: 'mapped' })).toBeNull();
    mastra.addScorer(scorer);
    const result = await mastra.datasets.importSnapshot(request);
    const dataset = await mastra.datasets.get({ id: result.receipt.datasetId });
    const copy = await dataset.exportSnapshot({ acknowledgeSensitiveData: true });
    expect(copy.configuration.targetIds).toEqual(['destination-lookup']);
    expect(copy.configuration.scorerIds).toEqual(['destination-accuracy']);
    expect(copy.items[0]!.payload.scorerIds).toEqual(['destination-accuracy']);
    expect(copy.items[0]!.createdAt).toBe(artifact.items[0]!.createdAt);
    expect(artifact.configuration.targetIds).toEqual(['source-lookup']);
    expect(result.receipt.targetMappings).toEqual(mappings.targetMappings);
    expect(result.receipt.scorerMappings).toEqual(mappings.scorerMappings);
  });

  it('resolves scorer targets through the scorer registry', async () => {
    const { mastra } = destination();
    const { digest: _digest, ...content } = fixture();
    content.configuration.targetType = 'scorer';
    content.configuration.targetIds = ['source-accuracy'];
    const request = {
      snapshot: JSON.stringify(createDatasetSnapshot(content)),
      idempotencyKey: 'scorer-target',
      targetMappings: [{ from: 'source-accuracy', to: 'destination-accuracy' }],
      scorerMappings: mappings.scorerMappings,
    };
    expect(await mastra.datasets.preflightSnapshot(request)).toMatchObject({ canImport: true, errors: [] });
    const imported = await mastra.datasets.importSnapshot(request);
    const dataset = await mastra.datasets.get({ id: imported.receipt.datasetId });
    expect((await dataset.exportSnapshot({ acknowledgeSensitiveData: true })).configuration).toMatchObject({
      targetType: 'scorer',
      targetIds: ['destination-accuracy'],
    });
  });

  it.each([
    ['agent', 'agents', 'registered-agent'],
    ['workflow', 'workflows', 'registered-workflow'],
    ['scorer', 'scorers', 'registered-scorer'],
    ['processor', 'processors', 'registered-processor'],
  ] as const)('resolves %s targets by registry key and by id', async (targetType, registryOption, id) => {
    const registered =
      targetType === 'agent'
        ? new Agent({ id, name: 'Registered', instructions: 'noop', model: 'openai/gpt-4o-mini' })
        : targetType === 'workflow'
          ? createWorkflow({ id, inputSchema: z.unknown(), outputSchema: z.unknown() }).commit()
          : targetType === 'scorer'
            ? createScorer({ id, name: 'Registered', description: 'Registered' }).generateScore(() => 1)
            : { id, name: 'Registered', processInput: async ({ messages }: { messages: unknown }) => messages };
    const mastra = new Mastra({
      storage: new InMemoryStore(),
      [registryOption]: { registryKey: registered },
    } as never);
    const { digest: _digest, ...content } = fixture();
    content.configuration = { ...content.configuration, targetType, targetIds: ['registryKey', id], scorerIds: [] };
    content.items = [];
    const request = { snapshot: JSON.stringify(createDatasetSnapshot(content)), idempotencyKey: `by-${targetType}` };
    expect(await mastra.datasets.preflightSnapshot(request)).toMatchObject({ canImport: true, errors: [] });
    const imported = await mastra.datasets.importSnapshot(request);
    const dataset = await mastra.datasets.get({ id: imported.receipt.datasetId });
    expect((await dataset.exportSnapshot({ acknowledgeSensitiveData: true })).configuration).toMatchObject({
      targetType,
      targetIds: ['registryKey', id],
    });
    const unknown = { ...request, idempotencyKey: `unknown-${targetType}` };
    content.configuration.targetIds = ['unregistered'];
    unknown.snapshot = JSON.stringify(createDatasetSnapshot(content));
    expect(await mastra.datasets.preflightSnapshot(unknown)).toMatchObject({
      canImport: false,
      errors: [{ kind: 'target', id: 'unregistered' }],
    });
  });

  it('recovers completed imports even after registry removal or destination deletion, without making another copy', async () => {
    const { mastra } = destination();
    const request = { snapshot: JSON.stringify(fixture()), idempotencyKey: 'replay', ...mappings };
    const imported = await mastra.datasets.importSnapshot(request);
    mastra.removeScorer('destination-accuracy');
    mastra.removeWorkflow('destination-lookup');
    expect(await mastra.datasets.importSnapshot(request)).toEqual(imported);
    await expect(mastra.datasets.importSnapshot({ ...request, destination: { name: 'Different' } })).rejects.toThrow(
      'already used',
    );
    await mastra.datasets.delete({ id: imported.receipt.datasetId });
    expect(await mastra.datasets.importSnapshot(request)).toEqual({ ...imported, datasetExists: false });
    expect((await mastra.datasets.list()).datasets).toEqual([]);
  });

  it('captures request options before asynchronous preflight so caller mutation cannot bypass reference checks', async () => {
    const { mastra } = destination();
    const request = {
      snapshot: JSON.stringify(fixture()),
      idempotencyKey: 'immutable',
      targetMappings: mappings.targetMappings.map(item => ({ ...item })),
      scorerMappings: mappings.scorerMappings.map(item => ({ ...item })),
    };
    const importing = mastra.datasets.importSnapshot(request);
    request.targetMappings[0]!.to = 'unregistered';
    const result = await importing;
    const dataset = await mastra.datasets.get({ id: result.receipt.datasetId });
    expect((await dataset.exportSnapshot({ acknowledgeSensitiveData: true })).configuration.targetIds).toEqual([
      'destination-lookup',
    ]);
  });
});
