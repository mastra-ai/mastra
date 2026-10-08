import { describe, expect, it } from 'vitest';
import { createDatasetSnapshot, parseDatasetSnapshot } from '../snapshot';
import {
  datasetSnapshotExportOptionsSchema,
  datasetSnapshotImportOptionsSchema,
  datasetSnapshotReceiptId,
  prepareDatasetSnapshotImport,
} from '../snapshot-transfer';

function fixture() {
  return createDatasetSnapshot({
    formatVersion: 1,
    datasetIdentity: '00000000-0000-4000-8000-000000000001',
    configuration: {
      name: 'Source cases',
      targetType: 'workflow',
      targetIds: ['lookup-dev'],
      scorerIds: ['accuracy-dev', 'safety-dev'],
    },
    items: [
      {
        itemIdentity: '00000000-0000-4000-8000-000000000002',
        createdAt: '2026-09-01T09:00:00.123Z',
        updatedAt: '2026-09-10T10:00:00.456Z',
        payload: { input: null, groundTruth: null, scorerIds: ['accuracy-dev'] },
      },
      {
        itemIdentity: '00000000-0000-4000-8000-000000000003',
        createdAt: '2026-09-01T09:00:00.123Z',
        updatedAt: '2026-09-10T10:00:00.456Z',
        payload: { input: 'null', scorerIds: [] },
      },
    ],
    provenance: {
      exportedAt: '2026-09-17T12:00:00Z',
      sourceDatasetId: 'source-local-id',
      itemVersion: 12,
      configurationBasis: 'export-time',
    },
  });
}

const options = { idempotencyKey: 'release-1' };

