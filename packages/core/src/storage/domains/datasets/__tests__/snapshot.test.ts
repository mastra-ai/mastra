import { describe, expect, it } from 'vitest';
import { createDatasetSnapshot, parseDatasetSnapshot } from '../../../../datasets/snapshot';
import { prepareDatasetSnapshotImport } from '../../../../datasets/snapshot-transfer';
import {
  captureDatasetSnapshot,
  planDatasetSnapshotImport,
  validateDatasetSnapshotSchemas,
  verifyDatasetSnapshotReceipt,
  verifyDatasetSnapshotImport,
} from '../snapshot';

function source() {
  return createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: '00000000-0000-4000-8000-000000000001',
    configuration: {
      name: 'Lookup cases',
      inputSchema: { type: ['object', 'null'] },
      groundTruthSchema: { type: ['object', 'null'] },
      requestContextSchema: { type: 'object', properties: { tenant: { type: 'string' } }, required: ['tenant'] },
      tags: [],
      scorerIds: [],
      metadata: { authored: true },
    },
    items: [
      {
        itemIdentity: '00000000-0000-4000-8000-000000000002',
        createdAt: '2020-01-01T01:02:03.456Z',
        updatedAt: '2021-02-03T04:05:06.789Z',
        payload: {
          input: null,
          groundTruth: null,
          expectedTrajectory: null,
          requestContext: { tenant: 'a' },
          scorerIds: [],
          metadata: {},
        },
      },
    ],
    provenance: {
      exportedAt: '2026-09-17T12:00:00Z',
      sourceDatasetId: 'original-id',
      itemVersion: 25,
      configurationBasis: 'export-time',
    },
  });
}

function prepare(snapshot = source()) {
  return prepareDatasetSnapshotImport(JSON.stringify(snapshot), {
    idempotencyKey: 'release-1',
    destination: { organizationId: 'destination-org', projectId: 'destination-project' },
  });
}

describe('snapshot storage planning', () => {
  it('verifies timestamps, payloads, ownership and identity mappings from persisted records', () => {
    const plan = planDatasetSnapshotImport(prepare());
    expect(() => verifyDatasetSnapshotImport(plan, structuredClone(plan))).not.toThrow();
    const withoutGroundTruth = structuredClone(plan);
    delete withoutGroundTruth.items[0]!.groundTruth;
    expect(() => verifyDatasetSnapshotImport(plan, withoutGroundTruth)).toThrow('did not preserve');
    const timestampChanged = structuredClone(plan);
    timestampChanged.items[0]!.updatedAt = new Date();
    expect(() => verifyDatasetSnapshotImport(plan, timestampChanged)).toThrow('did not preserve');
    const wrongTenant = structuredClone(plan);
    wrongTenant.items[0]!.organizationId = 'wrong';
    expect(() => verifyDatasetSnapshotImport(plan, wrongTenant)).toThrow('did not preserve');
    const missingIdentity = structuredClone(plan);
    missingIdentity.identities.pop();
    expect(() => verifyDatasetSnapshotImport(plan, missingIdentity)).toThrow('did not preserve');
  });

  it('does not erase null optional payload fields when verifying storage fidelity', () => {
    const plan = planDatasetSnapshotImport(prepare());
    plan.items[0]!.metadata = null;
    const persisted = structuredClone(plan);
    delete persisted.items[0]!.metadata;
    expect(() => verifyDatasetSnapshotImport(plan, persisted)).toThrow('did not preserve');
  });
  it('preserves source item timestamps, authored nulls, empty overrides and portable lineage', () => {
    const snapshot = source();
    const plan = planDatasetSnapshotImport(prepare(snapshot));
    expect(plan.dataset.id).not.toBe(snapshot.provenance.sourceDatasetId);
    expect(plan.dataset.version).toBe(1);
    expect(plan.items[0]).toMatchObject({
      datasetId: plan.dataset.id,
      datasetVersion: 1,
      organizationId: 'destination-org',
      projectId: 'destination-project',
      createdAt: new Date(snapshot.items[0]!.createdAt),
      updatedAt: new Date(snapshot.items[0]!.updatedAt),
      input: null,
      groundTruth: null,
      expectedTrajectory: null,
      scorerIds: [],
      metadata: {},
    });
    expect(plan.items[0]).not.toHaveProperty('externalId');
    const exported = captureDatasetSnapshot({
      dataset: plan.dataset,
      items: plan.items,
      identities: plan.identities,
      version: 1,
    });
    expect(exported.adopted).toEqual([]);
    expect(exported.snapshot.datasetIdentity).toBe(snapshot.datasetIdentity);
    expect(exported.snapshot.configuration).toEqual(snapshot.configuration);
    expect(exported.snapshot.items).toEqual(snapshot.items);
    expect(parseDatasetSnapshot(JSON.stringify(exported.snapshot))).toEqual(exported.snapshot);
  });

  it('adopts identities without mutating the supplied records or re-adopting known identities', () => {
    const plan = planDatasetSnapshotImport(prepare());
    const before = structuredClone(plan);
    const first = captureDatasetSnapshot({ dataset: plan.dataset, items: plan.items, identities: [], version: 1 });
    expect(first.adopted).toHaveLength(2);
    expect(plan).toEqual(before);
    const second = captureDatasetSnapshot({
      dataset: plan.dataset,
      items: plan.items,
      identities: first.adopted,
      version: 1,
    });
    expect(second.adopted).toEqual([]);
    expect(second.snapshot.datasetIdentity).toBe(first.snapshot.datasetIdentity);
    expect(second.snapshot.items).toEqual(first.snapshot.items);
  });

  it('assigns new destination IDs to deliberate copies without changing portable identities', () => {
    const prepared = prepare();
    const a = planDatasetSnapshotImport(prepared);
    const b = planDatasetSnapshotImport(prepared);
    expect(a.dataset.id).not.toBe(b.dataset.id);
    expect(a.items[0]!.id).not.toBe(b.items[0]!.id);
    expect(a.identities.map(identity => identity.portableId)).toEqual(
      b.identities.map(identity => identity.portableId),
    );
  });

  it('uses the existing initial version convention for empty imports', () => {
    const { digest: _digest, ...content } = source();
    content.items = [];
    const plan = planDatasetSnapshotImport(prepare(createDatasetSnapshot(content)));
    expect(plan.dataset.version).toBe(0);
    expect(plan.versionRecord).toBeUndefined();
    expect(plan.items).toEqual([]);
    expect(plan.identities).toHaveLength(1);
  });

  it('does not put authored payloads or import time in the identity mapping', () => {
    const plan = planDatasetSnapshotImport(prepare());
    expect(Object.keys(plan.identities[1]!).sort()).toEqual(['datasetId', 'id', 'itemId', 'portableId']);
    expect(plan.receipt).not.toHaveProperty('items');
    expect(plan.receipt).not.toHaveProperty('configuration');
  });

  it.each(['input', 'groundTruth', 'requestContext'] as const)(
    'rejects items incompatible with the captured %s schema',
    field => {
      const { digest: _digest, ...content } = source();
      content.items[0]!.payload[field] = field === 'requestContext' ? {} : 'wrong type';
      expect(() => validateDatasetSnapshotSchemas(prepare(createDatasetSnapshot(content)).content)).toThrow(
        'captured dataset schemas',
      );
    },
  );

  it('rejects historical items incompatible with export-time configuration', () => {
    const plan = planDatasetSnapshotImport(prepare());
    plan.dataset.inputSchema = { type: 'string' };
    expect(() =>
      captureDatasetSnapshot({ dataset: plan.dataset, items: plan.items, identities: plan.identities, version: 0 }),
    ).toThrow('captured dataset schemas');
  });

  it('rejects unavailable versions and purged content instead of producing misleading snapshots', () => {
    const plan = planDatasetSnapshotImport(prepare());
    expect(() =>
      captureDatasetSnapshot({ dataset: plan.dataset, items: plan.items, identities: plan.identities, version: 2 }),
    ).toThrow('does not exist');
    plan.items[0]!.metadata = { __purged: true };
    expect(() =>
      captureDatasetSnapshot({ dataset: plan.dataset, items: plan.items, identities: plan.identities, version: 1 }),
    ).toThrow('purged item content');
  });

  it('matches replay fingerprints and rejects changed requests even if the destination was deleted', () => {
    const prepared = prepare();
    const { receipt } = planDatasetSnapshotImport(prepared);
    expect(() => verifyDatasetSnapshotReceipt(receipt, prepared)).not.toThrow();
    const changed = prepareDatasetSnapshotImport(JSON.stringify(prepared.snapshot), {
      idempotencyKey: 'release-1',
      destination: { name: 'Other' },
    });
    expect(() => verifyDatasetSnapshotReceipt(receipt, changed)).toThrow('already used');
  });
});