describe('snapshot transfer requests', () => {
  it('requires acknowledgement before exporting sensitive authored fields', () => {
    expect(datasetSnapshotExportOptionsSchema.safeParse({}).success).toBe(false);
    expect(datasetSnapshotExportOptionsSchema.safeParse({ acknowledgeSensitiveData: false }).success).toBe(false);
    expect(datasetSnapshotExportOptionsSchema.parse({ acknowledgeSensitiveData: true }).maxBytes).toBe(4 * 1024 * 1024);
  });

  it.each([-1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid item version %s', version => {
    expect(datasetSnapshotExportOptionsSchema.safeParse({ acknowledgeSensitiveData: true, version }).success).toBe(
      false,
    );
  });

  it('rejects duplicate reference mapping sources', () => {
    for (const field of ['targetMappings', 'scorerMappings']) {
      expect(() =>
        datasetSnapshotImportOptionsSchema.parse({
          ...options,
          [field]: [
            { from: 'dev', to: 'prod' },
            { from: 'dev', to: 'other' },
          ],
        }),
      ).toThrow('Duplicate reference mapping source');
    }
  });

  it('maps dataset references and item overrides without modifying the signed artifact', () => {
    const source = fixture();
    const text = JSON.stringify(source);
    const prepared = prepareDatasetSnapshotImport(text, {
      ...options,
      destination: { name: 'Imported cases', organizationId: 'destination-org', projectId: 'destination-project' },
      targetMappings: [{ from: 'lookup-dev', to: 'lookup-prod' }],
      scorerMappings: [{ from: 'accuracy-dev', to: 'accuracy-prod' }],
    });
    expect(prepared.snapshot).toEqual(source);
    expect(parseDatasetSnapshot(JSON.stringify(prepared.snapshot))).toEqual(source);
    expect(prepared.content).not.toHaveProperty('digest');
    expect(prepared.content.configuration).toMatchObject({
      name: 'Imported cases',
      targetIds: ['lookup-prod'],
      scorerIds: ['accuracy-prod', 'safety-dev'],
    });
    expect(prepared.content.items[0]).toEqual({
      ...source.items[0],
      payload: { ...source.items[0]!.payload, scorerIds: ['accuracy-prod'] },
    });
    expect(prepared.content.items[1]).toEqual(source.items[1]);
    expect(prepared.content.items[1]!.payload).not.toHaveProperty('groundTruth');
    expect(prepared.destination).toEqual({
      name: 'Imported cases',
      organizationId: 'destination-org',
      projectId: 'destination-project',
    });
    prepared.content.items[0]!.payload.groundTruth = 'changed';
    expect(prepared.snapshot.items[0]!.payload.groundTruth).toBeNull();
  });

  it('keeps request identity stable across whitespace, sufficient byte limits and mapping order', () => {
    const snapshot = fixture();
    const mappings = [
      { from: 'accuracy-dev', to: 'accuracy-prod' },
      { from: 'safety-dev', to: 'safety-prod' },
    ];
    const first = prepareDatasetSnapshotImport(JSON.stringify(snapshot), { ...options, scorerMappings: mappings });
    const second = prepareDatasetSnapshotImport(JSON.stringify(snapshot, null, 2), {
      ...options,
      destination: { name: snapshot.configuration.name },
      scorerMappings: [...mappings].reverse(),
      maxBytes: 8 * 1024 * 1024,
    });
    expect(second.requestFingerprint).toBe(first.requestFingerprint);
    expect(second.receiptId).toBe(first.receiptId);
  });

  it('binds retries to the artifact, destination and explicit mappings', () => {
    const source = fixture();
    const text = JSON.stringify(source);
    const original = prepareDatasetSnapshotImport(text, options);
    for (const override of [
      { destination: { name: 'Different' } },
      { destination: { organizationId: 'another-org' } },
      { destination: { projectId: 'another-project' } },
      { scorerMappings: [{ from: 'accuracy-dev', to: 'accuracy-prod' }] },
      { targetMappings: [{ from: 'lookup-dev', to: 'lookup-prod' }] },
    ]) {
      expect(prepareDatasetSnapshotImport(text, { ...options, ...override }).requestFingerprint).not.toBe(
        original.requestFingerprint,
      );
    }
    const { digest: _digest, ...content } = source;
    content.items[0]!.payload.groundTruth = false;
    expect(
      prepareDatasetSnapshotImport(JSON.stringify(createDatasetSnapshot(content)), options).requestFingerprint,
    ).not.toBe(original.requestFingerprint);
  });

  it('scopes receipts by destination tenancy and key, not source dataset IDs or destination names', () => {
    const original = datasetSnapshotReceiptId(options);
    expect(datasetSnapshotReceiptId({ ...options, organizationId: null, projectId: null })).toBe(original);
    for (const override of [{ organizationId: 'org' }, { projectId: 'project' }, { idempotencyKey: 'release-2' }]) {
      expect(datasetSnapshotReceiptId({ ...options, ...override })).not.toBe(original);
    }
    expect(datasetSnapshotReceiptId({ ...options, organizationId: 'a:b', projectId: 'c' })).not.toBe(
      datasetSnapshotReceiptId({ ...options, organizationId: 'a', projectId: 'b:c' }),
    );
  });

  it('handles prototype-looking reference names as literal identifiers', () => {
    const { digest: _digest, ...content } = fixture();
    content.configuration.targetIds = ['__proto__', 'constructor'];
    const prepared = prepareDatasetSnapshotImport(JSON.stringify(createDatasetSnapshot(content)), {
      ...options,
      targetMappings: [{ from: '__proto__', to: 'destination' }],
    });
    expect(prepared.content.configuration.targetIds).toEqual(['destination', 'constructor']);
  });

  it('validates resolved content but applies the byte budget to the source artifact only', () => {
    const text = JSON.stringify(fixture());
    expect(() => prepareDatasetSnapshotImport(text, { ...options, destination: { name: '\ud800' } })).toThrow();
    const prepared = prepareDatasetSnapshotImport(text, {
      ...options,
      targetMappings: [{ from: 'lookup-dev', to: 'x'.repeat(text.length) }],
      maxBytes: Buffer.byteLength(text, 'utf8'),
    });
    expect(prepared.content.configuration.targetIds).toEqual(['x'.repeat(text.length)]);
    expect(() =>
      prepareDatasetSnapshotImport(text, { ...options, maxBytes: Buffer.byteLength(text, 'utf8') - 1 }),
    ).toThrow('byte limit');
  });

  it('rejects corrupt or oversize artifacts before preparing writes', () => {
    const source = fixture();
    expect(() => prepareDatasetSnapshotImport(JSON.stringify(source), { ...options, maxBytes: 1 })).toThrow();
    source.items[0]!.payload.groundTruth = 'tampered';
    expect(() => prepareDatasetSnapshotImport(JSON.stringify(source), options)).toThrow();
  });
});
